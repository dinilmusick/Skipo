import { describe, expect, it } from 'vitest';
import { createStandaloneModuleHost } from '../src/modules/module-contract.js';

describe('canonical module standalone host', () => {
  it('exposes only explicitly registered capabilities', async () => {
    const host = createStandaloneModuleHost({ 'catalog.read': (input) => ({ input, ok: true }) });
    expect(host.backend.has('catalog.read')).toBe(true);
    expect(host.backend.has('catalog.write')).toBe(false);
    await expect(host.backend.invoke('catalog.read', { id: 'a' })).resolves.toEqual({ input: { id: 'a' }, ok: true });
    await expect(host.backend.invoke('catalog.write', {})).rejects.toThrow('Undeclared standalone capability: catalog.write');
  });

  it('provides route registration without exposing host chrome', () => {
    const host = createStandaloneModuleHost();
    expect(host.navigation.registerRoute).toBeTypeOf('function');
    expect('bottomBar' in host).toBe(false);
    expect('appShell' in host).toBe(false);
  });
});
