/**
 * Registrar-only deployment lease authority. This file is NOT copied into
 * generated Vite apps and must run behind a trusted Luth/deployment control
 * verifier with a separate privileged SQL role.
 *
 * Never treat a deployment UUID, APP_URL, bearer header, local manifest,
 * digest submitted by the caller, or heartbeat as ownership evidence.
 */
import { validatedDeploymentOrigin, type Query } from './deploymentStore_Impure.js';

export type VerifiedEnvironment = 'development' | 'preview' | 'staging' | 'production';

export interface VerifiedDeploymentLease {
  appId: string;
  deploymentId: string;
  origin: string;
  environment: VerifiedEnvironment;
  /** Digest computed from proof independently verified by the control plane. */
  proofDigest: string;
  /** Bound by the registrar to its verified challenge and actor. */
  leaseExpiresAt: string;
}

export interface AuthorizedDeploymentRevocation {
  appId: string;
  deploymentId: string;
}

export interface TrustedDeploymentAuthority {
  /**
   * Authenticate the deployer and canonical app ownership, independently
   * challenge/verify the claimed endpoint and emit a bound one-use attestation.
   * Do NOT implement this callback with manifest/headers or client-supplied flags.
   */
  attest: (untrustedRequest: unknown) => Promise<VerifiedDeploymentLease | null>;
  /** Authenticate a permitted app owner/control-plane revoker. */
  authorizeRevocation: (untrustedRequest: unknown) => Promise<AuthorizedDeploymentRevocation | null>;
}

const appPattern = /^[a-z][a-z0-9-]{0,62}$/;
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const proofPattern = /^[a-f0-9]{64}$/;
const environments = new Set<VerifiedEnvironment>([
  'development', 'preview', 'staging', 'production',
]);
const maxLeaseMillis = 30 * 60_000;

function validTarget(appId: string, deploymentId: string): boolean {
  return appPattern.test(appId) && uuidPattern.test(deploymentId);
}

function parseGrant(input: VerifiedDeploymentLease): VerifiedDeploymentLease {
  if (!input || !validTarget(input.appId, input.deploymentId) ||
      !environments.has(input.environment) ||
      typeof input.proofDigest !== 'string' ||
      !proofPattern.test(input.proofDigest) ||
      typeof input.leaseExpiresAt !== 'string') {
    throw new Error('Trusted deployment attestation has invalid identity, environment or proof.');
  }
  const expiry = Date.parse(input.leaseExpiresAt);
  const now = Date.now();
  if (!Number.isFinite(expiry) || expiry <= now || expiry > now + maxLeaseMillis) {
    throw new Error('Trusted deployment lease must expire within thirty minutes.');
  }
  return {
    appId: input.appId, deploymentId: input.deploymentId,
    origin: validatedDeploymentOrigin(input.origin),
    environment: input.environment,
    proofDigest: input.proofDigest,
    leaseExpiresAt: new Date(expiry).toISOString(),
  };
}

/**
 * Only the trusted registrar calls this after verifying an app owner and
 * endpoint challenge. The SQL statement cannot change an existing identity,
 * app URL or environment, cannot resurrect revoked IDs, and cannot issue a
 * lease outside the bounded interval. It returns no rows for failed policy.
 *
 * IMPORTANT: database role grants must prevent generated app connections from
 * calling this privileged SQL; the verifier callback is not a DB permission.
 */
export async function registerOrRenewVerifiedDeployment(
  authorityQuery: Query,
  authority: TrustedDeploymentAuthority,
  untrustedRequest: unknown,
): Promise<string> {
  if (!authority || typeof authority.attest !== 'function') {
    throw new Error('Trusted deployment control authority is required.');
  }
  const attested = await authority.attest(untrustedRequest);
  if (!attested) throw new Error('Trusted deployment ownership attestation was denied.');
  const grant = parseGrant(attested);
  const [registered] = await authorityQuery<{ deployment_id: string }>(`
    INSERT INTO skipo_ecosystem.deployments
      (deployment_id, app_id, app_url, capabilities, environment,
       verification_state, verification_proof_digest, lease_expires_at)
    SELECT $1::uuid, $2, $3, ARRAY[]::text[], $4,
           'verified', $5, $6::timestamptz
    WHERE $6::timestamptz > statement_timestamp()
      AND $6::timestamptz <= statement_timestamp() + interval '30 minutes'
    ON CONFLICT (deployment_id) DO UPDATE
      SET verification_state = 'verified',
          verification_proof_digest = EXCLUDED.verification_proof_digest,
          lease_expires_at = EXCLUDED.lease_expires_at
    WHERE deployments.verification_state <> 'revoked'
      AND deployments.app_id = EXCLUDED.app_id
      AND deployments.app_url = EXCLUDED.app_url
      AND deployments.environment = EXCLUDED.environment
    RETURNING deployment_id::text
  `, [
    grant.deploymentId, grant.appId, grant.origin, grant.environment,
    grant.proofDigest, grant.leaseExpiresAt,
  ]);
  if (!registered || registered.deployment_id !== grant.deploymentId) {
    throw new Error('Deployment identity, origin, environment or revocation conflicts with trusted attestation.');
  }
  return registered.deployment_id;
}

/**
 * Revocation is one-way for this deployment UUID. Renewal must use another
 * verified attestation and cannot undo revocation.
 */
export async function revokeVerifiedDeployment(
  authorityQuery: Query,
  authority: TrustedDeploymentAuthority,
  untrustedRequest: unknown,
): Promise<boolean> {
  if (!authority || typeof authority.authorizeRevocation !== 'function') {
    throw new Error('Trusted deployment revocation authority is required.');
  }
  const verified = await authority.authorizeRevocation(untrustedRequest);
  if (!verified) throw new Error('Trusted deployment revocation was denied.');
  if (!validTarget(verified.appId, verified.deploymentId)) {
    throw new Error('Trusted deployment revocation has invalid identity.');
  }
  const [row] = await authorityQuery<{ deployment_id: string }>(`
    UPDATE skipo_ecosystem.deployments
    SET verification_state = 'revoked',
        lease_expires_at = statement_timestamp()
    WHERE app_id = $1 AND deployment_id = $2::uuid
      AND verification_state <> 'revoked'
    RETURNING deployment_id::text
  `, [verified.appId, verified.deploymentId]);
  if (row?.deployment_id === verified.deploymentId) return true;
  // Repeating an approved revocation is idempotent, but only for the same
  // canonical app and deployment identity. Never revive a revoked instance.
  const [alreadyRevoked] = await authorityQuery<{ deployment_id: string }>(`
    SELECT deployment_id::text
    FROM skipo_ecosystem.deployments
    WHERE app_id = $1 AND deployment_id = $2::uuid
      AND verification_state = 'revoked'
    LIMIT 1
  `, [verified.appId, verified.deploymentId]);
  return alreadyRevoked?.deployment_id === verified.deploymentId;
}
