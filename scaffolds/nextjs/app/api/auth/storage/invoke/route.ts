import { NextRequest, NextResponse } from 'next/server';
import { getLuthSession } from '@/src/backend/auth/luthSession';
import { invokeStorage } from '@/src/backend/storage/canonicalCapabilityRoutes';

/** Explicit browser-safe Kloks RPC, never an unrestricted server service proxy. */
export async function POST(req: NextRequest) {
  const session = await getLuthSession(req);
  if (!session) return NextResponse.json({ success: false, error: 'Verified Luth session required.' }, { status: 401 });
  try {
    const body = await req.json();
    if (body?.operation === 'createGoogleDriveAuthorizationRequest') {
      const origin = new URL(req.url).origin;
      if (body?.input?.callbackOrigin !== origin ||
          typeof body?.input?.returnTo !== 'string' ||
          new URL(body.input.returnTo, origin).origin !== origin) {
        return NextResponse.json({ success: false, error: 'OAuth callback origin mismatch.' }, { status: 400 });
      }
    }
    const result = await invokeStorage(session.user.id, body?.operation, body?.input, process.env);
    return NextResponse.json(result);
  } catch (cause) {
    return NextResponse.json({ success: false, error: cause instanceof Error ? cause.message : 'Storage operation failed.' }, { status: 400 });
  }
}
