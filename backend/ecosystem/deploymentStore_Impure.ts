import { neon } from '@neondatabase/serverless';

export type EcosystemEnv = Record<string, unknown>;
export type Query = <Row>(sql: string, args: unknown[]) => Promise<Row[]>;

export function systemQuery(env: EcosystemEnv): Query {
  const url = typeof env.SYSTEM_DATABASE_URL === 'string' ? env.SYSTEM_DATABASE_URL.trim() : '';
  if (!url) throw new Error('SYSTEM_DATABASE_URL is required for the ecosystem registry.');
  // Registry writes and one-time ticket redemption must use the same primary.
  const sql = neon(url);
  return async <Row>(text: string, args: unknown[]) => await sql.query(text, args, {
    fetchOptions: { signal: AbortSignal.timeout(5_000) },
  }) as Row[];
}

/** Refuse non-HTTPS, private or non-origin URLs returned by an external registry. */
export function validatedDeploymentOrigin(value: unknown): string {
  const parsed = new URL(typeof value === 'string' ? value.trim() : '');
  const hostname = parsed.hostname;
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash ||
      !hostname.includes('.') || /^(?:\d+\.){3}\d+$/.test(hostname) ||
      /\.(?:localhost|local|internal)\.?$/.test(hostname)) {
    throw new Error('Verified deployment target must be a public HTTPS DNS origin.');
  }
  return parsed.origin;
}

export async function refreshDeployment(query: Query, app: string, url: string, capabilities: string[]) {
  await query(`
    WITH expired AS (
      DELETE FROM skipo_ecosystem.invocations WHERE expires_at <= statement_timestamp()
    )
    INSERT INTO skipo_ecosystem.deployments (app_id, app_url, capabilities)
    VALUES ($1, $2, $3::text[])
    ON CONFLICT (app_id, app_url) DO UPDATE
    SET last_refresh_at = GREATEST(deployments.last_refresh_at, EXCLUDED.last_refresh_at),
        capabilities = EXCLUDED.capabilities
    WHERE deployments.verification_state = 'unverified'
  `, [app, url, capabilities]);
}

/**
 * Stable-ID refresh is opt-in during the migration. Legacy (app_id, URL)
 * registrations still work, but cannot silently take ownership of a stable ID.
 * A deployment is always tied to its canonical app_id.
 */
export async function refreshDeploymentById(
  query: Query, app: string, deploymentId: string, url: string, capabilities: string[],
) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(deploymentId)) {
    throw new Error('Deployment identity must be a UUID.');
  }
  url = validatedDeploymentOrigin(url);
  const updated = await query<{ deployment_id: string }>(`
    INSERT INTO skipo_ecosystem.deployments (deployment_id, app_id, app_url, capabilities)
    VALUES ($1::uuid, $2, $3, $4::text[])
    ON CONFLICT (deployment_id) DO UPDATE SET
      app_url = EXCLUDED.app_url,
      last_refresh_at = GREATEST(deployments.last_refresh_at, EXCLUDED.last_refresh_at),
      capabilities = EXCLUDED.capabilities
    WHERE deployments.app_id = EXCLUDED.app_id
      AND (deployments.verification_state = 'unverified'
        OR (deployments.verification_state = 'verified'
          AND deployments.app_url = EXCLUDED.app_url
          AND deployments.capabilities = EXCLUDED.capabilities))
    RETURNING deployment_id
  `, [deploymentId, app, url, capabilities]);
  if (updated.length !== 1) {
    throw new Error('Deployment identity is already bound to another application.');
  }
}


export interface StaticCapabilityDescriptor {
  id: string;
  description: string;
  inputSchema: object;
  outputSchema: object;
  name?: string;
  serviceName?: string;
  invocation: { serviceId: string; operationId: string };
  access?: 'public' | 'authenticated' | 'roles';
  requiredRoles?: readonly string[];
  discoverable?: boolean;
}

