import { NextRequest, NextResponse } from 'next/server';
import { verifySession, findUserByIdAsync, loadUsersAsync, normalizeUserAccount, APP_ID } from '@/lib/auth-storage';
import { persistUserToCluster, syncRedundantDatabases } from '@/lib/control-plane';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/auth/app-profile?appId=<appId>
 * Fetches the app-specific profile object for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetAppId = (searchParams.get('appId') || APP_ID).trim().toLowerCase();

  const user = await findUserByIdAsync(session.userId);
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
}

/**
 * PUT /api/auth/app-profile
 * Upserts / updates the app-specific profile object for the authenticated user.
 * Body: { appId: string, profile: Record<string, any>, merge?: boolean }
 */
export async function PUT(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetAppId = (body.appId || APP_ID).trim().toLowerCase();
    const profileUpdates = body.profile || {};
    const shouldMerge = body.merge !== false; // default true

    if (!targetAppId || typeof profileUpdates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid appId or profile object' },
        { status: 400 }
      );
    }

    const users = await loadUsersAsync();
    const userIndex = users.findIndex((u) => u.id === session.userId);
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
    syncRedundantDatabases(session.userId).catch((err) => {
      console.warn('[CLUSTER_SYNC_WARN] Background sync error:', err.message);
    });

    return NextResponse.json({
      success: true,
      userId: user.id,
      appId: targetAppId,
      profile: updatedProfile,
      message: `App profile [${targetAppId}] successfully saved.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'FAILED_TO_UPDATE_PROFILE' },
      { status: 500 }
    );
  }
}
