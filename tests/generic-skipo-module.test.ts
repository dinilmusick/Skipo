import { describe, expect, it } from 'vitest';
import { runStandalone } from './fixtures/generic-skipo-module/standalone.js';
import { registerGenericInventoryUI } from './fixtures/generic-skipo-module/frontend.js';
import { skipoModuleUIRegistry } from '../src/frontend/components/module-ui/registry.js';

describe('generic Skipo module fixture', () => {
  it('runs the same complete module definition through a standalone/mock host', async () => {
    const mounted = await runStandalone();
    expect(mounted.moduleId).toBe('generic.inventory');
    expect(mounted.context.workspace.id).toBe('standalone');
    await mounted.activate();
    await mounted.unmount();
  });

  it('registers a host-owned UI contribution without importing backend implementation', () => {
    const dispose = registerGenericInventoryUI();
    try {
      expect(skipoModuleUIRegistry.getSnapshot().some(entry => entry.moduleId === 'generic.inventory')).toBe(true);
    } finally { dispose(); }
  });

  it('proves the fixture is generic', async () => {
    const mounted = await runStandalone();
    expect(mounted.moduleId).not.toMatch(/aiko/i);
    await mounted.unmount();
  });
});
