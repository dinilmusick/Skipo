import { describe, expect, it, vi } from 'vitest';

const runtimeFactory = vi.hoisted(() => vi.fn(() => {
  throw new Error('Enrollment-required applications must not initialize an enrolled runtime.');
}));

vi.mock('../scaffolds/vite/src/backend/ecosystem/appIdentity_Pure.js', () => ({
  appId: null,
  appIdentityAuthorityVerified: false,
}));

vi.mock('../scaffolds/vite/src/backend/ecosystem/generated/ecosystemRuntime_Impure.js', () => ({
  createEcosystemRuntime: runtimeFactory,
}));

vi.mock('../scaffolds/vite/src/backend/ecosystem/generated/workspaceCapabilities_Impure.js', () => ({
  workspaceCapabilities: vi.fn(() => ({})),
  workspaceServiceCapabilities: {},
}));

vi.mock('../scaffolds/vite/src/backend/auth/luthSession.js', () => ({
  getLuthSession: vi.fn(() => {
    throw new Error('Pending enrollment must not request a Luth session from the ecosystem facade.');
  }),
}));

import { ecosystem } from '../scaffolds/vite/src/backend/ecosystem/AppEcosystem_Impure.js';

describe('pending Skipo application enrollment', () => {
  const env = { APP_URL: 'https://pending.example.test', SYSTEM_DATABASE_URL: 'test-only' };

  it('exports safe lifecycle methods for Cloudflare and Node providers without registration', async () => {
    expect(typeof ecosystem.heartbeat).toBe('function');
    expect(typeof ecosystem.start).toBe('function');
    expect(typeof ecosystem.observe).toBe('function');
    await expect(ecosystem.heartbeat(env, true)).resolves.toBeUndefined();
    await expect(ecosystem.start(env)).resolves.toBeUndefined();
    await expect(ecosystem.observe(env)).resolves.toBeUndefined();
    expect(runtimeFactory).not.toHaveBeenCalled();
  });

  it('denies invocations without activating the enrolled application runtime', async () => {
    const response = await ecosystem.handle(new Request('https://pending.example.test/api/ecosystem/invoke'), env);
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({ error: 'APP_ENROLLMENT_REQUIRED' });
    expect(response?.headers.get('cache-control')).toBe('no-store');
    expect(await ecosystem.handle(new Request('https://pending.example.test/health'), env)).toBeNull();
    expect(runtimeFactory).not.toHaveBeenCalled();
  });
});
