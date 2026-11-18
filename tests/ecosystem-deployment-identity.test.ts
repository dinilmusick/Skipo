import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  refreshDeployment, refreshDeploymentById, type Query,
} from '../backend/ecosystem/deploymentStore_Impure.js';
import { createEcosystemRuntime } from '../backend/ecosystem/ecosystemRuntime_Impure.js';

const deploymentId = '36f3149f-1243-4a14-8641-dad57e3e6f83';

describe('canonical ULTRST deployment identity', () => {
  it('inserts/refreshes by stable deployment UUID, not app URL', async () => {
    const query = vi.fn(async (_sql: string, args: unknown[]) => [
      { deployment_id: args[0] },
    ]) as unknown as Query;
    await refreshDeploymentById(query, 'aiko', deploymentId, 'https://old.example', ['listWorkspaces']);
    await refreshDeploymentById(query, 'aiko', deploymentId, 'https://new.example', ['listWorkspaces']);
    const [initialSql, initialArgs] = vi.mocked(query).mock.calls[0]!;
    const [updatedSql, updatedArgs] = vi.mocked(query).mock.calls[1]!;
    expect(initialSql).toContain('ON CONFLICT (deployment_id)');
    expect(initialSql).toContain('WHERE deployments.app_id = EXCLUDED.app_id');
    expect(initialArgs[0]).toBe(deploymentId);
    expect(updatedArgs[0]).toBe(deploymentId);
    expect(initialArgs[2]).not.toBe(updatedArgs[2]);
    expect(updatedSql).toContain('RETURNING deployment_id');
  });

  it('rejects invalid UUIDs and cross-app identity reuse', async () => {
    const query = vi.fn(async () => []) as unknown as Query;
    await expect(refreshDeploymentById(query, 'aiko', 'http://app.example',
      'https://safe.example', [])).rejects.toThrow('UUID');
    expect(query).not.toHaveBeenCalled();
    await expect(refreshDeploymentById(query, 'kone', deploymentId,
      'https://safe.example', [])).rejects.toThrow('already bound');
  });

  it('preserves existing app_id + URL heartbeat when no deployment UUID is declared', async () => {
    const query = vi.fn(async () => []) as unknown as Query;
    await refreshDeployment(query, 'aiko', 'https://old.example', []);
    expect(vi.mocked(query).mock.calls[0]?.[0]).toContain('ON CONFLICT (app_id, app_url)');
  });

  it('routes declared stable identity to ID-aware refresh without new env variables', async () => {
    const calls: Array<{ sql: string; args: unknown[] }> = [];
    const query = (async <Row>(sql: string, args: unknown[]): Promise<Row[]> => {
      calls.push({ sql, args });
      return [{ deployment_id: deploymentId }] as Row[];
    }) as Query;
    const app = createEcosystemRuntime({
      appId: 'aiko', deploymentId, capabilities: { ping: async () => 'pong' },
      authenticate: async () => 'user-1', query: () => query,
    });
    await app.heartbeat({
      APP_URL: 'https://aiko.example', SYSTEM_DATABASE_URL: 'postgresql://unused',
    }, true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.sql).toContain('ON CONFLICT (deployment_id)');
    expect(calls[0]!.args.slice(0, 2)).toEqual([deploymentId, 'aiko']);
  });

  it('rejects invalid identity before any heartbeat', () => {
    expect(() => createEcosystemRuntime({
      appId: 'aiko', deploymentId: 'https://fake.example', capabilities: {},
      authenticate: async () => null,
    })).toThrow('Invalid ecosystem deployment identity');
  });

  it('keeps generated Vite application runtime and database migration in sync', () => {
    const root = new URL('../', import.meta.url);
    for (const [source, generated] of [
      ['backend/ecosystem/deploymentStore_Impure.ts',
        'scaffolds/vite/src/backend/ecosystem/generated/deploymentStore_Impure.ts'],
      ['backend/ecosystem/ecosystemRuntime_Impure.ts',
        'scaffolds/vite/src/backend/ecosystem/generated/ecosystemRuntime_Impure.ts'],
      ['backend/ecosystem/db/deployments.sql',
        'scaffolds/vite/db/skipo-ecosystem-deployments.sql'],
    ]) {
      expect(readFileSync(new URL(source, root), 'utf8'))
        .toBe(readFileSync(new URL(generated, root), 'utf8'));
    }
    const sourceSql = readFileSync(new URL('backend/ecosystem/db/deployments.sql', root), 'utf8');
    expect(sourceSql).toContain("ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'unclassified'");
    expect(sourceSql).toContain("environment IN ('unclassified','development','preview','staging','production')");
    expect(sourceSql).toContain('DROP CONSTRAINT IF EXISTS deployments_environment_check');
    expect(sourceSql).toContain("SET environment = 'unclassified'");
  });
  it('enforces immutable publication identity/version and one-way grant revocation', () => {
    const sql = readFileSync(new URL('../backend/ecosystem/db/deployments.sql', import.meta.url), 'utf8');
    expect(sql).toContain('workflow_publications_immutable');
    expect(sql).toContain('workflow_grants_immutable');
    expect(sql).toContain('workflow_grants_require_published');
    expect(sql).toContain('workflow publication identity and version are immutable');
    expect(sql).toContain('workflow grant scope and grantor are immutable');
    expect(sql).toContain('workflow publication withdrawal is permanent');
    expect(sql).toContain('workflow grant revocation is permanent');
    expect(sql).toContain('workflow_grants_one_active_scope');
    expect(sql).toContain("WHERE grant_state = 'active'");
  });
});
