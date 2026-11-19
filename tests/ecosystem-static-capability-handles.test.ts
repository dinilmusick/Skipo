import { describe, expect, it, vi } from 'vitest';
import {
  normalizeStaticCapabilityDescriptors, resolveVerifiedCapabilityDeployment,
  validStaticHandle, type Query,
} from '../backend/ecosystem/deploymentStore_Impure.js';
import { createEcosystemRuntime } from
  '../backend/ecosystem/ecosystemRuntime_Impure.js';
import { createVerifiedCapabilityDiscovery } from
  '../backend/ecosystem/verifiedCapabilityDiscovery_Impure.js';

const deploymentId = '36f3149f-1243-4a14-8641-dad57e3e6f83';
const capability = {
  id: 'workspace.list', description: 'Registered workspace method',
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  invocation: { serviceId: 'workspace', operationId: 'list' },
};

describe('unified verified/static/legacy capability handle contract', () => {
  it('accepts exact registered dotted, colon-qualified and single-character handles', () => {
    for (const id of ['workspace.list', 'workspace:list', 'workspace_get', 'x']) {
      expect(validStaticHandle(id)).toBe(true);
      expect(normalizeStaticCapabilityDescriptors([{ ...capability, id }])[0]?.id)
        .toBe(id);
    }
  });

  it('rejects prototype pollution, thenable and traversal names consistently', () => {
    for (const id of ['constructor', 'prototype', '__proto__', 'then',
      'workspace..list', '../owner', 'workspace/list', '', 'a b']) {
      expect(validStaticHandle(id)).toBe(false);
      expect(() => normalizeStaticCapabilityDescriptors([{ ...capability, id }]))
        .toThrow();
    }
  });

  it('publishes a dotted ID when it is bound to a registered facade operation', async () => {
    const q = vi.fn(async (sql: string) => sql.includes('WITH lock AS MATERIALIZED')
      ? [{ revision: 1 }] : [{ deployment_id: deploymentId }]) as unknown as Query;
    const runtime = createEcosystemRuntime({
      appId: 'aiko', deploymentId,
      capabilities: { 'workspace.list': async () => [] },
      capabilityDescriptors: [capability],
      backendFacadeOperations: {
        facade: { services: { workspace: { execute: async () => [] } } },
        registry: {
          getCommand: () => ({ handler: async () => [] }),
          getQuery: () => undefined,
        },
      },
      authenticate: async () => null,
      query: () => q,
    });
    await runtime.heartbeat({
      APP_URL: 'https://aiko.example', SYSTEM_DATABASE_URL: 'mock',
    }, true);
    const revision = vi.mocked(q).mock.calls.find(([sql]) =>
      sql.includes('WITH lock AS MATERIALIZED'));
    expect(JSON.parse(revision![1][1] as string)[0].id).toBe('workspace.list');
  });

  it('preserves dotted names at the authenticated legacy client selector boundary', async () => {
    const q = vi.fn(async (sql: string) => sql.includes('SELECT app_url')
      ? [{ app_url: 'https://aiko.example' }] : []) as unknown as Query;
    const fetcher = vi.fn(async () => Response.json({ output: ['ok'] }));
    const runtime = createEcosystemRuntime({
      appId: 'kone', capabilities: {},
      authenticate: async () => 'user-1', query: () => q,
      send: fetcher as typeof fetch,
    });
    const client = await runtime.client(new Request('https://kone.example'), {});
    expect(await client.aiko['workspace.list']({})).toEqual(['ok']);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(client.aiko.constructor).toBeUndefined();
    expect(client.aiko.then).toBeUndefined();
  });

  it('uses the same handle semantics for exact versioned verified resolution', async () => {
    const q = vi.fn(async () => [{
      deployment_id: deploymentId, app_url: 'https://aiko.example',
      revision: 3, descriptor: capability,
    }]) as unknown as Query;
    const policy = {
      authenticate: async () => ({
        userId: 'owner', sessionId: 'session', callerAppId: 'kone',
        sourceWorkspaceId: 'source', targetWorkspaceId: 'target',
      }),
      authorize: async () => true,
    };
    const adapter = createVerifiedCapabilityDiscovery(q, policy);
    const selection = { appId: 'aiko', capabilityId: 'workspace.list',
      environment: 'production' as const, revision: 3, deploymentId };
    expect((await adapter.resolve(new Request('https://kone.example'), selection))
      ?.descriptor.id).toBe('workspace.list');
    await expect(resolveVerifiedCapabilityDeployment(q,
      'aiko', 'workspace..list', 'production', 3, deploymentId))
      .rejects.toThrow('Invalid verified');
  });
});
