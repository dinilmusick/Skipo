import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth-storage';
import { resolveRequestContextVault } from '@/lib/auth-storage';
import { applyWorkspaceMutations } from '@/lib/mutations/mutation-applier';
import { publishRealtimeEvent } from '@/lib/realtime-events';
import { WorkspaceMutation } from '@/lib/mutations/mutation-types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    await resolveRequestContextVault(req);
    const { workspaceId } = await params;
    const body = await req.json();

    const mutations: WorkspaceMutation[] = body.mutations || [];
    const baseRevision = typeof body.baseRevision === 'number' ? body.baseRevision : 0;

    if (!Array.isArray(mutations) || mutations.length === 0) {
      return NextResponse.json({ success: false, error: 'NO_MUTATIONS_PROVIDED' }, { status: 400 });
    }

    const result = await applyWorkspaceMutations(workspaceId, baseRevision, mutations);

    if (!result.success) {
      return NextResponse.json(result, { status: 409 });
    }

    // Broadcast batch delta event
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
