import { describe, expect, it, vi } from 'vitest';
import {
  validatedDeploymentOrigin, refreshDeploymentById, type Query,
} from '../backend/ecosystem/deploymentStore_Impure.js';
import { createEcosystemRuntime } from
  '../backend/ecosystem/ecosystemRuntime_Impure.js';
import { createHttpDeploymentProofAuthority } from
  '../backend/ecosystem/httpDeploymentProofAuthority_Impure.js';

const deploymentId = '36f3149f-1243-4a14-8641-dad57e3e6f83';
const invalidOrigins = [
  'https://localhost.',
  'https://127.0.0.1.',
  'https://127.1',
  'https://[::ffff:127.0.0.1]',
  'https://[::1]',
  'https://myapp.localdomain',
  'https://metadata.google.internal',
  'https://myapp.home.arpa',
  'https://abc..example.com',
  'https://aiko.example:8443',
  'http://aiko.example',
  'https://aiko.example/path',
];
describe('public HTTPS origin pinning across all Skipo registry backends', () => {
  it('keeps strict valid origin URLs compatible', () => {
    expect(validatedDeploymentOrigin('https://aiko.example')).toBe('https://aiko.example');
    expect(validatedDeploymentOrigin('https://worker.example.com/'))
      .toBe('https://worker.example.com');
    expect(validatedDeploymentOrigin('https://myapp.workers.dev'))
      .toBe('https://myapp.workers.dev');
  });

  it.each(invalidOrigins)('rejects unsafe or ambiguous origin %s', (value) => {
    expect(() => validatedDeploymentOrigin(value)).toThrow(/public HTTPS DNS origin/);
  });

  it('prevents legacy origin ambiguity and malformed stable-ID heartbeats', async () => {
    const q = vi.fn(async () => []) as unknown as Query;
    for (const origin of invalidOrigins) {
      await expect(refreshDeploymentById(q, 'aiko', deploymentId, origin, []))
        .rejects.toThrow();
    }
    expect(q).not.toHaveBeenCalled();
  });

  it('does not send a registrar proof challenge to a non-public origin', async () => {
    const send = vi.fn(async () => Response.json({ error: 'unreachable' }));
    const registrar = createHttpDeploymentProofAuthority({
      authorizeEnrollment: async () => ({
        appId: 'aiko', deploymentId, origin: 'https://localhost.',
        environment: 'production' as const,
      }),
      authorizeRevocation: async () => null,
    }, send as typeof fetch);
    await expect(registrar.attest({})).rejects.toThrow(/public HTTPS DNS origin/);
    expect(send).not.toHaveBeenCalled();
  });

  it('uses the same hardened origin validator for legacy ticket and heartbeat code', async () => {
    const q = vi.fn(async () => []) as unknown as Query;
    const runtime = createEcosystemRuntime({
      appId: 'aiko', capabilities: { ping: async () => 'pong' },
      authenticate: async () => null, query: () => q,
    });
    const env = { APP_URL: 'https://localhost.', SYSTEM_DATABASE_URL: 'mock' };
    await expect(runtime.heartbeat(env, true)).rejects.toThrow(/public HTTPS DNS origin/);
    expect(q).not.toHaveBeenCalled();
  });
});
