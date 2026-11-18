// Skipo CLI replaces these placeholders from .skipo/project.json during create/repair.
export const appId = '';
export const appRegistrationStatus = 'pending_enrollment';
export const deploymentId: string | null = null;
export const oauthClientId: string | null = null;

export function workspaceEnvironment(env?: Record<string, unknown>) {
  return {
    ...env,
    WORKSPACE_APP_ID: appId,
    SKIPO_DEPLOYMENT_ID: deploymentId ?? undefined,
    LUTH_OAUTH_CLIENT_ID: oauthClientId ?? undefined,
  };
}
