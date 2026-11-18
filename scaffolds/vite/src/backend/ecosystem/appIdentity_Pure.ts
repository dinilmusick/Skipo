// Skipo CLI replaces these placeholders from .skipo/project.json during create/repair.
export const appId = '';
export const appRegistrationStatus = 'pending_enrollment';
export const deploymentId: string | null = null;
export const oauthClientId: string | null = null;

export function workspaceEnvironment(env?: Record<string, unknown>) {
  const resolvedDeploymentId = deploymentId ?? (typeof env?.SKIPO_DEPLOYMENT_ID === 'string' ? env.SKIPO_DEPLOYMENT_ID : undefined);
  const resolvedOauthClientId = oauthClientId ?? (typeof env?.LUTH_OAUTH_CLIENT_ID === 'string' ? env.LUTH_OAUTH_CLIENT_ID : undefined);
  return {
    ...env,
    WORKSPACE_APP_ID: appId,
    ...(resolvedDeploymentId ? { SKIPO_DEPLOYMENT_ID: resolvedDeploymentId } : {}),
    ...(resolvedOauthClientId ? { LUTH_OAUTH_CLIENT_ID: resolvedOauthClientId } : {}),
  };
}
