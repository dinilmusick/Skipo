import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LUTH_URL } from '@ultrst-armada/kloks/auth';

/** Compatibility proxy only. Registration and credential creation belong to Luth. */
export async function POST(req: NextRequest) {
  try {
    const upstream = await fetch(`${DEFAULT_LUTH_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-id': req.nextUrl.host,
        ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie')! } : {}),
        ...(req.headers.get('origin') ? { origin: req.headers.get('origin')! } : {}),
      },
      body: JSON.stringify(await req.json()),
      redirect: 'manual',
      cache: 'no-store',
    });
    const headers = new Headers();
    for (const name of ['content-type', 'set-cookie', 'set-auth-token', 'location', 'cache-control']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Canonical Luth authentication service unavailable.' },
      { status: 503 },
    );
  }
}
