/**
 * Proof-of-origin endpoint for a persistently provisioned backend deployment.
 * This is not authentication; a private registrar must first verify Luth owner
 * authority, registered origin and exact app/deployment/environment binding.
 */
import { validatedDeploymentOrigin, type EcosystemEnv } from './deploymentStore_Impure.js';

export type DeploymentEnvironment = 'development' | 'preview' | 'staging' | 'production';
export const deploymentProofPath = '/api/ecosystem/deployment-proof';
const noncePattern = /^[0-9a-f]{64}$/;

export interface DeploymentProofContext {
  appId: string;
  deploymentId?: string;
  environment?: DeploymentEnvironment;
}

/** Challenge response is visible but contains no bearer, secret, token or grant. */
export function handleDeploymentProof(
  request: Request, env: EcosystemEnv, context: DeploymentProofContext,
): Response | null {
  const target = new URL(request.url);
  if (target.pathname !== deploymentProofPath) return null;
  const reject = () => Response.json({ error: 'PROOF_NOT_AVAILABLE' }, {
    status: 404, headers: { 'cache-control': 'no-store' },
  });
  const nonce = target.searchParams.get('nonce');
  if (request.method !== 'GET' || target.searchParams.size !== 1 ||
      !nonce || !noncePattern.test(nonce) ||
      !context.deploymentId || !context.environment ||
      typeof env.APP_URL !== 'string') return reject();
  try {
    if (validatedDeploymentOrigin(env.APP_URL) !== target.origin) return reject();
  } catch {
    return reject();
  }
  return Response.json({
    appId: context.appId,
    deploymentId: context.deploymentId,
    environment: context.environment,
    origin: target.origin,
    nonce,
  }, { headers: { 'cache-control': 'no-store' } });
}
