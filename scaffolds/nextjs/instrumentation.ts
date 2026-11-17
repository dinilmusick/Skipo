export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { ecosystem } = await import('./src/backend/ecosystem/AppEcosystem_Impure');
  if (process.env.VERCEL_ENV) await ecosystem.observe(process.env);
  else await ecosystem.start(process.env);
}
