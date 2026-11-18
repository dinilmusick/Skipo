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
    const dropCheck = sql.indexOf('DROP CONSTRAINT IF EXISTS deployments_environment_check');
    const backfill = sql.indexOf("SET environment = 'unclassified'");
    const addCheck = sql.indexOf('ADD CONSTRAINT deployments_environment_check');
    expect(dropCheck).toBeGreaterThanOrEqual(0);
    expect(backfill).toBeGreaterThanOrEqual(0);
    expect(addCheck).toBeGreaterThanOrEqual(0);
    // Drop the old preview-only CHECK before the backfill, then install the
    // replacement CHECK that explicitly permits unclassified legacy rows.
    expect(dropCheck).toBeLessThan(backfill);
    expect(backfill).toBeLessThan(addCheck);
  });
});
