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
  const updated = await query<{ deployment_id: string }>(`
    INSERT INTO skipo_ecosystem.deployments (deployment_id, app_id, app_url, capabilities)
    VALUES ($1::uuid, $2, $3, $4::text[])
    ON CONFLICT (deployment_id) DO UPDATE SET
      app_url = EXCLUDED.app_url,
      last_refresh_at = GREATEST(deployments.last_refresh_at, EXCLUDED.last_refresh_at),
      capabilities = EXCLUDED.capabilities
    WHERE deployments.app_id = EXCLUDED.app_id
    RETURNING deployment_id
  `, [deploymentId, app, url, capabilities]);
  if (updated.length !== 1) {
    throw new Error('Deployment identity is already bound to another application.');
  }
}


export interface StaticCapabilityDescriptor {
  id: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  name?: string;
  serviceName?: string;
  invocation: { serviceId: string; operationId: string };
  access?: 'public' | 'authenticated' | 'roles';
  requiredRoles?: string[];
  discoverable?: boolean;
}

const forbiddenDescriptorKey = /(?:secret|token|session|endpoint|url|credential|authorization|password|cookie|bearer)/i;
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
    if (!descriptor || typeof descriptor !== 'object' ||
        Object.keys(descriptor).some((key) => !descriptorKeys.has(key)) ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,127}$/.test(descriptor.id) ||
        typeof descriptor.description !== 'string' || !descriptor.description.trim() ||
        !descriptor.invocation ||
        typeof descriptor.invocation.serviceId !== 'string' || !descriptor.invocation.serviceId.trim() ||
        typeof descriptor.invocation.operationId !== 'string' || !descriptor.invocation.operationId.trim() ||
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
    assertSafeDescriptorValue(descriptor);
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
      SELECT deployment_id
      FROM skipo_ecosystem.deployments
      WHERE deployment_id = $1::uuid
        AND verification_state = 'verified'
        AND lease_expires_at > statement_timestamp()
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
) {
  const [row] = await query<{
    app_id: string; environment: string; revision: number | string;
    descriptors: StaticCapabilityDescriptor[]; published_at: string;
  }>(`
    SELECT d.app_id, d.environment, r.revision, r.descriptors, r.published_at
    FROM skipo_ecosystem.deployments d
    JOIN LATERAL (
      SELECT revision, descriptors, published_at
      FROM skipo_ecosystem.deployment_capability_revisions
      WHERE deployment_id = d.deployment_id
      ORDER BY revision DESC
      LIMIT 1
    ) r ON true
    WHERE d.app_id = $1
      AND d.deployment_id = $2::uuid
      AND d.verification_state = 'verified'
      AND d.lease_expires_at > statement_timestamp()
    LIMIT 1
  `, [appId, deploymentId]);
  return row;
}

export async function findDeployment(query: Query, app: string, capability: string) {
  const [row] = await query<{ app_url: string }>(`
    SELECT app_url FROM skipo_ecosystem.deployments
    WHERE app_id = $1 AND $2 = ANY(capabilities)
      AND last_refresh_at > statement_timestamp() - interval '15 minutes'
    ORDER BY last_refresh_at DESC, app_url ASC LIMIT 1
  `, [app, capability]);
  return row?.app_url;
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
    DELETE FROM skipo_ecosystem.invocations
    WHERE id = $1::uuid AND target_app = $2 AND target_url = $3
      AND expires_at > statement_timestamp()
    RETURNING caller_app, user_id, capability, params
  `, [id, app, url]);
  return invocation;
}
