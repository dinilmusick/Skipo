import { NextResponse } from 'next/server';
import { resolveRequestContextVault } from '@/lib/auth-storage';
import { applyWorkspaceMutations } from '@/lib/mutations/mutation-applier';
import { publishRealtimeEvent } from '@/lib/realtime-events';
import { WorkspaceMutation } from '@/lib/mutations/mutation-types';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BULK_SIZE = 50;

export const POST = createSecureRoute({
  id: 'api-workspaces-mutations-batch-post',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: {
    maxBodySize: 2 * 1024 * 1024,
  },
  handler: async (req, { body, params }) => {
    await resolveRequestContextVault(req);
    const workspaceId = params.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'MISSING_WORKSPACE_ID' }, { status: 400 });
    }

    const payload = body || {};
    const mutations: WorkspaceMutation[] = payload.mutations || [];
    const baseRevision = typeof payload.baseRevision === 'number' ? payload.baseRevision : 0;

    if (!Array.isArray(mutations) || mutations.length === 0) {
      return NextResponse.json({ success: false, error: 'NO_MUTATIONS_PROVIDED' }, { status: 400 });
    }

    // Section 7: Enforce MAX_BULK_SIZE limit
    if (mutations.length > MAX_BULK_SIZE) {
      return NextResponse.json({
        success: false,
        error: 'BULK_LIMIT_EXCEEDED',
        message: `Batch mutation size (${mutations.length}) exceeds maximum limit of ${MAX_BULK_SIZE}.`,
      }, { status: 413 });
    }

    const result = await applyWorkspaceMutations(workspaceId, baseRevision, mutations);

    if (!result.success) {
      return NextResponse.json(result, { status: 409 });
    }

    publishRealtimeEvent({
      workspaceId,
      source: 'api',
      method: 'POST',
      endpoint: `/api/workspaces/${workspaceId}/mutations/batch`,
      action: 'MUTATION_BATCH_APPLIED',
      details: `Applied ${mutations.length} mutations in batch`,
      payload: {
        revision: result.newRevision,
        appliedMutationIds: result.appliedMutationIds,
        affectedEntities: result.affectedEntities,
      },
    });

    return NextResponse.json(result, { status: 200 });
  },
});