const forbiddenDescriptorKey = /(?:secret|token|session|endpoint|url|credential|authorization|password|cookie|bearer|(?:api|access|private|client|server|signing|encryption)[_-]?key|key[_-]?(?:material|secret))/i;
const staticOperationHandle = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
function validStaticHandle(value: unknown): value is string {
  return typeof value === 'string' && staticOperationHandle.test(value) &&
    !value.includes('..') && !['constructor', 'prototype', '__proto__'].includes(value);
}
const descriptorKeys = new Set([
  'id', 'description', 'inputSchema', 'outputSchema', 'name', 'serviceName',
  'invocation', 'access', 'requiredRoles', 'discoverable',
]);

function assertSafeDescriptorValue(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertSafeDescriptorValue(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenDescriptorKey.test(key)) {
      throw new Error('Static capability descriptors cannot contain session, endpoint, credential or secret fields.');
    }
    assertSafeDescriptorValue(nested);
  }
}

export function normalizeStaticCapabilityDescriptors(
  descriptors: readonly StaticCapabilityDescriptor[],
): StaticCapabilityDescriptor[] {
  if (!Array.isArray(descriptors) || descriptors.length > 256) {
    throw new Error('Static capability descriptor collection is invalid.');
  }
  const seen = new Set<string>();
  return descriptors.map((descriptor) => {
    if (!descriptor || typeof descriptor !== 'object') {
      throw new Error('Static capability descriptor is malformed.');
    }
    // Reject secret material before the structural allowlist, so sensitive
    // nested selectors remain distinguishable from other invalid fields.
    assertSafeDescriptorValue(descriptor);
    if (
        Object.keys(descriptor).some((key) => !descriptorKeys.has(key)) ||
        !validStaticHandle(descriptor.id) ||
        typeof descriptor.description !== 'string' || !descriptor.description.trim() ||
        !descriptor.invocation ||
        Object.keys(descriptor.invocation).sort().join(',') !== 'operationId,serviceId' ||
        !validStaticHandle(descriptor.invocation.serviceId) ||
        !validStaticHandle(descriptor.invocation.operationId) ||
        !descriptor.inputSchema || typeof descriptor.inputSchema !== 'object' ||
        Array.isArray(descriptor.inputSchema) ||
        !descriptor.outputSchema || typeof descriptor.outputSchema !== 'object' ||
        Array.isArray(descriptor.outputSchema) ||
        (descriptor.access !== undefined && !['public', 'authenticated', 'roles'].includes(descriptor.access)) ||
        (descriptor.requiredRoles !== undefined &&
          (!Array.isArray(descriptor.requiredRoles) || descriptor.requiredRoles.some((role) => typeof role !== 'string'))) ||
        (descriptor.discoverable !== undefined && typeof descriptor.discoverable !== 'boolean')) {
      throw new Error('Static capability descriptor is malformed.');
    }
    if (seen.has(descriptor.id)) throw new Error('Static capability descriptor IDs must be unique.');
    seen.add(descriptor.id);
    return JSON.parse(JSON.stringify(descriptor)) as StaticCapabilityDescriptor;
  }).sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Persist a new immutable snapshot only when the descriptor set changes.
 * The row is written only for a deployment whose ownership proof and lease
 * are currently valid; an unverified deployment has no discoverable snapshot.
 */
export async function publishDeploymentCapabilityRevision(
  query: Query, deploymentId: string, descriptors: readonly StaticCapabilityDescriptor[],
): Promise<number | null> {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(deploymentId)) {
    throw new Error('Deployment identity must be a UUID.');
  }
  const normalized = normalizeStaticCapabilityDescriptors(descriptors);
  const [row] = await query<{ revision: number | string }>(`
    WITH lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))
    ),
    latest AS MATERIALIZED (
      SELECT revision, descriptors
      FROM skipo_ecosystem.deployment_capability_revisions
      CROSS JOIN lock
      WHERE deployment_id = $1::uuid
      ORDER BY revision DESC
      LIMIT 1
    ),
    eligible AS MATERIALIZED (
      SELECT d.deployment_id
      FROM skipo_ecosystem.deployments AS d
      JOIN public."ultrst-apps" AS apps
        ON apps.app_id = d.app_id AND apps.status = 'active'
      WHERE d.deployment_id = $1::uuid
        AND d.verification_state = 'verified'
        AND NULLIF(btrim(d.verification_proof_digest), '') IS NOT NULL
        AND d.lease_expires_at > statement_timestamp()
        AND d.environment <> 'unclassified'
        AND d.last_refresh_at > statement_timestamp() - interval '15 minutes'
    ),
    inserted AS (
      INSERT INTO skipo_ecosystem.deployment_capability_revisions
        (deployment_id, revision, descriptors)
      SELECT $1::uuid, COALESCE((SELECT revision FROM latest), 0) + 1, $2::jsonb
      FROM eligible
      WHERE NOT EXISTS (SELECT 1 FROM latest WHERE descriptors = $2::jsonb)
      RETURNING revision
    )
    SELECT revision FROM inserted
    UNION ALL
    SELECT latest.revision
    FROM latest
    JOIN eligible ON true
    WHERE latest.descriptors = $2::jsonb
    LIMIT 1
  `, [deploymentId, JSON.stringify(normalized)]);
  return row ? Number(row.revision) : null;
}

