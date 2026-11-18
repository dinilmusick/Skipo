import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  getDeploymentCapabilityRevision,
  normalizeStaticCapabilityDescriptors,
  publishDeploymentCapabilityRevision,
  type Query,
  type StaticCapabilityDescriptor,
} from '../backend/ecosystem/deploymentStore_Impure.js';
import { createEcosystemRuntime } from '../backend/ecosystem/ecosystemRuntime_Impure.js';

const deploymentA = '36f3149f-1243-4a14-8641-dad57e3e6f83';
const deploymentB = 'a6b7aaf1-3d2c-4a7d-a0c4-7f9b1aeb13d1';
const ping: StaticCapabilityDescriptor = {
  id: 'workspace.list',
  name: 'List workspaces',
  description: 'List workspaces available to the authenticated principal.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'array', items: { type: 'object' } },
  invocation: { serviceId: 'workspace', operationId: 'list' },
  access: 'authenticated',
  discoverable: true,
};

describe('per-deployment static capability revisions', () => {
  it('normalizes descriptors deterministically without changing capability identity', () => {
    const normalized = normalizeStaticCapabilityDescriptors([
      { ...ping, id: 'workspace.create' },
      ping,
    ]);
    expect(normalized.map((item) => item.id)).toEqual(['workspace.create', 'workspace.list']);
    expect(normalized[1]).toEqual(ping);
  });

  it('rejects session, endpoint, credential and secret material at every nesting level', () => {
    expect(() => normalizeStaticCapabilityDescriptors([
      { ...ping, invocation: { ...ping.invocation, endpointUrl: 'https://private.example' } } as never,
    ])).toThrow(/cannot contain session, endpoint, credential or secret/i);
    expect(() => normalizeStaticCapabilityDescriptors([
      { ...ping, inputSchema: { type: 'object', properties: { accessToken: { type: 'string' } } } },
    ])).toThrow(/cannot contain session, endpoint, credential or secret/i);
  });

  it('stores independent revision streams per stable deployment UUID', async () => {
    const query = vi.fn(async (_sql: string, args: unknown[]) => [{ revision: args[0] === deploymentA ? 1 : 4 }]) as unknown as Query;
    await expect(publishDeploymentCapabilityRevision(query, deploymentA, [ping])).resolves.toBe(1);
    await expect(publishDeploymentCapabilityRevision(query, deploymentB, [ping])).resolves.toBe(4);
    expect(vi.mocked(query).mock.calls[0]?.[1][0]).toBe(deploymentA);
    expect(vi.mocked(query).mock.calls[1]?.[1][0]).toBe(deploymentB);
    expect(vi.mocked(query).mock.calls[0]?.[0]).toContain('pg_advisory_xact_lock');
    expect(vi.mocked(query).mock.calls[0]?.[0]).toContain("verification_state = 'verified'");
    expect(vi.mocked(query).mock.calls[0]?.[0]).toContain('lease_expires_at > statement_timestamp()');
  });

  it('publishes withdrawn operations as a new complete snapshot, not a stale union', async () => {
    const query = vi.fn(async () => [{ revision: 2 }]) as unknown as Query;
    const remaining = { ...ping, id: 'workspace.get' };
    await expect(publishDeploymentCapabilityRevision(query, deploymentA, [remaining])).resolves.toBe(2);
    const serialized = String(vi.mocked(query).mock.calls[0]?.[1][1]);
    expect(serialized).toContain('workspace.get');
    expect(serialized).not.toContain('workspace.list');
    expect(vi.mocked(query).mock.calls[0]?.[0]).toContain('NOT EXISTS (SELECT 1 FROM latest');
  });

  it('resolves only the latest snapshot for a verified deployment with a live lease', async () => {
    const query = vi.fn(async () => []) as unknown as Query;
    await getDeploymentCapabilityRevision(query, 'aiko', deploymentA);
    const sql = vi.mocked(query).mock.calls[0]?.[0] ?? '';
    expect(sql).toContain('ORDER BY revision DESC');
    expect(sql).toContain("verification_state = 'verified'");
    expect(sql).toContain('lease_expires_at > statement_timestamp()');
    expect(sql).not.toMatch(/session_endpoint|access_token|secret_value/i);
  });

  it('publishes descriptors on stable-ID heartbeat and preserves generated Vite parity', async () => {
    const calls: Array<{ sql: string; args: unknown[] }> = [];
    const query = (async <Row>(sql: string, args: unknown[]): Promise<Row[]> => {
      calls.push({ sql, args });
      return (sql.includes('deployment_capability_revisions') ? [{ revision: 1 }] : [{ deployment_id: deploymentA }]) as Row[];
    }) as Query;
    const app = createEcosystemRuntime({
      appId: 'aiko',
      deploymentId: deploymentA,
      capabilities: { workspaceList: async () => [] },
      capabilityDescriptors: [{ ...ping, id: 'workspaceList' }],
      authenticate: async () => 'user-1',
      query: () => query,
    });
    await app.heartbeat({ APP_URL: 'https://aiko.example', SYSTEM_DATABASE_URL: 'postgresql://unused' }, true);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.sql).toContain('deployment_capability_revisions');
    const root = new URL('../', import.meta.url);
    for (const [source, generated] of [
      ['backend/ecosystem/deploymentStore_Impure.ts', 'scaffolds/vite/src/backend/ecosystem/generated/deploymentStore_Impure.ts'],
      ['backend/ecosystem/ecosystemRuntime_Impure.ts', 'scaffolds/vite/src/backend/ecosystem/generated/ecosystemRuntime_Impure.ts'],
      ['backend/ecosystem/db/deployments.sql', 'scaffolds/vite/db/skipo-ecosystem-deployments.sql'],
    ]) {
      expect(readFileSync(new URL(source, root), 'utf8')).toBe(readFileSync(new URL(generated, root), 'utf8'));
    }
  });
});
