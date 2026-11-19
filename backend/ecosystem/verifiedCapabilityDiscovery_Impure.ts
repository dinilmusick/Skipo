/**
 * Server-only discovery adapter shared by Kloks and application backends.
 * The caller supplies a Luth-authenticated policy; registry rows and
 * APP_URL are never themselves authorization to enumerate or invoke.
 */
import {
  normalizeStaticCapabilityDescriptors, resolveVerifiedCapabilityDeployment,
  validStaticHandle,
  type Query, type StaticCapabilityDescriptor,
} from './deploymentStore_Impure.js';

export type RegistryEnvironment = 'development' | 'preview' | 'staging' | 'production';
export interface CapabilitySelector {
  appId: string;
  capabilityId: string;
  environment: RegistryEnvironment;
  revision?: number;
  /** Pin the exact attested target instance, not just app and revision. */
  deploymentId?: string;
}
export interface AuthenticatedDiscoveryIdentity {
  userId: string;
  sessionId: string;
  callerAppId: string;
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
}
export interface ResolvedRegistryCapability {
  deploymentId: string;
  url: string;
  revision: number;
  descriptor: StaticCapabilityDescriptor;
}
export interface VerifiedDiscoveryPolicy {
  /** Must independently verify a LIVE Luth session and current workspace. */
  authenticate: (request: Request, appId: string, environment: RegistryEnvironment) =>
    Promise<AuthenticatedDiscoveryIdentity | null>;
  /** Recheck caller, target app, both workspaces, grant, scope and operation. */
  authorize: (request: Request, identity: AuthenticatedDiscoveryIdentity,
    selector: CapabilitySelector, deployment: ResolvedRegistryCapability) => Promise<boolean>;
}

const appIdPattern = /^[a-z][a-z0-9-]{0,62}$/;
const deploymentPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const environments = new Set<RegistryEnvironment>(['development', 'preview', 'staging', 'production']);

function validateApp(appId: string, environment: RegistryEnvironment): void {
  if (typeof appId !== 'string' || !appIdPattern.test(appId) ||
      !environments.has(environment)) {
    throw new Error('Invalid verified registry application/environment selector.');
  }
}
function validateSelector(value: CapabilitySelector): void {
  if (!value) throw new Error('Verified registry selector is required.');
  validateApp(value.appId, value.environment);
  if (!validStaticHandle(value.capabilityId) ||
      (value.revision !== undefined &&
        (!Number.isSafeInteger(value.revision) || value.revision < 1)) ||
      (value.deploymentId !== undefined && !deploymentPattern.test(value.deploymentId))) {
    throw new Error('Invalid verified registry operation/revision selector.');
  }
}
function boundIdentity(identity: AuthenticatedDiscoveryIdentity | null): string | null {
  if (!identity) return null;
  const fields = [identity.userId, identity.sessionId, identity.callerAppId,
    identity.sourceWorkspaceId, identity.targetWorkspaceId];
  return fields.every(value => typeof value === 'string' && value.trim().length > 0)
    ? JSON.stringify(fields) : null;
}

/** No anonymous fallback. The same live principal must pass both sides of DB lookup. */
export function createVerifiedCapabilityDiscovery(query: Query, policy: VerifiedDiscoveryPolicy) {
  if (typeof query !== 'function' || !policy ||
      typeof policy.authenticate !== 'function' ||
      typeof policy.authorize !== 'function') {
    throw new Error('Trusted Luth discovery policy and registry query are required.');
  }

  async function resolve(request: Request, selector: CapabilitySelector):
    Promise<ResolvedRegistryCapability | null> {
    validateSelector(selector);
    const initial = await policy.authenticate(request, selector.appId, selector.environment);
    const initialBinding = boundIdentity(initial);
    if (!initialBinding) return null;
    const found = await resolveVerifiedCapabilityDeployment(query, selector.appId,
      selector.capabilityId, selector.environment, selector.revision,
      selector.deploymentId);
    if (!found) return null;
    const current = await policy.authenticate(request, selector.appId, selector.environment);
    if (boundIdentity(current) !== initialBinding || !current) return null;
    if (!await policy.authorize(request, current, selector, found)) return null;
    return found;
  }

  async function list(request: Request, appId: string, environment: RegistryEnvironment):
    Promise<ResolvedRegistryCapability[]> {
    validateApp(appId, environment);
    if (!boundIdentity(await policy.authenticate(request, appId, environment))) return [];
    // Candidate rows are never returned directly: each one is independently
    // resolved at the current revision and checked against live Luth/grants.
    const rows = await query<{
      deployment_id: string; revision: number | string;
      descriptor: StaticCapabilityDescriptor;
    }>([
      'SELECT d.deployment_id::text AS deployment_id, r.revision, matched.descriptor',
      'FROM skipo_ecosystem.deployments d',
      'JOIN public."ultrst-apps" apps ON apps.app_id=d.app_id AND apps.status=\'active\'',
      'JOIN LATERAL (SELECT revision, descriptors FROM',
      'skipo_ecosystem.deployment_capability_revisions',
      'WHERE deployment_id=d.deployment_id ORDER BY revision DESC LIMIT 1) r ON true',
      'JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.descriptors)=\'array\'',
      'THEN r.descriptors ELSE \'[]\'::jsonb END) matched(descriptor) ON true',
      'WHERE d.app_id=$1 AND d.environment=$2 AND d.verification_state=\'verified\'',
      'AND NULLIF(btrim(d.verification_proof_digest), \'\') IS NOT NULL',
      'AND d.lease_expires_at > statement_timestamp()',
      'AND d.last_refresh_at > statement_timestamp() - interval \'15 minutes\'',
      'ORDER BY d.last_refresh_at DESC, d.deployment_id ASC LIMIT 64',
    ].join(' '), [appId, environment]);
    const result: ResolvedRegistryCapability[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const [descriptor] = normalizeStaticCapabilityDescriptors([row.descriptor]);
      if (descriptor.discoverable === false || seen.has(descriptor.id)) continue;
      const revision = Number(row.revision);
      if (!Number.isSafeInteger(revision) || revision < 1) {
        throw new Error('Invalid verified registry revision.');
      }
      const selected = await resolve(request, {
        appId, capabilityId: descriptor.id, environment, revision,
        deploymentId: row.deployment_id,
      });
      if (selected && selected.deploymentId === row.deployment_id) {
        result.push(selected);
        seen.add(descriptor.id);
      }
    }
    return result.sort((a, b) => a.descriptor.id.localeCompare(b.descriptor.id));
  }

  // Invoke paths must call revalidate again with the exact discovered revision
  // before their separate Kloks/Luth target-side execution authorization.
  return { resolve, revalidate: resolve, list };
}
