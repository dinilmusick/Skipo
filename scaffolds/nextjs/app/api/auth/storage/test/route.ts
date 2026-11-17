import { NextRequest, NextResponse } from 'next/server';
import { getLuthSession } from '@/src/backend/auth/luthSession';
import { invokeStorage } from '@/src/backend/storage/canonicalCapabilityRoutes';

export async function POST(req: NextRequest) {
  const session = await getLuthSession(req);
  if (!session) return NextResponse.json({ success: false, error: 'Verified Luth session required.' }, { status: 401 });
  try {
    const input = await req.json();
    const operation = input?.provider === 'google_drive' ? 'testGoogleDriveConnection' : 'testBackblazeCredentials';
    return NextResponse.json(await invokeStorage(session.user.id, operation, input, process.env));
  } catch (cause) {
    return NextResponse.json({ success: false, error: cause instanceof Error ? cause.message : 'Storage connection test failed.' }, { status: 400 });
  }
}
