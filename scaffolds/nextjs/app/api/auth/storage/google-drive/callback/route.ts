import { NextRequest, NextResponse } from 'next/server';
import { getLuthSession } from '@/src/backend/auth/luthSession';
import { completeGoogleDriveOAuth } from '@/src/backend/storage/canonicalCapabilityRoutes';

/** Luth owner + signed Kloks state + HttpOnly nonce must all agree before code exchange. */
export async function GET(req: NextRequest) {
  const session = await getLuthSession(req);
  if (!session) return NextResponse.json({ success: false, error: 'Verified Luth session required.' }, { status: 401 });
  const origin = new URL(req.url).origin;
  try {
    const query = new URL(req.url).searchParams;
    const value = await completeGoogleDriveOAuth(
      session.user.id, query.get('state') || '',
      req.cookies.get('skipo_google_drive_nonce')?.value || '',
      query.get('code') || '', origin, process.env,
    );
    const destination = new URL(value.returnTo);
    destination.searchParams.set('googleDriveConnected', '1');
    destination.searchParams.set('googleDriveConnectionId', value.connectionId);
    const response = NextResponse.redirect(destination.toString(), { status: 303 });
    response.cookies.delete('skipo_google_drive_nonce');
    return response;
  } catch (cause) {
    const response = NextResponse.json({
      success: false,
      error: cause instanceof Error ? cause.message : 'Google Drive authorization failed.',
    }, { status: 400 });
    response.cookies.delete('skipo_google_drive_nonce');
    return response;
  }
}
