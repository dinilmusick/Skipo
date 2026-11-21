import { describe, expect, it, vi } from 'vitest';
import {
  consumeInvocation, findDeployment, getDeploymentCapabilityRevision,
  publishDeploymentCapabilityRevision, refreshDeployment, refreshDeploymentById,
  resolveVerifiedCapabilityDeployment, type Query,
} from '../backend/ecosystem/deploymentStore_Impure.js';
import { createVerifiedCapabilityDiscovery } from
  '../backend/ecosystem/verifiedCapabilityDiscovery_Impure.js';

const deploymentId = '36f3149f-1243-4a14-8641-dad57e3e6f83';
const invocationId = '72aa9bfb-5a02-4f8c-b23e-3b6197e43f18';

describe('verified deployment isolation from legacy registry traffic', () => {
  it('never lets a legacy URL heartbeat rewrite verified or revoked deployments', async () => {
    const query = vi.fn(async () => []) as unknown as Query;
    await refreshDeployment(query, 'aiko', 'https://aiko.example', ['legacyPing']);
    const [sql, args] = vi.mocked(query).mock.calls[0]!;
    expect(args).toEqual(['aiko', 'https://aiko.example', ['legacyPing']]);
    expect(sql).toContain("WHERE deployments.verification_state = 'unverified'");
    expect(sql).not.toContain("SET verification_state = 'verified'");
  });

  it('pins the URL and claim list even before the database trigger is upgraded', async () => {
    const query = vi.fn(async () => [{ deployment_id: deploymentId }]) as unknown as Query;
    await refreshDeploymentById(query, 'aiko', deploymentId, 'https://aiko.example',
      ['legacyPing']);
    const [sql] = vi.mocked(query).mock.calls[0]!;
    expect(sql).toContain("deployments.verification_state = 'unverified'");
    expect(sql).toContain("deployments.verification_state = 'verified'");
    expect(sql).toContain('deployments.app_url = EXCLUDED.app_url');
    expect(sql).toContain('deployments.capabilities = EXCLUDED.capabilities');
    expect(sql).toContain('deployments.app_id = EXCLUDED.app_id');
    expect(sql).not.toContain("deployments.verification_state <> 'revoked'");
  });

  it('rejects missing stable-ID writes and does not report false registration', async () => {
    const refused = vi.fn(async () => []) as unknown as Query;
    await expect(refreshDeploymentById(refused, 'aiko', deploymentId,
      'https://aiko.example', ['legacyPing'])).rejects.toThrow('already bound');
  });

  it('keeps the legacy finder restricted to unverified compatibility deployments', async () => {
    const query = vi.fn(async () => [{ app_url: 'https://legacy.example' }]) as unknown as Query;
    expect(await findDeployment(query, 'aiko', 'legacyPing')).toBe('https://legacy.example');
    const [sql, args] = vi.mocked(query).mock.calls[0]!;
    expect(args).toEqual(['aiko', 'legacyPing']);
    expect(sql).toContain("verification_state = 'unverified'");
    expect(sql).toContain('last_refresh_at > statement_timestamp()');
  });

  it('redeems legacy tickets only for currently unverified target deployments', async () => {
    const query = vi.fn(async () => [{ caller_app: 'kone', user_id: 'owner',
      capability: 'legacyPing', params: {} }]) as unknown as Query;
    const ticket = await consumeInvocation(query, invocationId,
      'aiko', 'https://legacy.example');
    expect(ticket?.caller_app).toBe('kone');
    const [sql, args] = vi.mocked(query).mock.calls[0]!;
    expect(args).toEqual([invocationId, 'aiko', 'https://legacy.example']);
    expect(sql).toContain('USING skipo_ecosystem.deployments AS target');
    expect(sql).toContain("target.verification_state = 'unverified'");
    expect(sql).toContain('target.app_id = pending.target_app');
    expect(sql).toContain('target.app_url = pending.target_url');
    expect(sql).toContain('pending.expires_at > statement_timestamp()');
  });

  it('refuses ticket redemption when no eligible unverified target exists', async () => {
    const empty = vi.fn(async () => []) as unknown as Query;
    expect(await consumeInvocation(empty, invocationId,
      'aiko', 'https://verified.example')).toBeUndefined();
  });

  it('requires active canonical application status for verified snapshot operations', async () => {
    const q = vi.fn(async () => []) as unknown as Query;
    await publishDeploymentCapabilityRevision(q, deploymentId, []);
    expect(vi.mocked(q).mock.calls[0]![0])
      .toContain("apps.status = 'active'");
    await getDeploymentCapabilityRevision(q, 'aiko', deploymentId, 'production');
    expect(vi.mocked(q).mock.calls[1]![0])
      .toContain("apps.status = 'active'");
    await resolveVerifiedCapabilityDeployment(q, 'aiko', 'legacyPing', 'production');
    expect(vi.mocked(q).mock.calls[2]![0])
      .toContain("apps.status = 'active'");
  });

  it('filters retired applications before enumerating verified discovery candidates', async () => {
    const q = vi.fn(async () => []) as unknown as Query;
    const policy = {
      authenticate: vi.fn(async () => ({
        userId: 'owner', sessionId: 'session', callerAppId: 'kone',
        sourceWorkspaceId: 'source', targetWorkspaceId: 'target',
      })),
      authorize: vi.fn(async () => true),
    };
    await createVerifiedCapabilityDiscovery(q, policy).list(
      new Request('https://kone.example/discover'), 'aiko', 'production');
    expect(vi.mocked(q).mock.calls[0]![0]).toContain("apps.status='active'");
    expect(policy.authorize).not.toHaveBeenCalled();
  });
});
