import { describe, it, expect, beforeEach } from 'vitest';
import {
  centralLedger,
  registerUIElement,
  createAppThemeSocket,
  ThemeEngine,
  getThemeEngineStatus,
  DOCUSTACK_DARK_GOLD_PACK,
  DOCUSTACK_WARM_COFFEE_PACK,
  DOCUSTACK_CYBERPUNK_PACK
} from '../theme/index.js';

describe('Central UI Element Ledger', () => {
  beforeEach(() => {
    centralLedger.reset();
  });

  it('pre-populates canonical UI elements', () => {
    expect(centralLedger.has('canvas')).toBe(true);
    expect(centralLedger.has('buttonPrimary')).toBe(true);
    expect(centralLedger.has('kanbanColumn')).toBe(true);
    expect(centralLedger.has('graphNodeRoot')).toBe(true);
  });

  it('allows registering new non-conflicting UI elements', () => {
    registerUIElement({
      id: 'musicSynthesizerVisualizer',
      name: 'Audio Waveform Visualizer',
      category: 'specialized',
      description: 'Dynamic canvas visualizing multi-band audio spectrum.',
      firstDefinedByApp: 'music-station'
    });
    expect(centralLedger.has('musicSynthesizerVisualizer')).toBe(true);
  });

  it('rejects re-registering an element with conflicting semantics', () => {
    expect(() => {
      registerUIElement({
        id: 'buttonPrimary',
        name: 'Conflicting Custom Button',
        category: 'layout', // conflicting category
        description: 'Trying to redefine button as layout',
        firstDefinedByApp: 'other-app'
      });
    }).toThrow(/Cannot redefine existing UI element/);
  });
});

