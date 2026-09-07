import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DARK_THEME_PACK,
  DEFAULT_LIGHT_THEME_PACK,
  tokensToCssVariables,
  validateThemePack,
} from '../theme/ThemePackLoader.js';
import { KNOWN_CREDENTIAL_URLS } from '../components/base/CredentialField.js';

describe('Skipo Theme Pack System', () => {
  it('validates default dark and light theme packs', () => {
    const darkValidation = validateThemePack(DEFAULT_DARK_THEME_PACK);
    expect(darkValidation.valid).toBe(true);
    expect(darkValidation.errors).toHaveLength(0);

    const lightValidation = validateThemePack(DEFAULT_LIGHT_THEME_PACK);
    expect(lightValidation.valid).toBe(true);
    expect(lightValidation.errors).toHaveLength(0);
  });

  it('rejects invalid theme packs missing required semantic tokens', () => {
    const invalidPack = { metadata: { id: 'bad' } };
    const res = validateThemePack(invalidPack);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('converts semantic tokens into canonical --skipo-* CSS variables', () => {
    const cssVars = tokensToCssVariables(DEFAULT_DARK_THEME_PACK.tokens);
    expect(cssVars['--skipo-bg']).toBe('#16181d');
    expect(cssVars['--skipo-top-toolbar-height']).toBe('44px');
    expect(cssVars['--skipo-bottom-strip-height']).toBe('30px');
    expect(cssVars['--skipo-bottom-strip-bg']).toBe('rgba(15, 17, 21, 0.95)');
    expect(cssVars['--skipo-inspection-text-color']).toBe('rgba(241, 245, 249, 0.80)');
  });
});

describe('Skipo Credential Portals Link Resolution', () => {
  it('correctly maps known cloud and AI provider keys to web portals', () => {
    expect(KNOWN_CREDENTIAL_URLS.openai.url).toContain('openai.com');
    expect(KNOWN_CREDENTIAL_URLS.anthropic.url).toContain('anthropic.com');
    expect(KNOWN_CREDENTIAL_URLS.google.url).toContain('aistudio.google.com');
    expect(KNOWN_CREDENTIAL_URLS.backblaze.url).toContain('backblaze.com');
    expect(KNOWN_CREDENTIAL_URLS.cloudflare.url).toContain('cloudflare.com');
    expect(KNOWN_CREDENTIAL_URLS.supabase.url).toContain('supabase.com');
    expect(KNOWN_CREDENTIAL_URLS.neon.url).toContain('neon.tech');
  });
});

describe('Skipo Floating Details Panel System', () => {
  it('provides default panel geometry with valid viewport dimensions', async () => {
    const { DEFAULT_PANEL_GEOMETRY } = await import('../components/containers/usePanelGeometry.js');
    expect(DEFAULT_PANEL_GEOMETRY.x).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_PANEL_GEOMETRY.y).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_PANEL_GEOMETRY.width).toBeGreaterThanOrEqual(260);
    expect(DEFAULT_PANEL_GEOMETRY.height).toBeGreaterThanOrEqual(180);
  });

  it('exports FloatingDetailsPanel and ResizeHandles components', async () => {
    const { FloatingDetailsPanel, ResizeHandles } = await import('../components/containers/index.js');
    expect(typeof FloatingDetailsPanel).toBe('function');
    expect(typeof ResizeHandles).toBe('function');
  });
});

