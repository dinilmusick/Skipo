import { NextRequest, NextResponse } from 'next/server';
import { appBackend } from '@/src/backend/AppBackend';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await appBackend.services.auth.registerUser(body);
    return NextResponse.json(result, { status: result.status || (result.success ? 201 : 400) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
