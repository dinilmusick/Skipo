import { NextResponse } from 'next/server';
import { findUserByIdAsync, loadUsersAsync, normalizeUserAccount, APP_ID } from '@/lib/auth-storage';
import { persistUserToCluster, syncRedundantDatabases } from '@/lib/control-plane';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/auth/app-profile?appId=<appId>
 * Fetches the app-specific profile object for the authenticated user.
 */
export const GET = createSecureRoute({
  id: 'api-auth-app-profile-get',
  method: 'GET',
  auth: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (_req, { session, query }) => {
    const targetAppId = (query.get('appId') || APP_ID).trim().toLowerCase();

    const user = await findUserByIdAsync(session!.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const normalized = normalizeUserAccount(user);
    const appProfiles = normalized.appProfiles || {};
    const appProfile = appProfiles[targetAppId] || null;

    return NextResponse.json({
      success: true,
      userId: user.id,
      appId: targetAppId,
      profile: appProfile,
      allAppIds: Object.keys(appProfiles),
    });
  },
});

/**
 * PUT /api/auth/app-profile
 * Upserts / updates the app-specific profile object for the authenticated user.
 * Body: { appId: string, profile: Record<string, any>, merge?: boolean }
 */
export const PUT = createSecureRoute({
  id: 'api-auth-app-profile-put',
  method: 'PUT',
  auth: true,
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 128 * 1024 },
  handler: async (_req, { session, body }) => {
    const targetAppId = (body?.appId || APP_ID).trim().toLowerCase();
    const profileUpdates = body?.profile || {};
    const shouldMerge = body?.merge !== false; // default true

    if (!targetAppId || typeof profileUpdates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid appId or profile object' },
        { status: 400 }
      );
    }

    const users = await loadUsersAsync();
    const userIndex = users.findIndex((u) => u.id === session!.userId);
    if (userIndex === -1) {
      return NextResponse.json({ success: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const user = normalizeUserAccount(users[userIndex]);
    const appProfiles = user.appProfiles || {};
    const existingProfile = appProfiles[targetAppId] || {};

    const updatedProfile = shouldMerge
      ? { ...existingProfile, ...profileUpdates, lastActiveAt: new Date().toISOString() }
      : { ...profileUpdates, lastActiveAt: new Date().toISOString() };

    appProfiles[targetAppId] = updatedProfile;
    user.appProfiles = appProfiles;
    user.updatedAt = new Date().toISOString();

    // If updating docustack profile, sync top-level workspace accessors
    if (targetAppId === APP_ID) {
      if (updatedProfile.workspacePath) user.workspacePath = updatedProfile.workspacePath;
      if (updatedProfile.workspaceName) user.workspaceName = updatedProfile.workspaceName;
      if (updatedProfile.activeWorkspaceId) user.activeWorkspaceId = updatedProfile.activeWorkspaceId;
      if (updatedProfile.workspaces) user.workspaces = updatedProfile.workspaces;
    }

    await persistUserToCluster(user);

    // Sync redundant cluster in background
    syncRedundantDatabases(session!.userId).catch((err) => {
      console.warn('[CLUSTER_SYNC_WARN] Background sync error:', err.message);
    });

    return NextResponse.json({
      success: true,
      userId: user.id,
      appId: targetAppId,
      profile: updatedProfile,
      message: `App profile [${targetAppId}] successfully saved.`,
    });
  },
});

