import { describe, expect, it } from 'vitest';
import { createEcosystemRuntime, verifyRegisteredBackendFacadeOperations } from
  '../backend/ecosystem/ecosystemRuntime_Impure.js';
import { normalizeStaticCapabilityDescriptors, type StaticCapabilityDescriptor } from
  '../backend/ecosystem/deploymentStore_Impure.js';

const descriptor: StaticCapabilityDescriptor = {
  id: 'composeRun', description: 'Registered backend operation',
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  invocation: { serviceId: 'compose', operationId: 'run' },
};
const registered = {
  facade: { services: { compose: { execute: async () => 'output' } } },
  registry: {
    getCommand: (domain: string, operation: string) =>
      domain === 'compose' && operation === 'run'
        ? { handler: async () => 'output' } : undefined,
    getQuery: () => undefined,
  },
};

describe('Skipo registered BackendFacade operation provenance', () => {
  it('accepts an exact real BackendRegistry handler and executable Facade service', () => {
    expect(() => verifyRegisteredBackendFacadeOperations(registered, [descriptor])).not.toThrow();
    expect(() => createEcosystemRuntime({
      appId: 'aiko',
      deploymentId: '36f3149f-1243-4a14-8641-dad57e3e6f83',
      capabilityDescriptors: [descriptor],
      backendFacadeOperations: registered,
      capabilities: { 'composeRun': async () => 'output' },
      authenticate: async () => 'user-1',
    })).not.toThrow();
  });

  it('rejects forged operation IDs, missing handlers and non-executable service objects', () => {
    expect(() => verifyRegisteredBackendFacadeOperations(registered, [
      { ...descriptor, invocation: { serviceId: 'compose', operationId: 'fake' } },
    ])).toThrow();
    expect(() => verifyRegisteredBackendFacadeOperations({
      ...registered,
      facade: { services: { compose: { execute: true } } },
    }, [descriptor])).toThrow();
    expect(() => verifyRegisteredBackendFacadeOperations(undefined, [descriptor])).toThrow();
  });

  it('does not publish a descriptor absent from the actual runtime method map', () => {
    expect(() => createEcosystemRuntime({
      appId: 'aiko',
      deploymentId: '36f3149f-1243-4a14-8641-dad57e3e6f83',
      capabilityDescriptors: [descriptor],
      backendFacadeOperations: registered,
      capabilities: { unrelated: async () => null },
      authenticate: async () => 'user-1',
    })).toThrow();
  });

  it('never accepts static descriptors containing credential or endpoint metadata', () => {
    expect(() => normalizeStaticCapabilityDescriptors([
      { ...descriptor, inputSchema: { type: 'object', properties: {
        password: { type: 'string' },
      } } },
    ])).toThrow();
    expect(() => normalizeStaticCapabilityDescriptors([
      { ...descriptor, endpoint: 'https://untrusted.example' } as never,
    ])).toThrow();
  });
});
