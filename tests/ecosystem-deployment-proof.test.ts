import { describe, expect, it, vi } from 'vitest';
import { findVerifiedDeployment, type Query } from '../backend/ecosystem/deploymentStore_Impure.js';
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

  it('selects only verified deployments in the requested environment with an active lease', async () => {
    const query = vi.fn(async (sql: string, args: unknown[]) => {
      expect(sql).toContain("verification_state = 'verified'");
      expect(sql).toContain("NULLIF(btrim(d.verification_proof_digest), '') IS NOT NULL");
      expect(sql).toContain('lease_expires_at > statement_timestamp()');
      expect(sql).toContain("last_refresh_at > statement_timestamp() - interval '15 minutes'");
      expect(sql).toContain('environment = $3');
      expect(args).toEqual(['aiko', 'agent.invoke', 'production', null]);
      expect(sql).toContain('JOIN LATERAL');
      expect(sql).toContain("matched.descriptor->>'id' = $2");
      expect(sql).not.toContain('ANY(capabilities)');
      return [{
        deployment_id: '36f3149f-1243-4a14-8641-dad57e3e6f83',
        app_url: 'https://verified.example', revision: 3,
        descriptor: {
          id: 'agent.invoke',
          description: 'Invoke registered agent operation.',
          invocation: { serviceId: 'agent', operationId: 'invoke' },
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' },
        },
      }];
    }) as unknown as Query;
    expect(await findVerifiedDeployment(query, 'aiko', 'agent.invoke', 'production'))
      .toEqual({ deploymentId: '36f3149f-1243-4a14-8641-dad57e3e6f83', url: 'https://verified.example' });
  });

  it('fails closed when no proof-and-lease-qualified deployment is returned', async () => {
    const query = vi.fn(async () => []) as unknown as Query;
    expect(await findVerifiedDeployment(query, 'aiko', 'agent.invoke', 'staging')).toBeNull();
  });

});
