import { NextRequest, NextResponse } from 'next/server';
import { getLuthSession } from '@/src/backend/auth/luthSession';
import { invokeStorage } from '@/src/backend/storage/canonicalCapabilityRoutes';

export async function GET(req: NextRequest) {
  const session = await getLuthSession(req);
  if (!session) return NextResponse.json({ success: false, error: 'Verified Luth session required.' }, { status: 401 });
  try {
    const connections = await invokeStorage(session.user.id, 'getConnections', {}, process.env);
    return NextResponse.json({ success: true, connections });
  } catch (cause) {
    return NextResponse.json({ success: false, error: cause instanceof Error ? cause.message : 'Storage connection retrieval failed.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getLuthSession(req);
  if (!session) return NextResponse.json({ success: false, error: 'Verified Luth session required.' }, { status: 401 });
  try {
    const input = await req.json();
    if (input?.provider !== 'backblaze_b2') {
      return NextResponse.json({ success: false, error: 'Only canonical Backblaze connection creation is supported here.' }, { status: 422 });
    }
    const result = await invokeStorage(session.user.id, 'createBackblazeConnection', input, process.env);
    return NextResponse.json(result, { status: 201 });
  } catch (cause) {
    return NextResponse.json({ success: false, error: cause instanceof Error ? cause.message : 'Storage connection creation failed.' }, { status: 400 });
  }
}
