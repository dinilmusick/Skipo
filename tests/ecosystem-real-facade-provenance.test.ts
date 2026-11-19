import { describe, expect, it, vi } from 'vitest';
import { BackendRegistry } from '@ultrst-armada/kloks/backend';
import { BackendFacade } from '../scaffolds/vite/src/backend/BackendFacade.js';
import {
  createEcosystemRuntime, verifyRegisteredBackendFacadeOperations,
  type BackendFacadeOperationSource,
} from '../backend/ecosystem/ecosystemRuntime_Impure.js';
import type { Query, StaticCapabilityDescriptor } from
  '../backend/ecosystem/deploymentStore_Impure.js';

const deploymentId = '36f3149f-1243-4a14-8641-dad57e3e6f83';
const descriptor: StaticCapabilityDescriptor = {
  id: 'composeRun', name: 'Compose a result',
  description: 'Executes an exact registered facade operation',
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  invocation: { serviceId: 'compose', operationId: 'run' },
};

function source(withCommand = true): BackendFacadeOperationSource {
  const facade = new BackendFacade();
  const installedService = {
    id: 'compose', name: 'Composer', version: '1.0.0',
    execute: async () => ({ ok: true }),
    getNamespace: () => ({
      serviceId: 'compose', serviceName: 'Composer', version: '1.0.0',
      libraries: {}, functionalities: {
        run: { description: 'Execute a compose operation',
          inputSchema: { type: 'object' }, outputSchema: { type: 'object' } },
      }, functionalityOrchestrations: {}, capabilities: [], dependencies: [],
    }),
  };
  facade.registerService(installedService);
  const registry = new BackendRegistry();
  if (withCommand) registry.registerCommand('compose', 'run', async () => ({ ok: true }));
  return { facade, registry };
}

describe('actual Skipo BackendFacade and Kloks BackendRegistry authority', () => {
  it('validates a real registered command with Map-backed facade service inventory', () => {
    const registered = source();
    expect('getService' in registered.facade).toBe(true);
    expect(registered.facade.listCapabilities?.()).toEqual(
      expect.arrayContaining([expect.objectContaining({
        serviceId: 'compose', invocation: { kind: 'functionality', operation: 'run' },
      })]),
    );
    expect(() => verifyRegisteredBackendFacadeOperations(registered, [descriptor]))
      .not.toThrow();
  });

  it('rejects metadata-only operations that have no real Kloks registry handler', () => {
    expect(() => verifyRegisteredBackendFacadeOperations(source(false), [descriptor]))
      .toThrow(/not uniquely registered/);
  });

  it('rejects unknown facade services even when their registry handler exists', () => {
    const result = source();
    expect(() => verifyRegisteredBackendFacadeOperations(result, [
      { ...descriptor, invocation: { serviceId: 'fabricated', operationId: 'run' } },
    ])).toThrow(/not installed/);
  });

  it('rejects unknown facade capability operations even if the registry supplies one', () => {
    const result = source();
    (result.registry as BackendRegistry).registerCommand('compose', 'other',
      async () => null);
    expect(() => verifyRegisteredBackendFacadeOperations(result, [
      { ...descriptor, invocation: { serviceId: 'compose', operationId: 'other' } },
    ])).toThrow(/absent from BackendFacade capability catalog/);
  });

  it('rejects ambiguous operation names registered as both commands and queries', () => {
    const result = source();
    (result.registry as BackendRegistry).registerQuery('compose', 'run',
      async () => null);
    expect(() => verifyRegisteredBackendFacadeOperations(result, [descriptor]))
      .toThrow(/not uniquely registered/);
  });

  it('rejects stale registry metadata with the wrong service or operation identity', () => {
    const good = source();
    const mismatched = {
      facade: good.facade,
      registry: {
        getCommand: () => ({
          domain: 'other', name: 'run', handler: async () => null,
        }),
        getQuery: () => undefined,
      },
    };
    expect(() => verifyRegisteredBackendFacadeOperations(mismatched, [descriptor]))
      .toThrow(/not uniquely registered/);
  });

  it('publishes the live handler provenance through actual facade/registry composition', async () => {
    const query = vi.fn(async (sql: string) => sql.includes('WITH lock AS MATERIALIZED')
      ? [{ revision: 1 }] : [{ deployment_id: deploymentId }]) as unknown as Query;
    const runtime = createEcosystemRuntime({
      appId: 'aiko', deploymentId,
      capabilities: { composeRun: async () => ({ ok: true }) },
      authenticate: async () => null, capabilityDescriptors: [descriptor],
      backendFacadeOperations: source(), query: () => query,
    });
    const env = { APP_URL: 'https://aiko.example', SYSTEM_DATABASE_URL: 'mock' };
    await runtime.heartbeat(env, true);
    const published = vi.mocked(query).mock.calls.find(([sql]) =>
      sql.includes('WITH lock AS MATERIALIZED'));
    expect(published).toBeDefined();
    expect(JSON.parse(published![1][1] as string)).toEqual([descriptor]);
  });
});
