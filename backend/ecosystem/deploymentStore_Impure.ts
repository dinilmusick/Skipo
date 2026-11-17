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
