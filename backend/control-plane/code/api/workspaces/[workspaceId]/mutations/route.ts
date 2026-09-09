import { NextResponse } from 'next/server';
import { resolveRequestContextVault } from '@/lib/auth-storage';
import { applyWorkspaceMutations } from '@/lib/mutations/mutation-applier';
import { publishRealtimeEvent } from '@/lib/realtime-events';
import { WorkspaceMutation } from '@/lib/mutations/mutation-types';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-workspaces-mutations-post',
  method: 'POST',
  auth: { required: true },
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 1024 * 1024 },
  handler: async (req, { body, params }) => {
    await resolveRequestContextVault(req);
    const workspaceId = params.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'MISSING_WORKSPACE_ID' }, { status: 400 });
    }

    const payload = body || {};
    const mutation: WorkspaceMutation = payload.mutation || payload;
    const baseRevision = typeof payload.baseRevision === 'number' ? payload.baseRevision : (mutation.baseRevision || 0);

    const result = await applyWorkspaceMutations(workspaceId, baseRevision, [mutation]);

    if (!result.success) {
      return NextResponse.json(result, { status: 409 });
    }

    publishRealtimeEvent({
      workspaceId,
      source: 'api',
      method: 'POST',
      endpoint: `/api/workspaces/${workspaceId}/mutations`,
      action: 'MUTATION_APPLIED',
      details: `Mutated ${mutation.entity} (${mutation.entityId})`,
      payload: {
        mutationId: mutation.mutationId,
        entity: mutation.entity,
        entityId: mutation.entityId,
        operation: mutation.operation,
        patch: mutation.patch,
        revision: result.newRevision,
      },
    });

    return NextResponse.json(result, { status: 200 });
  },
});
