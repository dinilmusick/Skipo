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

    const mutation: WorkspaceMutation = body.mutation || body;
    const baseRevision = typeof body.baseRevision === 'number' ? body.baseRevision : (mutation.baseRevision || 0);

    const result = await applyWorkspaceMutations(workspaceId, baseRevision, [mutation]);

    if (!result.success) {
      return NextResponse.json(result, { status: 409 });
    }

    // Broadcast granular delta event via realtime bus
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
