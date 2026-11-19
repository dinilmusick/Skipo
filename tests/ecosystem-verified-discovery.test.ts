import { describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import type { Query, StaticCapabilityDescriptor } from '../backend/ecosystem/deploymentStore_Impure.js';
import {
  createVerifiedCapabilityDiscovery, type AuthenticatedDiscoveryIdentity,
  type VerifiedDiscoveryPolicy,
} from '../backend/ecosystem/verifiedCapabilityDiscovery_Impure.js';

const deploymentId = '36f3149f-1243-4a14-8641-dad57e3e6f83';
const descriptor: StaticCapabilityDescriptor = {
  id: 'compose.run', description: 'Run a registered service',
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  invocation: { serviceId: 'compose', operationId: 'run' },
};
const identity: AuthenticatedDiscoveryIdentity = {
  userId: 'user-1', sessionId: 'session-1', callerAppId: 'kone',
  sourceWorkspaceId: 'workspace-kone', targetWorkspaceId: 'workspace-aiko',
};
const selection = { appId: 'aiko', capabilityId: descriptor.id,
  environment: 'production' as const, revision: 3 };
const request = new Request('https://kone.example.com/api/discover');

function policy(): VerifiedDiscoveryPolicy {
  return {
    authenticate: vi.fn(async () => identity),
    authorize: vi.fn(async () => true),
  };
}
const eligibleRow = {
  deployment_id: deploymentId, app_url: 'https://aiko.example.com',
  revision: 3, descriptor,
};

describe('backend verified capability discovery adapter', () => {
  it('requires the trusted Luth policy and never provides an anonymous fallback', async () => {
    const query = vi.fn(async () => [eligibleRow]) as unknown as Query;
    expect(() => createVerifiedCapabilityDiscovery(query, undefined as never)).toThrow();
    const denied = policy();
    denied.authenticate = vi.fn(async () => null);
    const adapter = createVerifiedCapabilityDiscovery(query, denied);
    expect(await adapter.resolve(request, selection)).toBeNull();
    expect(await adapter.list(request, 'aiko', 'production')).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('uses proof, lease, environment and latest revision in the real resolver query', async () => {
    const query = vi.fn(async () => [eligibleRow]) as unknown as Query;
    const adapter = createVerifiedCapabilityDiscovery(query, policy());
    const found = await adapter.resolve(request, selection);
    expect(found).toEqual({
      deploymentId, url: 'https://aiko.example.com', revision: 3, descriptor,
    });
    const [sql, args] = (query as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args).toEqual(['aiko', 'compose.run', 'production', 3]);
    expect(sql).toContain("verification_state = 'verified'");
    expect(sql).toContain('lease_expires_at > statement_timestamp()');
    expect(sql).toContain('ORDER BY revision DESC');
    expect(sql).toContain('r.revision = $4');
  });

  it('rejects changed Luth principals even when the registry returned a deployment', async () => {
    const query = vi.fn(async () => [eligibleRow]) as unknown as Query;
    const authorization = policy();
    authorization.authenticate = vi.fn()
      .mockResolvedValueOnce(identity)
      .mockResolvedValueOnce({ ...identity, sessionId: 'session-replaced' });
    const adapter = createVerifiedCapabilityDiscovery(query, authorization);
    expect(await adapter.resolve(request, selection)).toBeNull();
    expect(authorization.authorize).not.toHaveBeenCalled();
  });

  it('rechecks grants and rejects missing, revoked or stale capability selection', async () => {
    const query = vi.fn(async () => [eligibleRow]) as unknown as Query;
    const authorization = policy();
    authorization.authorize = vi.fn(async () => false);
    expect(await createVerifiedCapabilityDiscovery(query, authorization)
      .revalidate(request, selection)).toBeNull();
    const emptyQuery = vi.fn(async () => []) as unknown as Query;
    expect(await createVerifiedCapabilityDiscovery(emptyQuery, policy())
      .resolve(request, selection)).toBeNull();
    await expect(createVerifiedCapabilityDiscovery(query, policy())
      .resolve(request, { ...selection, environment: 'unclassified' as never })).rejects.toThrow();
    await expect(createVerifiedCapabilityDiscovery(query, policy())
      .resolve(request, { ...selection, revision: 0 })).rejects.toThrow();
  });

  it('rejects invalid external origins and does not expose forged descriptors', async () => {
    const badOrigin = { ...eligibleRow, app_url: 'http://127.0.0.1' };
    const query = vi.fn(async () => [badOrigin]) as unknown as Query;
    await expect(createVerifiedCapabilityDiscovery(query, policy())
      .resolve(request, selection)).rejects.toThrow();
    const forged = { ...eligibleRow, descriptor: { ...descriptor, password: 'sensitive' } };
    const maliciousQuery = vi.fn(async () => [forged]) as unknown as Query;
    await expect(createVerifiedCapabilityDiscovery(maliciousQuery, policy())
      .resolve(request, selection)).rejects.toThrow();
  });

  it('lists only current verified methods and independently rechecks each capability', async () => {
    const query = vi.fn(async (sql: string) =>
      sql.includes('LIMIT 64')
        ? [{ deployment_id: deploymentId, revision: 3, descriptor }]
        : [eligibleRow]) as unknown as Query;
    const authorized = policy();
    const adapter = createVerifiedCapabilityDiscovery(query, authorized);
    expect(await adapter.list(request, 'aiko', 'production')).toEqual([{
      deploymentId, url: 'https://aiko.example.com', revision: 3, descriptor,
    }]);
    expect(authorized.authorize).toHaveBeenCalledTimes(1);
    const [sql, args] = (query as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args).toEqual(['aiko', 'production']);
    expect(sql).toContain("verification_state='verified'");
    expect(sql).toContain('lease_expires_at > statement_timestamp()');
    expect(sql).toContain('LIMIT 64');
  });

  it('keeps generated Vite backend source byte-identical but excludes registrar authority', () => {
    for (const file of ['deploymentStore_Impure.ts', 'ecosystemRuntime_Impure.ts',
      'verifiedCapabilityDiscovery_Impure.ts']) {
      expect(readFileSync('backend/ecosystem/' + file, 'utf8'))
        .toBe(readFileSync('scaffolds/vite/src/backend/ecosystem/generated/' + file, 'utf8'));
    }
    expect(existsSync('scaffolds/vite/src/backend/ecosystem/generated/verifiedDeploymentAuthority_Impure.ts'))
      .toBe(false);
  });
});
