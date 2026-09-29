/**
 * @file workspaceCore.ts
 * @description Universal Workspace Core Service for MyApp.
 * Governs workspaces CRUD and active workspace selection.
 * Runs identically in Node.js, Vercel Serverless, and Cloudflare Workers (< 200 lines).
 */

import { queryUnifiedDb } from './unifiedDb';

export const APP_WORKSPACE_KEY = 'myapp';

export async function getWorkspaces(userId?: string, env?: Record<string, unknown>) {
  let userRow: any = null;
  if (userId) {
    const res = await queryUnifiedDb(`SELECT * FROM "ultrst-users" WHERE id = $1`, [userId], env);
    if (res.rows.length > 0) userRow = res.rows[0];
  }
  if (!userRow) {
    userRow = (await queryUnifiedDb(`SELECT * FROM "ultrst-users" ORDER BY created_at ASC LIMIT 1`, [], env)).rows[0];
  }
  if (!userRow) return { success: true, workspaces: [], activeWorkspaceId: null, storage_connections: [] };

  const profiles = typeof userRow.app_profiles === 'string' ? JSON.parse(userRow.app_profiles) : (userRow.app_profiles || {});
  const appProfile = profiles[APP_WORKSPACE_KEY] || {};
  const workspaces = Array.isArray(appProfile.workspaces) ? appProfile.workspaces : [];
  const activeWorkspaceId = appProfile.activeWorkspaceId || workspaces[0]?.id || null;
  const conns = appProfile.storage_connections?.length
    ? appProfile.storage_connections
    : (profiles.srkl?.storage_connections || profiles.depm?.storage_connections || []);

  return { success: true, workspaces, activeWorkspaceId, storage_connections: conns };
}

export async function createWorkspace(userId: string, wsData: any, env?: Record<string, unknown>) {
  const uRes = await queryUnifiedDb(`SELECT * FROM "ultrst-users" WHERE id = $1`, [userId], env);
  const user = uRes.rows[0];
  if (!user) throw new Error('User account not found.');

  const profiles = typeof user.app_profiles === 'string' ? JSON.parse(user.app_profiles) : (user.app_profiles || {});
  if (!profiles[APP_WORKSPACE_KEY]) profiles[APP_WORKSPACE_KEY] = {};
  const workspaces = Array.isArray(profiles[APP_WORKSPACE_KEY].workspaces) ? profiles[APP_WORKSPACE_KEY].workspaces : [];

  const wsName = (wsData.name || 'New Workspace').trim();
  const wsId = wsData.id || `ws-${APP_WORKSPACE_KEY}-${Date.now()}`;
  const userName = user.username || user.name || 'user';
  const folderKey = `ultrst_${APP_WORKSPACE_KEY}_${userName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${wsName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  const newWs = {
    ...wsData,
    id: wsId,
    name: wsName,
    localFolderName: folderKey,
    localFolderKey: folderKey,
    workspacePath: `./${folderKey}`,
    storageProvider: wsData.storageProvider || 'backblaze_b2',
    b2BucketName: wsData.b2BucketName || 'ultrst-apps',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  workspaces.push(newWs);
  profiles[APP_WORKSPACE_KEY].workspaces = workspaces;
  profiles[APP_WORKSPACE_KEY].activeWorkspaceId = wsId;

  await queryUnifiedDb(
    `UPDATE "ultrst-users" SET app_profiles = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(profiles), user.id],
    env
  );
  return { success: true, workspace: newWs, workspaces };
}

export async function setActiveWorkspace(userId: string, targetId: string, env?: Record<string, unknown>) {
  const uRes = await queryUnifiedDb(`SELECT * FROM "ultrst-users" WHERE id = $1`, [userId], env);
  const user = uRes.rows[0];
  if (!user) throw new Error('User account not found.');

  const profiles = typeof user.app_profiles === 'string' ? JSON.parse(user.app_profiles) : (user.app_profiles || {});
  if (!profiles[APP_WORKSPACE_KEY]) profiles[APP_WORKSPACE_KEY] = {};
  const workspaces = Array.isArray(profiles[APP_WORKSPACE_KEY].workspaces) ? profiles[APP_WORKSPACE_KEY].workspaces : [];

  const exists = workspaces.some((w: any) => w.id === targetId);
  if (!exists) throw new Error(`Workspace ${targetId} does not exist`);

  profiles[APP_WORKSPACE_KEY].activeWorkspaceId = targetId;
  await queryUnifiedDb(
    `UPDATE "ultrst-users" SET app_profiles = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(profiles), user.id],
    env
  );
  return { success: true, activeWorkspaceId: targetId };
}
