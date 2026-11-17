import { ecosystem } from '@/src/backend/ecosystem/AppEcosystem_Impure';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  await ecosystem.observe(process.env);
  return (await ecosystem.handle(request, process.env)) ?? new Response(null, { status: 404 });
}
