import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('identity deployment environment upgrade regression', () => {
  it('keeps the canonical SQL and generated Vite migration identical', () => {
    const root = new URL('../', import.meta.url);
    const source = readFileSync(new URL('backend/ecosystem/db/deployments.sql', root), 'utf8');
    const generated = readFileSync(new URL('scaffolds/vite/db/skipo-ecosystem-deployments.sql', root), 'utf8');
    expect(generated).toBe(source);
  });

  it('retains immutable publication and grant transition enforcement', () => {
    const sql = readFileSync(new URL('../backend/ecosystem/db/deployments.sql', import.meta.url), 'utf8');
    expect(sql).toContain('CREATE TRIGGER workflow_publications_immutable');
    expect(sql).toContain('CREATE TRIGGER workflow_grants_immutable');
    expect(sql).toContain('CREATE TRIGGER workflow_grants_require_published');
    expect(sql).toContain('workflow publication withdrawal is permanent');
    expect(sql).toContain('workflow grant revocation is permanent');
  });

  it('backfills unproved preview deployments without marking them verified', () => {
    const sql = readFileSync(new URL('../backend/ecosystem/db/deployments.sql', import.meta.url), 'utf8');
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'unclassified'");
    expect(sql).toContain("ALTER COLUMN environment SET DEFAULT 'unclassified'");
    expect(sql).toContain("SET environment = 'unclassified'");
    expect(sql).toContain("verification_state = 'unverified'");
    expect(sql).toContain('verification_proof_digest IS NULL');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS deployments_environment_check');
    expect(sql).toContain("environment IN ('unclassified','development','preview','staging','production')");
    expect(sql).not.toContain("ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'preview'");
    const drop = sql.indexOf('DROP CONSTRAINT IF EXISTS deployments_environment_check');
    const backfill = sql.indexOf("SET environment = 'unclassified'");
    const add = sql.indexOf('ADD CONSTRAINT deployments_environment_check');
    expect(drop).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(drop);
    expect(add).toBeGreaterThan(backfill);
  });
});