/** Returns only the latest snapshot for a verified deployment with a live lease. */
export async function getDeploymentCapabilityRevision(
  query: Query, appId: string, deploymentId: string,
  environment: 'development' | 'preview' | 'staging' | 'production',
) {
  const [row] = await query<{
    app_id: string; environment: string; revision: number | string;
    descriptors: StaticCapabilityDescriptor[]; published_at: string;
  }>(`
    SELECT d.app_id, d.environment, r.revision, r.descriptors, r.published_at
    FROM skipo_ecosystem.deployments d
    JOIN public."ultrst-apps" apps ON apps.app_id = d.app_id AND apps.status = 'active'
    JOIN LATERAL (
      SELECT revision, descriptors, published_at
      FROM skipo_ecosystem.deployment_capability_revisions
      WHERE deployment_id = d.deployment_id
      ORDER BY revision DESC
      LIMIT 1
    ) r ON true
    WHERE d.app_id = $1
      AND d.deployment_id = $2::uuid
      AND d.environment = $3
      AND d.verification_state = 'verified'
      AND NULLIF(btrim(d.verification_proof_digest), '') IS NOT NULL
      AND d.lease_expires_at > statement_timestamp()
      AND d.last_refresh_at > statement_timestamp() - interval '15 minutes'
    LIMIT 1
  `, [appId, deploymentId, environment]);
  return row ? { ...row, descriptors: normalizeStaticCapabilityDescriptors(row.descriptors) } : undefined;
}

export async function findDeployment(query: Query, app: string, capability: string) {
  const [row] = await query<{ app_url: string }>(`
    SELECT app_url FROM skipo_ecosystem.deployments
    WHERE app_id = $1 AND $2 = ANY(capabilities)
      AND verification_state = 'unverified'
      AND last_refresh_at > statement_timestamp() - interval '15 minutes'
    ORDER BY last_refresh_at DESC, app_url ASC LIMIT 1
  `, [app, capability]);
  return row?.app_url;
}

/**
 * Staged proof/lease-qualified deployment resolution for identity-aware callers.
 * A proof digest alone does not establish ownership: only the separately verified
 * registry writer may set verified state. Caller authorization and workspace
 * grants MUST be rechecked at the selected target before invoking a capability.
 *
 * Existing findDeployment stays intact for the approved legacy transition.
 */
export async function findVerifiedDeployment(
  query: Query,
  app: string,
  capability: string,
  environment: 'development' | 'preview' | 'staging' | 'production',
): Promise<{ deploymentId: string; url: string } | null> {
  // Never use legacy deployments.capabilities to discover a verified method:
  // it may contain operations withdrawn by a newer immutable snapshot.
  const resolved = await resolveVerifiedCapabilityDeployment(query, app, capability, environment);
  return resolved ? { deploymentId: resolved.deploymentId, url: resolved.url } : null;
}


/**
 * Resolve only a capability in the CURRENT, complete, immutable snapshot of
 * a proof-qualified deployment. Pinning a revision rejects stale callers
 * rather than executing an operation removed by a later publication.
 *
 * This is the trusted-discovery path. Legacy findDeployment stays available
 * only for explicitly unverified compatibility consumers during cutover.
 */
