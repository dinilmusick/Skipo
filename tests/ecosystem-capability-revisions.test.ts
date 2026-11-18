import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  getDeploymentCapabilityRevision,
  resolveVerifiedCapabilityDeployment,
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

const registeredFacade = {
  facade: { services: { workspace: { execute: async () => [] } } },
  registry: {
    getCommand: (_domain: string, _operation: string) => undefined,
    getQuery: (domain: string, operation: string) =>
      domain === 'workspace' && operation === 'list' ? { handler: async () => [] } : undefined,
  },
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

  it('rejects common API, client, private and key-material fields at every nesting level', () => {
    for (const keyName of ['apiKey', 'api_key', 'private_key', 'clientKey', 'keyMaterial']) {
      const descriptor = {
        ...ping,
        inputSchema: { type: 'object', properties: { [keyName]: { type: 'string' } } },
      };
      expect(() => normalizeStaticCapabilityDescriptors([descriptor]), keyName)
        .toThrow(/cannot contain session, endpoint, credential or secret/i);
    }
  });

  it('stores independent revision streams per stable deployment UUID', async () => {
    const query = vi.fn(async (_sql: string, args: unknown[]) => [{ revision: args[0] === deploymentA ? 1 : 4 }]) as unknown as Query;
    await expect(publishDeploymentCapabilityRevision(query, deploymentA, [ping])).resolves.toBe(1);
    await expect(publishDeploymentCapabilityRevision(query, deploymentB, [ping])).resolves.toBe(4);
    expect(vi.mocked(query).mock.calls[0]?.[1][0]).toBe(deploymentA);
    expect(vi.mocked(query).mock.calls[1]?.[1][0]).toBe(deploymentB);
    expect(vi.mocked(query).mock.calls[0]?.[0]).toContain('pg_advisory_xact_lock');
    expect(vi.mocked(query).mock.calls[0]?.[0]).toContain("verification_state = 'verified'");
    expect(vi.mocked(query).mock.calls[0]?.[0]).toContain("NULLIF(btrim(verification_proof_digest), '') IS NOT NULL");
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
    await getDeploymentCapabilityRevision(query, 'aiko', deploymentA, 'production');
    const sql = vi.mocked(query).mock.calls[0]?.[0] ?? '';
    expect(sql).toContain('ORDER BY revision DESC');
    expect(sql).toContain("verification_state = 'verified'");
    expect(sql).toContain("NULLIF(btrim(d.verification_proof_digest), '') IS NOT NULL");
    expect(sql).toContain('lease_expires_at > statement_timestamp()');
    expect(sql).toContain('d.environment = $3');
    expect(sql).toContain("d.last_refresh_at > statement_timestamp() - interval '15 minutes'");
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
      backendFacadeOperations: registeredFacade,
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

describe('proof-qualified current deployment capability selection', () => {
  it('binds target app, environment, revision, proof, live lease, freshness and the latest snapshot', async () => {
    const query = vi.fn(async () => [{
      deployment_id: deploymentA, app_url: 'https://aiko.example', revision: '3',
      descriptor: ping,
    }]) as unknown as Query;
    const resolved = await resolveVerifiedCapabilityDeployment(
      query, 'aiko', ping.id, 'production', 3,
    );
    expect(resolved).toEqual({
      deploymentId: deploymentA, url: 'https://aiko.example',
      revision: 3, descriptor: ping,
    });
    const sql = vi.mocked(query).mock.calls[0]?.[0] ?? '';
    const args = vi.mocked(query).mock.calls[0]?.[1] ?? [];
    expect(args).toEqual(['aiko', ping.id, 'production', 3]);
    expect(sql).toContain('d.app_id = $1');
    expect(sql).toContain('d.environment = $3');
    expect(sql).toContain('r.revision = $4::bigint');
    expect(sql).toContain('ORDER BY revision DESC');
    expect(sql).toContain('matched.descriptor->>\'id\' = $2');
    expect(sql).toContain("d.verification_state = 'verified'");
    expect(sql).toContain("NULLIF(btrim(d.verification_proof_digest), '') IS NOT NULL");
    expect(sql).toContain('d.lease_expires_at > statement_timestamp()');
    expect(sql).toContain("d.last_refresh_at > statement_timestamp() - interval '15 minutes'");
  });

  it('fails closed when no eligible deployment has a current matching capability', async () => {
    const query = vi.fn(async () => []) as unknown as Query;
    await expect(resolveVerifiedCapabilityDeployment(
      query, 'aiko', ping.id, 'preview', 7,
    )).resolves.toBeNull();
    expect(vi.mocked(query).mock.calls[0]?.[1]).toEqual([
      'aiko', ping.id, 'preview', 7,
    ]);
  });

  it('rejects malformed selectors and stale or untrusted returned descriptors', async () => {
    const query = vi.fn(async () => []) as unknown as Query;
    await expect(resolveVerifiedCapabilityDeployment(
      query, 'aiko', ping.id, 'production', 0,
    )).rejects.toThrow(/invalid verified capability/i);
    await expect(resolveVerifiedCapabilityDeployment(
      query, 'aiko', ping.id, 'production', Number.NaN,
    )).rejects.toThrow(/invalid verified capability/i);
    await expect(resolveVerifiedCapabilityDeployment(
      query, 'aiko', ping.id, 'unclassified' as never,
    )).rejects.toThrow(/invalid verified capability/i);
    expect(query).not.toHaveBeenCalled();
    const forged = vi.fn(async () => [{
      deployment_id: deploymentA, app_url: 'https://aiko.example', revision: '3',
      descriptor: { ...ping, id: 'other.operation' },
    }]) as unknown as Query;
    await expect(resolveVerifiedCapabilityDeployment(
      forged, 'aiko', ping.id, 'production',
    )).rejects.toThrow(/invalid capability descriptor/i);
  });
  it('rejects forged or unregistered BackendFacade operation publication', () => {
    const options = {
      appId: 'aiko', deploymentId: deploymentA,
      capabilities: { workspaceList: async () => [] },
      capabilityDescriptors: [{ ...ping, id: 'workspaceList' }],
      authenticate: async () => 'user-1',
    };
    expect(() => createEcosystemRuntime({
      ...options, deploymentId: undefined,
    })).toThrow(/stable deployment identity/i);
    expect(() => createEcosystemRuntime({
      ...options, capabilityDescriptors: [ping],
    })).toThrow(/registered callable capabilities/i);
    expect(() => createEcosystemRuntime(options)).toThrow(/real BackendFacade and BackendRegistry/i);
    expect(() => createEcosystemRuntime({
      ...options, backendFacadeOperations: registeredFacade,
    })).not.toThrow();

    expect(() => createEcosystemRuntime({
      ...options,
      backendFacadeOperations: {
        ...registeredFacade, facade: { services: { workspace: {} } },
      },
    })).toThrow(/service is not installed/i);
    expect(() => createEcosystemRuntime({
      ...options,
      capabilityDescriptors: [{ ...ping, id: 'workspaceList', invocation: {
        serviceId: 'workspace', operationId: 'unregistered',
      } }],
      backendFacadeOperations: registeredFacade,
    })).toThrow(/operation is not registered/i);
    expect(() => createEcosystemRuntime({
      ...options,
      backendFacadeOperations: {
        ...registeredFacade, registry: { getCommand: () => undefined, getQuery: () => undefined },
      },
    })).toThrow(/operation is not registered/i);
  });

  it('rejects unsafe operation selectors and forged verified endpoints', async () => {
    expect(() => normalizeStaticCapabilityDescriptors([
      { ...ping, invocation: { serviceId: 'constructor', operationId: 'list' } },
    ])).toThrow(/malformed/i);
    expect(() => normalizeStaticCapabilityDescriptors([
      { ...ping, invocation: { serviceId: 'workspace', operationId: 'list', forgedFlag: true } } as never,
    ])).toThrow(/malformed/i);
    const query = vi.fn(async () => [{
      deployment_id: deploymentA, app_url: 'http://127.0.0.1/admin', revision: 3,
      descriptor: ping,
    }]) as unknown as Query;
    await expect(resolveVerifiedCapabilityDeployment(
      query, 'aiko', ping.id, 'production', 3,
    )).rejects.toThrow(/HTTPS DNS origin/i);
  });

  it('enforces immutable revision history and a fresh, qualified publishing lease', async () => {
    const query = vi.fn(async () => [{ revision: 2 }]) as unknown as Query;
    await publishDeploymentCapabilityRevision(query, deploymentA, [ping]);
    const sql = vi.mocked(query).mock.calls[0]?.[0] ?? '';
    expect(sql).toContain("environment <> 'unclassified'");
    expect(sql).toContain("last_refresh_at > statement_timestamp() - interval '15 minutes'");
    const root = new URL('../', import.meta.url);
    const migration = readFileSync(new URL('backend/ecosystem/db/deployments.sql', root), 'utf8');
    expect(migration).toContain('reject_capability_revision_mutation');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON skipo_ecosystem.deployment_capability_revisions');
    expect(migration).toContain('static capability revision history is immutable');
  });

});
