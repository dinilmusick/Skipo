import { describe, it, expect } from 'vitest';
import {
  DOCUSTACK_DARK_GOLD_PACK,
  DOCUSTACK_WARM_COFFEE_PACK,
  DOCUSTACK_CYBERPUNK_PACK,
  validateModularThemePack,
  resolveTypographyCascade,
  ThemeEngine,
  createAppThemeSocket
} from '../index.js';

describe('Structured Theme Packs & Typography Cascade', () => {
  it('validates canonical theme packs against Zod schema', () => {
    expect(() => validateModularThemePack(DOCUSTACK_DARK_GOLD_PACK)).not.toThrow();
    expect(() => validateModularThemePack(DOCUSTACK_WARM_COFFEE_PACK)).not.toThrow();
    expect(() => validateModularThemePack(DOCUSTACK_CYBERPUNK_PACK)).not.toThrow();
  });

  it('rejects invalid theme packs missing mandatory fields', () => {
    const invalidPack = {
      metadata: { id: 'invalid' }
    };
    expect(() => validateModularThemePack(invalidPack)).toThrow();
  });

  it('cascades typography top-down from globalFont down to markdown sections', () => {
    const cascade = resolveTypographyCascade({
      globalFont: 'CustomSans',
      globalMonoFont: 'CustomMono',
      globalColor: '#FFFFFF',
      globalAccentColor: '#FFD700',
      sections: {
        h1: { fontSize: '32px' }
      }
    });

    expect(cascade.globalFont).toBe('CustomSans');
    expect(cascade.headingFont).toBe('CustomSans'); // falls back to globalFont
    expect(cascade.cssVars['--skipo-font-h1']).toBe('CustomSans');
    expect(cascade.cssVars['--skipo-h1-size']).toBe('32px');
    expect(cascade.cssVars['--skipo-h1-color']).toBe('#FFD700'); // falls back to globalAccentColor
  });

  it('computes typography css variables in ThemeEngine', () => {
    const socket = createAppThemeSocket({
      appId: 'test-typography-app',
      appName: 'Test Typo App',
      version: '1.0.0',
      elementIds: ['canvas', 'topToolbar'],
      defaultThemePackId: 'docustack-dark-gold'
    });

    const engine = new ThemeEngine(socket, [DOCUSTACK_DARK_GOLD_PACK]);
    const vars = engine.computeAllCssVariables();

    expect(vars['--skipo-font-global']).toBe("'Courier Prime', monospace");
    expect(vars['--skipo-font-h1']).toBe("'Courier Prime', monospace");
    expect(vars['--skipo-h1-color']).toBe('#D4AF37');
    expect(vars['--skipo-h1-size']).toBe('28px');
    expect(vars['--skipo-code-font']).toBe("'JetBrains Mono', monospace");
  });

  it('updates typography css variables when switching between dark and light variants', () => {
    const socket = createAppThemeSocket({
      appId: 'test-typography-variant-app',
      appName: 'Test Typo Variant App',
      version: '1.0.0',
      elementIds: ['canvas'],
      defaultThemePackId: 'docustack-dark-gold'
    });

    const engine = new ThemeEngine(socket, [DOCUSTACK_DARK_GOLD_PACK], 'dark');
    let vars = engine.computeAllCssVariables();
    expect(vars['--skipo-h1-color']).toBe('#D4AF37');

    engine.setMode('light');
    vars = engine.computeAllCssVariables();
    expect(vars['--skipo-h1-color']).toBe('#B58900');
  });
});
