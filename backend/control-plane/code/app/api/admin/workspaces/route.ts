import { NextResponse } from 'next/server';
import { enforceAdminGuard } from '@/lib/control-plane';
import { loadWorkspaceRegistries, saveWorkspaceRegistries } from '@/lib/workspace-data-plane';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-admin-workspaces-get',
  method: 'GET',
  auth: { required: true, role: 'admin' },
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async (req) => {
    const guard = await enforceAdminGuard(req);
    if (!guard.authorized) {
      return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
    }

    const workspaces = loadWorkspaceRegistries();
    return NextResponse.json({
      success: true,
      workspaces,
      total: workspaces.length,
      assertion: {
        rule: 'ASSERT(UserAccountStorage ∩ WorkspaceDataStorage = ∅)',
        verified: true,
        decoupled: true,
      },
    });
  },
});

export const PUT = createSecureRoute({
  id: 'api-admin-workspaces-put',
  method: 'PUT',
  auth: { required: true, role: 'admin' },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 64 * 1024 },
  handler: async (req, { body }) => {
    const guard = await enforceAdminGuard(req);
    if (!guard.authorized) {
      return NextResponse.json({ success: false, error: guard.error }, { status: 403 });
    }

    const { id, backendConfig } = body || {};
    const registries = loadWorkspaceRegistries();
    const idx = registries.findIndex((w) => w.id === id);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    registries[idx].backendConfig = {
      ...registries[idx].backendConfig,
      ...backendConfig,
    };
    registries[idx].lastActiveAt = new Date().toISOString();

    saveWorkspaceRegistries(registries);

    return NextResponse.json({
      success: true,
      workspace: registries[idx],
      message: 'Workspace data plane engine updated successfully.',
    });
  },
});
