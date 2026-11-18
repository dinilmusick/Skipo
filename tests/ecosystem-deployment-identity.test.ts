import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  refreshDeployment, refreshDeploymentById, validatedDeploymentOrigin, type Query,
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

  it('rejects untrusted public target origins before database registration', () => {
    expect(validatedDeploymentOrigin('https://service.example')).toBe('https://service.example');
    for (const unsafe of [
      'http://service.example', 'https://127.0.0.1', 'https://admin:pw@service.example',
      'https://service.local', 'https://service.example/private', 'https://service.example?x=1',
    ]) {
      expect(() => validatedDeploymentOrigin(unsafe), unsafe).toThrow(/public HTTPS DNS origin/);
    }
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
  });
  it('protects verified endpoint bindings and makes revocation terminal in canonical and generated SQL', () => {
    const root = new URL('../', import.meta.url);
    const canonical = readFileSync(new URL('backend/ecosystem/db/deployments.sql', root), 'utf8');
    const generated = readFileSync(new URL('scaffolds/vite/db/skipo-ecosystem-deployments.sql', root), 'utf8');
    expect(canonical).toBe(generated);
    expect(canonical).toContain("OLD.verification_state = 'verified'");
    expect(canonical).toContain('NEW.app_url IS DISTINCT FROM OLD.app_url');
    expect(canonical).toContain('NEW.capabilities IS DISTINCT FROM OLD.capabilities');
    expect(canonical).toContain('registry re-attestation');
    expect(canonical).toContain("OLD.verification_state = 'revoked'");
    expect(canonical).toContain("NEW.verification_state IS DISTINCT FROM 'revoked'");
    expect(canonical).toContain("revoked deployment identity cannot be reactivated");
    expect(canonical).toContain('BEFORE UPDATE ON skipo_ecosystem.deployments');
  });

});
