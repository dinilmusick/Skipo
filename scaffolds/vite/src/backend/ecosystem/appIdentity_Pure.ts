export const appId = 'my-app';

export function workspaceEnvironment(env?: Record<string, unknown>) {
  return { ...env, WORKSPACE_APP_ID: appId };
}