describe('App Theme Socket & ThemeEngine (Plug & Socket)', () => {
  beforeEach(() => {
    centralLedger.reset();
  });

  const testSocket = createAppThemeSocket({
    appId: 'test-app',
    appName: 'Test Application',
    version: '1.0.0',
    elementIds: ['canvas', 'buttonPrimary', 'kanbanColumn', 'card'],
    defaultThemePackId: 'docustack-dark-gold',
    elementDefaults: {
      card: {
        cssVars: { '--color-surface': '#333333' }
      }
    }
  });

  it('validates socket elements against the central ledger', () => {
    expect(() => {
      createAppThemeSocket({
        appId: 'invalid-app',
        appName: 'Invalid App',
        version: '1.0.0',
        elementIds: ['nonExistentElementXYZ']
      });
    }).toThrow(/references unknown UI elements/);
  });

  it('plugs theme pack into socket and resolves base styles', () => {
    const engine = new ThemeEngine(testSocket, [
      DOCUSTACK_DARK_GOLD_PACK,
      DOCUSTACK_WARM_COFFEE_PACK,
      DOCUSTACK_CYBERPUNK_PACK
    ]);

    expect(engine.getActiveBasePackId()).toBe('docustack-dark-gold');
    const buttonStyle = engine.resolveElementTheme('buttonPrimary');
    expect(buttonStyle.appliedPackId).toBe('docustack-dark-gold');
    expect(buttonStyle.value.cssVars?.['--color-accent']).toBe('#D4AF37');
    expect(buttonStyle.isOverridden).toBe(false);
  });

  it('safely ignores theme pack elements not present in app socket', () => {
    const engine = new ThemeEngine(testSocket, [DOCUSTACK_DARK_GOLD_PACK]);
    const status = getThemeEngineStatus(engine);

    // docustack-dark-gold defines graphNodeRoot and aiChatPanel, which are NOT in testSocket
    expect(status.ignoredElements).toContain('graphNodeRoot');
    expect(status.ignoredElements).toContain('aiChatPanel');
  });

  it('preserves fallback styling for elements missing from theme pack', () => {
    // Cyberpunk pack only defines canvas, buttonPrimary, graphNodeRoot (does NOT define 'card' or 'kanbanColumn')
    const engine = new ThemeEngine(testSocket, [DOCUSTACK_CYBERPUNK_PACK]);
    engine.setBaseThemePack('docustack-cyberpunk-neon');

    const cardResolved = engine.resolveElementTheme('card');
    expect(cardResolved.isFallback).toBe(true);
    expect(cardResolved.value.cssVars?.['--color-surface']).toBe('#333333');
  });

  it('supports selective mix-and-matching with per-element overrides', () => {
    const engine = new ThemeEngine(testSocket, [
      DOCUSTACK_DARK_GOLD_PACK,
      DOCUSTACK_WARM_COFFEE_PACK,
      DOCUSTACK_CYBERPUNK_PACK
    ]);

    // Base theme: Dark Gold
    expect(engine.resolveElementTheme('buttonPrimary').value.cssVars?.['--color-accent']).toBe('#D4AF37');

    // Override buttonPrimary with Cyberpunk Neon
    engine.setElementOverride('buttonPrimary', 'docustack-cyberpunk-neon');
    const overriddenBtn = engine.resolveElementTheme('buttonPrimary');
    expect(overriddenBtn.appliedPackId).toBe('docustack-cyberpunk-neon');
    expect(overriddenBtn.isOverridden).toBe(true);
    expect(overriddenBtn.value.cssVars?.['--color-accent']).toBe('#00F0FF');

    // Override kanbanColumn with Warm Coffee (resolves dark variant under active dark mode)
    engine.setElementOverride('kanbanColumn', 'docustack-warm-coffee');
    const overriddenCol = engine.resolveElementTheme('kanbanColumn');
    expect(overriddenCol.appliedPackId).toBe('docustack-warm-coffee');
    expect(overriddenCol.appliedVariant).toBe('dark');
    expect(overriddenCol.isOverridden).toBe(true);
    expect(overriddenCol.value.cssVars?.['--color-surface']).toBe('#281D17');

    // Canvas still resolves to base theme (Dark Gold)
    const baseCanvas = engine.resolveElementTheme('canvas');
    expect(baseCanvas.appliedPackId).toBe('docustack-dark-gold');
    expect(baseCanvas.isOverridden).toBe(false);
  });

  it('provides comprehensive status via the Status & Inspection API', () => {
    const engine = new ThemeEngine(testSocket, [
      DOCUSTACK_DARK_GOLD_PACK,
      DOCUSTACK_WARM_COFFEE_PACK,
      DOCUSTACK_CYBERPUNK_PACK
    ]);
    engine.setElementOverride('buttonPrimary', 'docustack-cyberpunk-neon');

    const status = getThemeEngineStatus(engine);
    expect(status.appId).toBe('test-app');
    expect(status.registeredElementsCount).toBe(4);
    expect(status.activeBasePackId).toBe('docustack-dark-gold');
    expect(status.elementOverridesCount).toBe(1);
    expect(status.elementOverrides.buttonPrimary).toBe('docustack-cyberpunk-neon');

    // Check detailed element status report
    const btnReport = status.elements.buttonPrimary;
    expect(btnReport.elementId).toBe('buttonPrimary');
    expect(btnReport.appliedThemePackId).toBe('docustack-cyberpunk-neon');
    expect(btnReport.appliedVariant).toBe('dark');
    expect(btnReport.isOverridden).toBe(true);
    expect(btnReport.effectiveCssVars['--color-accent']).toBe('#00F0FF');

    const colReport = status.elements.kanbanColumn;
    expect(colReport.appliedThemePackId).toBe('docustack-dark-gold');
    expect(colReport.appliedVariant).toBe('dark');
    expect(colReport.isOverridden).toBe(false);
  });

  it('toggles and resolves dual dark/light variants on any theme pack', () => {
    const engine = new ThemeEngine(testSocket, [
      DOCUSTACK_DARK_GOLD_PACK,
      DOCUSTACK_WARM_COFFEE_PACK,
      DOCUSTACK_CYBERPUNK_PACK
    ]);

    expect(engine.getMode()).toBe('dark');
    expect(engine.resolveElementTheme('buttonPrimary').value.cssVars?.['--color-accent']).toBe('#D4AF37');

    engine.toggleMode();
    expect(engine.getMode()).toBe('light');
    expect(engine.resolveElementTheme('buttonPrimary').value.cssVars?.['--color-accent']).toBe('#B58900');

    engine.setBaseThemePack('docustack-warm-coffee');
    expect(engine.resolveElementTheme('buttonPrimary').value.cssVars?.['--color-accent']).toBe('#C87D32');

    engine.toggleMode();
    expect(engine.getMode()).toBe('dark');
    expect(engine.resolveElementTheme('buttonPrimary').value.cssVars?.['--color-accent']).toBe('#E08A3C');
  });
});
