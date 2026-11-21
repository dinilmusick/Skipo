import { describe, expect, it, vi } from 'vitest';
import {
  resolveVerifiedCapabilityDeployment, type Query,
} from '../backend/ecosystem/deploymentStore_Impure.js';
import { createVerifiedCapabilityDiscovery } from
  '../backend/ecosystem/verifiedCapabilityDiscovery_Impure.js';

const id = '36f3149f-1243-4a14-8641-dad57e3e6f83';
const otherId = 'c9ae6d9f-329c-46cb-884d-47c943ad63a1';
const descriptor = {
  id: 'compose.run', description: 'Registered operation',
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  invocation: { serviceId: 'compose', operationId: 'run' },
};
const row = { deployment_id: id, app_url: 'https://aiko.example',
  revision: 2, descriptor };
const selection = { appId: 'aiko', capabilityId: descriptor.id,
  environment: 'production' as const, revision: 2, deploymentId: id };
const request = new Request('https://kone.example/api/discover');
const policy = () => ({
  authenticate: vi.fn(async () => ({
    userId: 'user', sessionId: 'session', callerAppId: 'kone',
    sourceWorkspaceId: 'source', targetWorkspaceId: 'target',
  })),
  authorize: vi.fn(async () => true),
});

describe('exact verified deployment instance pinning', () => {
  it('selects a concrete UUID in addition to app, environment and revision', async () => {
    const q = vi.fn(async () => [row]) as unknown as Query;
    const found = await resolveVerifiedCapabilityDeployment(q,
      'aiko', descriptor.id, 'production', 2, id);
    expect(found?.deploymentId).toBe(id);
    const [sql, args] = vi.mocked(q).mock.calls[0]!;
    expect(sql).toContain('AND d.deployment_id = $5::uuid');
    expect(args).toEqual(['aiko', descriptor.id, 'production', 2, id]);
  });

  it('fails closed when registry returns another deployment or selector is malformed', async () => {
    const q = vi.fn(async () => [{ ...row, deployment_id: otherId }]) as unknown as Query;
    await expect(resolveVerifiedCapabilityDeployment(q,
      'aiko', descriptor.id, 'production', 2, id)).rejects.toThrow('different deployment');
    const invalid = createVerifiedCapabilityDiscovery(q, policy());
    await expect(invalid.resolve(request, { ...selection, deploymentId: '../bad' }))
      .rejects.toThrow('Invalid verified registry');
  });

  it('requires the same instance for discovery and invocation-time revalidation', async () => {
    const q = vi.fn(async () => [row]) as unknown as Query;
    const gate = policy();
    const adapter = createVerifiedCapabilityDiscovery(q, gate);
    expect((await adapter.resolve(request, selection))?.deploymentId).toBe(id);
    expect((await adapter.revalidate(request, selection))?.deploymentId).toBe(id);
    expect(gate.authorize).toHaveBeenCalledTimes(2);
    expect(vi.mocked(q).mock.calls).toHaveLength(2);
    expect(vi.mocked(q).mock.calls.every(([,args]) => args[4] === id)).toBe(true);
  });

  it('requires exact instance binding when listing a selected deployment', async () => {
    const q = vi.fn(async (sql: string) =>
      sql.includes('LIMIT 64') ? [{
        deployment_id: id, revision: 2, descriptor,
      }] : [row]) as unknown as Query;
    const found = await createVerifiedCapabilityDiscovery(q, policy())
      .list(request, 'aiko', 'production');
    expect(found).toHaveLength(1);
    expect(vi.mocked(q).mock.calls[1]![1][4]).toBe(id);
  });
});
