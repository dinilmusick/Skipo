import { describe, expect, it, vi } from 'vitest';
import { ServiceFacade } from '@ultrst-armada/krnl';
import { BackendFacade } from '../src/backend/BackendFacade.js';
import { ModuleBackendAdapter } from '../src/backend/ModuleBackendAdapter.js';
import type { ModuleBackendAuthorization } from '../src/backend/ModuleBackendAdapterTypes.js';

const capabilityId = 'service.parent/functionalities/lookupCustomer';
const inputSchema = { type: 'object', properties: { customerId: { type: 'string' } }, required: ['customerId'] };
const outputSchema = { type: 'object', properties: { displayName: { type: 'string' } } };

function fixture(policy?: Partial<ModuleBackendAuthorization>) {
  const backend = new BackendFacade();
  const service = new ServiceFacade({
    id: 'service.parent',
    name: 'ParentService',
    version: '2.4.0',
    libraries: { privateHelper: { secret: true } },
    functionalities: {
      lookupCustomer: {
        description: 'Look up a customer record.',
        inputSchema,
        outputSchema,
        capabilities: ['customer:read'],
        execute: async (input: { customerId: string }) => ({ customer: { name: `Customer ${input.customerId}` } }),
      },
    },
  });
  backend.registerService(service);
  const authorization: ModuleBackendAuthorization = {
    canDiscover: policy?.canDiscover || (() => true),
    canInvoke: policy?.canInvoke || (() => true),
  };
  const adapter = new ModuleBackendAdapter({
    backend,
    manifest: {
      moduleId: 'module.crm-widget',
      capabilities: [{
        capabilityId,
        representation: { kind: 'customer-lookup' },
        inputMapping: { customerId: '$.payload.id' },
        outputMapping: { label: '$.customer.name' },
      }],
    },
    authorization,
  });
  return { backend, service, adapter };
}

describe('ModuleBackendAdapter', () => {
  it('discovers only explicitly declared and authorized capabilities with schemas and metadata', async () => {
    const { adapter } = fixture();
    const capabilities = await adapter.discover();
    expect(capabilities).toHaveLength(1);
    expect(capabilities[0]).toMatchObject({
      id: capabilityId,
      serviceId: 'service.parent',
      serviceName: 'ParentService',
      serviceVersion: '2.4.0',
      description: 'Look up a customer record.',
      category: 'functionalities',
      inputSchema,
      outputSchema,
      invocation: { kind: 'functionality', operation: 'lookupCustomer' },
      capabilities: ['customer:read'],
      representation: { kind: 'customer-lookup' },
    });
    expect(capabilities[0]).not.toHaveProperty('execute');
    expect(capabilities[0]).not.toHaveProperty('definition');
  });

  it('filters undeclared capabilities and denies discovery when policy rejects it', async () => {
    const { backend } = fixture({ canDiscover: () => false });
    const adapter = new ModuleBackendAdapter({
      backend,
      manifest: { moduleId: 'module.denied', capabilities: [{ capabilityId }] },
      authorization: { canDiscover: () => false, canInvoke: () => true },
    });
    expect(await adapter.discover()).toEqual([]);
    const empty = new ModuleBackendAdapter({
      backend,
      manifest: { moduleId: 'module.empty', capabilities: [] },
      authorization: { canDiscover: () => true, canInvoke: () => true },
    });
    expect(await empty.discover()).toEqual([]);
  });

  it('maps inputs and outputs and invokes through the canonical parent BackendFacade', async () => {
    const { backend, adapter } = fixture();
    const execute = vi.spyOn(backend, 'executeCapability');
    const result = await adapter.invoke<{ payload: { id: string } }, { label: string }>(
      capabilityId, { payload: { id: '42' } }
    );
    expect(result).toEqual({ label: 'Customer 42' });
    expect(execute).toHaveBeenCalledWith(
      'lookupCustomer', 'lookupCustomer', { customerId: '42' }, { serviceId: 'service.parent' }
    );
  });

  it('rechecks invocation authorization independently of discovery', async () => {
    const { adapter } = fixture({ canInvoke: () => false });
    await expect(adapter.invoke(capabilityId, { payload: { id: '1' } }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects undeclared and unavailable capabilities', async () => {
    const { backend, adapter } = fixture();
    await expect(adapter.invoke('service.other/functionalities/delete', {}))
      .rejects.toMatchObject({ code: 'CAPABILITY_NOT_DECLARED' });
    const stale = new ModuleBackendAdapter({
      backend,
      manifest: { moduleId: 'module.stale', capabilities: [{ capabilityId: 'service.gone/functionalities/missing' }] },
      authorization: { canDiscover: () => true, canInvoke: () => true },
    });
    await expect(stale.invoke('service.gone/functionalities/missing', {}))
      .rejects.toMatchObject({ code: 'CAPABILITY_NOT_FOUND' });
  });

  it('rejects unsafe declarative mappings and propagates parent execution errors', async () => {
    const { backend } = fixture();
    const unsafe = new ModuleBackendAdapter({
      backend,
      manifest: {
        moduleId: 'module.unsafe',
        capabilities: [{ capabilityId, inputMapping: { ['__proto__']: '$.payload' } }],
      },
      authorization: { canDiscover: () => true, canInvoke: () => true },
    });
    await expect(unsafe.invoke(capabilityId, { payload: {} }))
      .rejects.toMatchObject({ code: 'INVALID_MAPPING' });
    const broken = new ServiceFacade({
      id: 'service.broken',
      functionalities: { fail: { execute: async () => { throw new Error('parent failure'); } } },
    });
    backend.registerService(broken);
    await expect(backend.executeCapability('fail', 'fail', {}, { serviceId: 'service.broken' }))
      .rejects.toThrow('parent failure');
  });

  it('enforces the service ownership boundary for qualified execution', async () => {
    const { backend } = fixture();
    await expect(backend.executeCapability('privateOperation', 'privateOperation', {}, {
      serviceId: 'service.parent',
    })).rejects.toThrow(/does not own capability/);
    expect(backend.listCapabilities().some((item) => item.category === 'libraries')).toBe(false);
  });

  it('requires an explicit authorization policy and valid module declaration', () => {
    const backend = new BackendFacade();
    expect(() => new ModuleBackendAdapter({
      backend,
      manifest: { moduleId: 'module.invalid', capabilities: [] },
      authorization: undefined as never,
    })).toThrow(/authorization policy/);
  });
});
