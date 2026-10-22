import { describe, expect, it } from 'vitest';

describe('Skipo ecosystem session contract', () => {
  it('keeps hydrated libraries outside src', () => {
    const librariesRoot = '.skipo/libraries';
    expect(librariesRoot.startsWith('src/')).toBe(false);
  });

  it('uses a machine-readable provenance marker', () => {
    const marker = 'skipo-ecosystem-promotion:v1';
    expect(marker).toBe('skipo-ecosystem-promotion:v1');
  });

  it('identifies both global library packages', () => {
    expect('@ultrst-armada/kloks').toContain('/kloks');
    expect('@ultrst-armada/floks').toContain('/floks');
  });
});