export async function resolveVerifiedCapabilityDeployment(
  query: Query,
  appId: string,
  capabilityId: string,
  environment: 'development' | 'preview' | 'staging' | 'production',
  revision?: number,
): Promise<{
  deploymentId: string; url: string; revision: number;
  descriptor: StaticCapabilityDescriptor;
} | null> {
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(appId) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,127}$/.test(capabilityId) ||
      !['development', 'preview', 'staging', 'production'].includes(environment) ||
      (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 1))) {
    throw new Error('Invalid verified capability target selector.');
  }
  const [row] = await query<{
    deployment_id: string; app_url: string; revision: number | string;
    descriptor: StaticCapabilityDescriptor;
  }>(`
    SELECT d.deployment_id::text AS deployment_id, d.app_url, r.revision,
           matched.descriptor
    FROM skipo_ecosystem.deployments d
    JOIN public."ultrst-apps" apps ON apps.app_id = d.app_id AND apps.status = 'active'
    JOIN LATERAL (
      SELECT revision, descriptors
      FROM skipo_ecosystem.deployment_capability_revisions
      WHERE deployment_id = d.deployment_id
      ORDER BY revision DESC
      LIMIT 1
    ) r ON true
    JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.descriptors) = 'array'
        THEN r.descriptors ELSE '[]'::jsonb END
    ) AS matched(descriptor) ON matched.descriptor->>'id' = $2
    WHERE COALESCE((matched.descriptor->>'discoverable')::boolean, true)
      AND d.app_id = $1
      AND d.environment = $3
      AND ($4::bigint IS NULL OR r.revision = $4::bigint)
      AND d.verification_state = 'verified'
      AND NULLIF(btrim(d.verification_proof_digest), '') IS NOT NULL
      AND d.lease_expires_at > statement_timestamp()
      AND d.last_refresh_at > statement_timestamp() - interval '15 minutes'
    ORDER BY d.last_refresh_at DESC, d.deployment_id ASC
    LIMIT 1
  `, [appId, capabilityId, environment, revision ?? null]);
  if (!row) return null;
  const [descriptor] = normalizeStaticCapabilityDescriptors([row.descriptor]);
  if (!descriptor || descriptor.id !== capabilityId) {
    throw new Error('Registry returned an invalid capability descriptor.');
  }
  const currentRevision = Number(row.revision);
  if (!Number.isSafeInteger(currentRevision) || currentRevision < 1) {
    throw new Error('Registry returned an invalid capability revision.');
  }
  return {
    deploymentId: row.deployment_id, url: validatedDeploymentOrigin(row.app_url),
    revision: currentRevision, descriptor,
  };
}

export async function createInvocation(
  query: Query, caller: string, target: string, url: string, capability: string,
  userId: string | null, params: string,
) {
  const id = crypto.randomUUID();
  await query(`
    INSERT INTO skipo_ecosystem.invocations
      (id, caller_app, target_app, target_url, capability, user_id, params, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, statement_timestamp() + interval '30 seconds')
  `, [id, caller, target, url, capability, userId, params]);
  return id;
}

export interface Invocation {
  caller_app: string;
  user_id: string | null;
  capability: string;
  params: unknown;
}

export async function consumeInvocation(query: Query, id: string, app: string, url: string) {
  const [invocation] = await query<Invocation>(`
    DELETE FROM skipo_ecosystem.invocations AS pending
    USING skipo_ecosystem.deployments AS target
    WHERE pending.id = $1::uuid
      AND pending.target_app = $2 AND pending.target_url = $3
      AND pending.expires_at > statement_timestamp()
      AND target.app_id = pending.target_app
      AND target.app_url = pending.target_url
      AND target.verification_state = 'unverified'
      AND target.last_refresh_at > statement_timestamp() - interval '15 minutes'
    RETURNING pending.caller_app, pending.user_id, pending.capability, pending.params
  `, [id, app, url]);
  return invocation;
}
