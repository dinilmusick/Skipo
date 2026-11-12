import { describe, expect, it } from 'vitest';
import { createMockModuleHost } from '../src/module-runtime/MockModuleHost.js';
import type { SkipoModuleRuntimeDefinition } from '../src/module-runtime/ModuleRuntimeTypes.js';

const manifest = {
  contractVersion: '1.0.0',
  module: { id: 'example.inventory', name: 'Inventory', version: '1.0.0' },
  application: { framework: 'skipo', root: '.', standalone: true, moduleCapable: true, execution: 'both' as const },
  api: { baseRoute: '/api/inventory', backendFacade: { mode: 'declared' as const, entry: 'src/backend/AppBackend.ts', consumes: ['workspace'] } },
  capabilities: [{ id: 'inventory.list', description: 'List inventory.' }],
  runtime: { targets: ['node', 'browser'], requirements: [] },
  resources: { requires: [], optional: [] },
  ui: { exports: [{ id: 'inventory.home', entry: 'src/frontend/inventory.tsx', kind: 'page' as const }] },
  lifecycle: { supported: ['validate','initialize','start','stop','dispose'] as const },
};

describe('generic ModuleHost', () => {
  const definition = (events: string[] = []): SkipoModuleRuntimeDefinition => ({
    manifest,
    backend: { bindings: [{ capabilityId: 'inventory.list', representation: { parentCapabilityId: 'inventory-service/functionalities/list' } }] },
    mount(context) {
      context.events.on('ready', () => events.push('ready'));
      return {
        activate() { context.events.emit('ready', {}); },
        deactivate() {},
        unmount() {},
        dispose() {},
      };
    },
  });

  it('injects parent resources and exposes only the adapter view', async () => {
    const { backend, host } = createMockModuleHost({ resources: { workspace: { id: 'ws' }, auth: { userId: 'u' }, theme: { id: 'dark' }, runtime: { mode: 'test' } } });
    backend.registerMockCapability('inventory-service/functionalities/list', async () => [{ id: 'item-1' }]);
    host.discover(definition());
    const mounted = await host.mount('example.inventory');
    expect(mounted.context.workspace).toEqual({ id: 'ws' });
    expect(await mounted.context.backend.invoke('inventory-service/functionalities/list', {})).toEqual([{ id: 'item-1' }]);
  });

  it('fails closed when the parent denies a capability', async () => {
    const { backend, host } = createMockModuleHost({ authorizeCapabilities: () => [] });
    backend.registerMockCapability('inventory-service/functionalities/list', async () => []);
    host.discover(definition());
    const mounted = await host.mount('example.inventory');
    await expect(mounted.context.backend.invoke('inventory-service/functionalities/list', {})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('owns lifecycle and tears down event isolation', async () => {
    const events: string[] = [];
    const { host } = createMockModuleHost();
    host.discover(definition(events));
    const mounted = await host.mount('example.inventory');
    await mounted.activate();
    expect(events).toEqual(['ready']);
    await mounted.deactivate();
    expect(mounted.state).toBe('mounted');
    await mounted.unmount();
    expect(host.listMounted()).toEqual([]);
  });

  it('rejects duplicate discoveries and undeclared backend bindings', () => {
    const { host } = createMockModuleHost();
    host.discover(definition());
    expect(() => host.discover(definition())).toThrow(/Duplicate module id/);
    const invalid = { ...definition(), manifest: { ...manifest, module: { ...manifest.module, id: 'invalid' } }, backend: { bindings: [{ capabilityId: 'missing' }] } };
    expect(() => host.discover(invalid)).toThrow(/not declared/);
  });
});
