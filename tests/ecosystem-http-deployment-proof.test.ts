import { describe, expect, it, vi } from 'vitest';
import { createEcosystemRuntime } from '../backend/ecosystem/ecosystemRuntime_Impure.js';
import { createHttpDeploymentProofAuthority } from
  '../backend/ecosystem/httpDeploymentProofAuthority_Impure.js';
import { registerOrRenewVerifiedDeployment, revokeVerifiedDeployment } from
  '../backend/ecosystem/verifiedDeploymentAuthority_Impure.js';
import type { Query } from '../backend/ecosystem/deploymentStore_Impure.js';

const deploymentId = '36f3149f-1243-4a14-8641-dad57e3e6f83';
const origin = 'https://aiko.example';
const claim = {
  appId: 'aiko', deploymentId, environment: 'production' as const, origin,
};
const env = { APP_URL: origin };

function host(overrides: Record<string, unknown> = {}) {
  return createEcosystemRuntime({
    appId: 'aiko', deploymentId, deploymentEnvironment: 'production',
    authenticate: async () => null, capabilities: {}, ...overrides,
  });
}
function owner(approved: typeof claim | null = claim) {
  return {
    authorizeEnrollment: vi.fn(async () => approved),
    authorizeRevocation: vi.fn(async () => ({ appId: 'aiko', deploymentId })),
  };
}
function attachUrl(response: Response, url: string): Response {
  Object.defineProperty(response, 'url', { value: url, configurable: true });
  return response;
}
function routedTransport(runtime = host()): typeof fetch {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    const response = await runtime.handle(new Request(url), env);
    if (!response) throw new Error('Proof endpoint missing');
    return attachUrl(response, url);
  };
}

describe('Luth-bound HTTPS deployment origin challenge', () => {
  it('proves actual target app/deployment/environment with a fresh 256-bit nonce', async () => {
    const registrar = owner();
    const client = createHttpDeploymentProofAuthority(registrar, routedTransport());
    const first = await client.attest({ action: 'enroll' });
    const second = await client.attest({ action: 'renew' });
    expect(first).toMatchObject(claim);
    expect(first?.proofDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(first?.proofDigest).not.toBe(second?.proofDigest);
    expect(Date.parse(first!.leaseExpiresAt) - Date.now())
      .toBeGreaterThan(14 * 60_000);
    expect(Date.parse(first!.leaseExpiresAt) - Date.now())
      .toBeLessThanOrEqual(15 * 60_000);
    expect(registrar.authorizeEnrollment).toHaveBeenCalledTimes(2);
  });

  it('registers the independently attested proof using only the registrar SQL adapter', async () => {
    const registrar = createHttpDeploymentProofAuthority(owner(), routedTransport());
    const query = vi.fn(async () => [{ deployment_id: deploymentId }]) as unknown as Query;
    const registered = await registerOrRenewVerifiedDeployment(query, registrar, {
      appId: 'impostor', proofDigest: 'client-supplied',
    });
    expect(registered).toBe(deploymentId);
    const [sql, args] = vi.mocked(query).mock.calls[0]!;
    expect(sql).toContain('ON CONFLICT (deployment_id) DO UPDATE');
    expect(args[0]).toBe(deploymentId);
    expect(args[1]).toBe('aiko');
    expect(args[2]).toBe(origin);
    expect(args[4]).toMatch(/^[a-f0-9]{64}$/);
    expect(args[4]).not.toBe('client-supplied');
  });

  it('returns no proof endpoint for unprovisioned deployments or incorrect requests', async () => {
    const unprovisioned = host({ deploymentId: undefined });
    const nonce = 'a'.repeat(64);
    const url = origin + '/api/ecosystem/deployment-proof?nonce=' + nonce;
    expect((await unprovisioned.handle(new Request(url), env))?.status).toBe(404);
    expect((await host().handle(new Request(url.replace(nonce, 'x')), env))?.status)
      .toBe(404);
    expect((await host().handle(new Request(url), {
      APP_URL: 'https://different.example',
    }))?.status).toBe(404);
    expect(await host().handle(new Request(origin + '/unrelated'), env)).toBeNull();
  });

  it('does not fetch when Luth owner enrollment has not authorized an exact origin', async () => {
    const transport = vi.fn(routedTransport());
    expect(await createHttpDeploymentProofAuthority(owner(null), transport).attest({}))
      .toBeNull();
    expect(transport).not.toHaveBeenCalled();
    await expect(createHttpDeploymentProofAuthority(owner({
      ...claim, origin: 'http://localhost',
    }), transport).attest({})).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });

  it('rejects forged deployment identity or environment even with HTTP 200', async () => {
    const forged = host({ appId: 'kone' });
    await expect(createHttpDeploymentProofAuthority(owner(), routedTransport(forged))
      .attest({})).rejects.toThrow('does not match');
    await expect(createHttpDeploymentProofAuthority(owner(), routedTransport(
      host({ deploymentEnvironment: 'preview' }),
    )).attest({})).rejects.toThrow('does not match');
  });

  it('refuses redirects, altered origins, malformed JSON and oversized response bodies', async () => {
    const endpoint = origin + '/api/ecosystem/deployment-proof?nonce=';
    const redirecting: typeof fetch = async (input: RequestInfo | URL) =>
      attachUrl(new Response('{}', { status: 200, headers: {
        'content-type': 'application/json',
      } }), String(input) + '/other');
    await expect(createHttpDeploymentProofAuthority(owner(), redirecting)
      .attest({})).rejects.toThrow('redirected');
    const oversize: typeof fetch = async (input: RequestInfo | URL) =>
      attachUrl(Response.json({ data: 'z'.repeat(2048) }), String(input));
    await expect(createHttpDeploymentProofAuthority(owner(), oversize)
      .attest({})).rejects.toThrow('oversized');
    const malformed: typeof fetch = async (input: RequestInfo | URL) =>
      attachUrl(Response.json({ appId: 'aiko', nonce: endpoint }), String(input));
    await expect(createHttpDeploymentProofAuthority(owner(), malformed)
      .attest({})).rejects.toThrow('does not match');
  });

  it('allows independently authorized terminal revocation with the origin offline', async () => {
    const offline = vi.fn(async () => { throw new Error('offline'); }) as typeof fetch;
    const registrar = createHttpDeploymentProofAuthority(owner(), offline);
    const query = vi.fn(async () => [{ deployment_id: deploymentId }]) as unknown as Query;
    expect(await revokeVerifiedDeployment(query, registrar, {})).toBe(true);
    expect(offline).not.toHaveBeenCalled();
    const deniedOwner = owner();
    deniedOwner.authorizeRevocation = vi.fn(async () => null) as never;
    await expect(revokeVerifiedDeployment(query, createHttpDeploymentProofAuthority(
      deniedOwner, offline,
    ), {})).rejects.toThrow('denied');
  });
});
