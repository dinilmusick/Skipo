import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const canonical = readFileSync(new URL('backend/ecosystem/db/deployments.sql', root), 'utf8');
const generated = readFileSync(new URL('scaffolds/vite/db/skipo-ecosystem-deployments.sql', root), 'utf8');

describe('verified deployment proof invariants', () => {
  it('keeps generated and canonical SQL byte-identical', () => {
    expect(canonical).toBe(generated);
  });

  it('fails a migration instead of silently upgrading existing unproven verified rows', () => {
    expect(canonical).toContain('verified deployments without proof digest or lease require review');
    expect(canonical).toContain("verification_state = 'verified'");
    expect(canonical).toContain("NULLIF(btrim(verification_proof_digest), '') IS NULL");
    expect(canonical).toContain('lease_expires_at IS NULL');
  });

  it('requires nonblank proof digest and a lease expiry to enter verified state', () => {
    expect(canonical).toContain('deployments_verified_proof_required');
    expect(canonical).toContain("verification_state <> 'verified'");
    expect(canonical).toContain("NULLIF(btrim(verification_proof_digest), '') IS NOT NULL");
    expect(canonical).toContain('lease_expires_at IS NOT NULL');
  });

  it('does not automatically certify legacy registrations', () => {
    expect(canonical).toContain("DEFAULT 'unverified'");
    expect(canonical).toContain("DEFAULT 'unclassified'");
    expect(canonical).not.toContain("SET verification_state = 'verified'");
  });
});
