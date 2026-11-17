import { NextResponse } from 'next/server';
import { ecosystem } from '@/src/backend/ecosystem/AppEcosystem_Impure';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ecosystem.observe(process.env);
  return NextResponse.json({
    status: 'ok',
    service: 'my-app',
    runtime: 'nextjs',
    timestamp: new Date().toISOString(),
  });
}
