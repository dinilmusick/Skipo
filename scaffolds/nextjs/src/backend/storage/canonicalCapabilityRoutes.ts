import { StorageServiceFacade, WorkspaceServiceFacade } from '@ultrst-armada/kloks/backend/krnl-services';

/** Thin application adapters: Kloks is the only implementation of workspace/storage operations. */
export const BROWSER_STORAGE_OPERATIONS = Object.freeze([
  'getProviderCapabilities',
  'getConnections',
  'testBackblazeCredentials',
  'createBackblazeConnection',
  'listBackblazeConnectionBuckets',
  'createGoogleDriveAuthorizationRequest',
  'listGoogleDriveFolders',
  'getGoogleDriveAccountIdentity',
  'selectGoogleDriveRootFolder',
  'testGoogleDriveConnection',
] as const);

export async function listWorkspaces(userId: string, env?: Record<string, unknown>) {
  if (!userId) throw new Error('Verified Luth identity required.');
  return WorkspaceServiceFacade.execute('listWorkspaces', { userId, env });
}

export async function createWorkspace(userId: string, workspace: unknown, env?: Record<string, unknown>) {
  if (!userId) throw new Error('Verified Luth identity required.');
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace) ||
      typeof (workspace as { name?: unknown }).name !== 'string' ||
      !(workspace as { name: string }).name.trim()) {
    throw new Error('Workspace name is required.');
  }
  // Never persist a client-supplied owner or application environment alongside a workspace.
  const { userId: _ignoredUser, ownerUserId: _ignoredOwner, env: _ignoredEnv, ...safeWorkspace } = workspace as Record<string, unknown>;
  return WorkspaceServiceFacade.execute('createWorkspace', { userId, workspace: safeWorkspace, env });
}

export async function invokeStorage(
  userId: string,
  operation: string,
  input: unknown,
  env?: Record<string, unknown>,
) {
  if (!userId) throw new Error('Verified Luth identity required.');
  if (!(BROWSER_STORAGE_OPERATIONS as readonly string[]).includes(operation)) {
    throw new Error('Storage operation is not available to browsers.');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Storage operation input must be an object.');
  }
  // Discard any untrusted userId/env override before delegating to canonical Kloks.
  const { userId: _ignoredUser, env: _ignoredEnv, ...safeInput } = input as Record<string, unknown>;
  return StorageServiceFacade.execute(operation, { ...safeInput, userId, env });
}
