import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEcosystemRuntime } from
  '../backend/ecosystem/ecosystemRuntime_Impure.js';
import { registerOrRenewVerifiedDeployment } from
  '../backend/ecosystem/verifiedDeploymentAuthority_Impure.js';
import type { Query } from '../backend/ecosystem/deploymentStore_Impure.js';

const deploymentId = '36f3149f-1243-4a14-8641-dad57e3e6f83';
const descriptor = {
  id: 'composeRun', description: 'Registered command',
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  invocation: { serviceId: 'compose', operationId: 'run' },
};

describe('backend operation revision freshness', () => {
  it('preserves canonical-to-generated proof and registry backend mirrors', () => {
    for (const name of [
      'deploymentStore_Impure.ts', 'ecosystemRuntime_Impure.ts',
      'verifiedCapabilityDiscovery_Impure.ts', 'deploymentProof_Impure.ts',
    ]) {
      expect(readFileSync('backend/ecosystem/' + name, 'utf8')).toBe(
        readFileSync('scaffolds/vite/src/backend/ecosystem/generated/' + name, 'utf8'));
    }
    const sync = readFileSync('scripts/sync-ecosystem-runtime.py', 'utf8');
    expect(sync).toContain('deploymentProof_Impure.ts');
    expect(sync).toContain('verifiedCapabilityDiscovery_Impure.ts');
  });

  it('withdraws a removed registered method in a new complete snapshot', async () => {
    let enabled = true;
    const facade = { services: { compose: { execute: async () => null } } };
    const source = {
      facade,
      registry: {
        getCommand: () => enabled ? { handler: async () => null } : undefined,
        getQuery: () => undefined,
      },
    };
    const query = vi.fn(async (sql: string) =>
      sql.includes('ON CONFLICT (deployment_id)')
        ? [{ deployment_id: deploymentId }] : [{ revision: 1 }]) as unknown as Query;
    const runtime = createEcosystemRuntime({
      appId: 'aiko', deploymentId, backendFacadeOperations: source,
      capabilityDescriptors: [descriptor],
      capabilities: { composeRun: async () => null },
      authenticate: async () => null,
      query: () => query,
    });
    const env = { APP_URL: 'https://aiko.example', SYSTEM_DATABASE_URL: 'mock' };
    await runtime.heartbeat(env, true);
    enabled = false;
    await runtime.heartbeat(env, true);
    const snapshots = vi.mocked(query).mock.calls.filter(([sql]) =>
      sql.includes('WITH lock AS MATERIALIZED'));
    expect(snapshots).toHaveLength(2);
    expect(JSON.parse(snapshots[0]![1][1] as string)).toHaveLength(1);
    expect(JSON.parse(snapshots[1]![1][1] as string)).toEqual([]);
  });

  it('restores re-registered methods through a later snapshot', async () => {
    let allowed = true;
    const source = {
      facade: { services: { compose: { execute: async () => null } } },
      registry: {
        getCommand: () => allowed ? { handler: async () => null } : undefined,
        getQuery: () => undefined,
      },
    };
    const query = vi.fn(async (sql: string) => sql.includes('ON CONFLICT')
      ? [{ deployment_id: deploymentId }] : [{ revision: 2 }]) as unknown as Query;
    const runtime = createEcosystemRuntime({
      appId: 'aiko', deploymentId,
      capabilityDescriptors: [descriptor], backendFacadeOperations: source,
      capabilities: { composeRun: async () => null },
      authenticate: async () => null, query: () => query,
    });
    const env = { APP_URL: 'https://aiko.example', SYSTEM_DATABASE_URL: 'mock' };
    await runtime.heartbeat(env, true);
    allowed = false;
    await runtime.heartbeat(env, true);
    allowed = true;
    await runtime.heartbeat(env, true);
    const calls = vi.mocked(query).mock.calls.filter(([sql]) =>
      sql.includes('WITH lock AS MATERIALIZED'));
    expect(calls).toHaveLength(3);
    expect(JSON.parse(calls[1]![1][1] as string)).toEqual([]);
    expect(JSON.parse(calls[2]![1][1] as string)).toHaveLength(1);
  });

  it('requires a real SHA-256 hex digest even from a trusted callback', async () => {
    const query = vi.fn(async () => [{ deployment_id: deploymentId }]) as unknown as Query;
    for (const proofDigest of ['z'.repeat(64), 'A'.repeat(64), 'a'.repeat(63)]) {
      await expect(registerOrRenewVerifiedDeployment(query, {
        attest: async () => ({
          appId: 'aiko', deploymentId, origin: 'https://aiko.example',
          environment: 'production', proofDigest,
          leaseExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        }),
        authorizeRevocation: async () => null,
      }, {})).rejects.toThrow('invalid identity');
    }
    expect(query).not.toHaveBeenCalled();
  });
});
