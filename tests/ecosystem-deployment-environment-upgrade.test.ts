import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('identity deployment environment upgrade regression', () => {
  it('keeps the canonical SQL and generated Vite migration identical', () => {
    const root = new URL('../', import.meta.url);
    const source = readFileSync(new URL('backend/ecosystem/db/deployments.sql', root), 'utf8');
    const generated = readFileSync(new URL('scaffolds/vite/db/skipo-ecosystem-deployments.sql', root), 'utf8');
    expect(generated).toBe(source);
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
    expect(sql.indexOf('DROP CONSTRAINT IF EXISTS deployments_environment_check'))
      .toBeLessThan(sql.indexOf('ADD CONSTRAINT deployments_environment_check'));
    expect(sql.indexOf('DROP CONSTRAINT IF EXISTS deployments_environment_check'))
      .toBeLessThan(sql.indexOf('UPDATE skipo_ecosystem.deployments'));
  });

  it('freezes publication/version identity and grant authorization scope', () => {
    const root = new URL('../', import.meta.url);
    const sql = readFileSync(new URL('backend/ecosystem/db/deployments.sql', root), 'utf8');
    for (const marker of [
      'guard_workflow_publication_update',
      'NEW.app_id IS DISTINCT FROM OLD.app_id',
      'NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id',
      'NEW.workspace_id IS DISTINCT FROM OLD.workspace_id',
      'NEW.workflow_id IS DISTINCT FROM OLD.workflow_id',
      'NEW.version IS DISTINCT FROM OLD.version',
      'workflow_publications_identity_immutable',
      'guard_workflow_grant_update',
      'NEW.publication_id IS DISTINCT FROM OLD.publication_id',
      'NEW.caller_app_id IS DISTINCT FROM OLD.caller_app_id',
      'NEW.source_workspace_id IS DISTINCT FROM OLD.source_workspace_id',
      'NEW.target_workspace_id IS DISTINCT FROM OLD.target_workspace_id',
      "OLD.grant_state = 'revoked'",
      "NEW.grant_state <> 'revoked'",
      'workflow_grants_scope_immutable',
    ]) {
      expect(sql).toContain(marker);
    }
  });
});
