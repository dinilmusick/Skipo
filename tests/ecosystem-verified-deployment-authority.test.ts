import { describe, expect, it, vi } from 'vitest';
import type { Query } from '../backend/ecosystem/deploymentStore_Impure.js';
import {
  registerOrRenewVerifiedDeployment, revokeVerifiedDeployment,
  type TrustedDeploymentAuthority, type VerifiedDeploymentLease,
} from '../backend/ecosystem/verifiedDeploymentAuthority_Impure.js';

const deploymentId = '36f3149f-1243-4a14-8641-dad57e3e6f83';
const proofDigest = '1'.repeat(64);

const lease = (): VerifiedDeploymentLease => ({
  appId: 'aiko', deploymentId, origin: 'https://aiko.example',
  environment: 'production', proofDigest,
  leaseExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
});

function authority(
  attest: TrustedDeploymentAuthority['attest'] = async () => lease(),
  authorizeRevocation: TrustedDeploymentAuthority['authorizeRevocation'] =
    async () => ({ appId: 'aiko', deploymentId }),
): TrustedDeploymentAuthority {
  return { attest, authorizeRevocation };
}

describe('trusted-only Skipo deployment authority adapter', () => {
  it('issues or renews a bounded lease only from an independently attested result', async () => {
    const query = vi.fn(async () => [{ deployment_id: deploymentId }]) as unknown as Query;
    const untrusted = { appId: 'evil', deploymentId, origin: 'https://impostor.example' };
    const verifier = authority();
    expect(await registerOrRenewVerifiedDeployment(query, verifier, untrusted))
      .toBe(deploymentId);
    const [sql, args] = vi.mocked(query).mock.calls[0]!;
    expect(args.slice(0, 5)).toEqual([
      deploymentId, 'aiko', 'https://aiko.example', 'production', proofDigest,
    ]);
    expect(sql).toContain('ON CONFLICT (deployment_id) DO UPDATE');
    expect(sql).toContain("deployments.verification_state <> 'revoked'");
    expect(sql).toContain('deployments.app_id = EXCLUDED.app_id');
    expect(sql).toContain('deployments.app_url = EXCLUDED.app_url');
    expect(sql).toContain('deployments.environment = EXCLUDED.environment');
    expect(sql).toContain("interval '30 minutes'");
    expect(sql).not.toMatch(/SET\s+app_id\s*=|SET\s+app_url\s*=|SET\s+deployment_id\s*=/);
  });

  it('fails closed without trusted verification or on invalid/expired/oversized proof and origins', async () => {
    const query = vi.fn(async () => [{ deployment_id: deploymentId }]) as unknown as Query;
    await expect(registerOrRenewVerifiedDeployment(query, authority(async () => null), {}))
      .rejects.toThrow(/attestation was denied/i);
    for (const forged of [
      { ...lease(), appId: 'https://aiko.example' },
      { ...lease(), deploymentId: 'not-a-uuid' },
      { ...lease(), proofDigest: 'x' },
      { ...lease(), origin: 'https://127.0.0.1' },
      { ...lease(), environment: 'unclassified' },
      { ...lease(), leaseExpiresAt: new Date(Date.now() - 1000).toISOString() },
      { ...lease(), leaseExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString() },
    ]) {
      await expect(registerOrRenewVerifiedDeployment(
        query, authority(async () => forged as VerifiedDeploymentLease), {},
      )).rejects.toThrow();
    }
    expect(query).not.toHaveBeenCalled();
  });

  it('denies rebinding, cross-app renewal and revocation when SQL authority refuses', async () => {
    const query = vi.fn(async () => []) as unknown as Query;
    await expect(registerOrRenewVerifiedDeployment(query, authority(), {}))
      .rejects.toThrow(/conflicts with trusted attestation/i);
    expect(vi.mocked(query).mock.calls[0]![1][0]).toBe(deploymentId);
  });

  it('revokes only a target independently authorized by the control plane', async () => {
    const query = vi.fn(async () => [{ deployment_id: deploymentId }]) as unknown as Query;
    const verifier = authority();
    await expect(revokeVerifiedDeployment(query, verifier, { appId: 'fake' })).resolves.toBe(true);
    const [sql, args] = vi.mocked(query).mock.calls[0]!;
    expect(args).toEqual(['aiko', deploymentId]);
    expect(sql).toContain("verification_state = 'revoked'");
    expect(sql).toContain('lease_expires_at = statement_timestamp()');
    expect(sql).toContain("verification_state <> 'revoked'");
    expect(sql).not.toContain('verification_state = \'verified\'');
  });

  it('will not attempt revocation without a trusted owner/control-plane approval', async () => {
    const query = vi.fn(async () => []) as unknown as Query;
    await expect(revokeVerifiedDeployment(
      query, authority(undefined, async () => null), { appId: 'aiko' },
    )).rejects.toThrow(/revocation was denied/i);
    expect(query).not.toHaveBeenCalled();
  });
  it('makes repeated approved revocation idempotent without changing a revoked row', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ deployment_id: deploymentId }]) as unknown as Query;
    expect(await revokeVerifiedDeployment(query, authority(), {})).toBe(true);
    expect(vi.mocked(query)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(query).mock.calls[1]![0]).toContain("verification_state = 'revoked'");
  });

  it('does not report cross-application revocation as successful', async () => {
    const query = vi.fn(async () => []) as unknown as Query;
    expect(await revokeVerifiedDeployment(query, authority(), {})).toBe(false);
    expect(query).toHaveBeenCalledTimes(2);
  });

});
