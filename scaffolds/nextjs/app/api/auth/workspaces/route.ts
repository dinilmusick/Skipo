import { NextRequest, NextResponse } from 'next/server';
import { getLuthSession } from '@/src/backend/auth/luthSession';
import { listWorkspaces, createWorkspace } from '@/src/backend/storage/canonicalCapabilityRoutes';

export async function GET(req: NextRequest) {
  const session = await getLuthSession(req);
  if (!session) return NextResponse.json({ success: false, error: 'Verified Luth session required.' }, { status: 401 });
  try {
    return NextResponse.json(await listWorkspaces(session.user.id, process.env));
  } catch (cause) {
    return NextResponse.json({ success: false, error: cause instanceof Error ? cause.message : 'Workspace retrieval failed.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getLuthSession(req);
  if (!session) return NextResponse.json({ success: false, error: 'Verified Luth session required.' }, { status: 401 });
  try {
    const input = await req.json();
    const result = await createWorkspace(session.user.id, input, process.env);
    return NextResponse.json(result, { status: 201 });
  } catch (cause) {
    return NextResponse.json({ success: false, error: cause instanceof Error ? cause.message : 'Workspace creation failed.' }, { status: 400 });
  }
}
