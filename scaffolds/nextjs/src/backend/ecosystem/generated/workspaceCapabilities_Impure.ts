import { StorageServiceFacade, WorkspaceServiceFacade } from '@ultrst-armada/kloks/backend/krnl-services';

export function workspaceCapabilities(appId: string) {
  return {
    listWorkspaces: async (_params: unknown, context: {
      userId: string; env: Record<string, unknown>;
    }) => {
      const result = await WorkspaceServiceFacade.execute('listWorkspaces', {
        userId: context.userId, env: { ...context.env, WORKSPACE_APP_ID: appId },
      }) as { success?: boolean; workspaces?: Array<{ id: string; name: string }> };
      if (result.success === false || !Array.isArray(result.workspaces)) {
        throw new Error('Canonical workspace listing failed.');
      }
      return result.workspaces.map(({ id, name }) => ({ id, name }));
    },
  };
}

export const workspaceServiceCapabilities = {
  listStorageProviders: async (_params: unknown, { env }: { env: Record<string, unknown> }) =>
    StorageServiceFacade.execute('getProviderCapabilities', { env }),
};
