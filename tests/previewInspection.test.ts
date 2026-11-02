import { describe, expect, it } from 'vitest';
import { buildPreviewTargets, resolvePreviewInspectionConfig } from '../scripts/inspect_preview.mjs';

describe('Skipo rendered preview inspection contract', () => {
  it('resolves routes, viewport profiles and browser assertions', () => {
    const config = resolvePreviewInspectionConfig({ browserInspection: {
      enabled: true, routes: ['/', '/settings'], viewports: [{ width: 1280, height: 800 }],
      checks: [{ selector: '[data-testid="app-shell"]', visible: true }],
      captureDom: true, timeoutMs: 12000, waitUntil: 'networkidle',
    } });
    expect(config.routes).toEqual(['/', '/settings']);
    expect(config.checks[0]?.selector).toBe('[data-testid="app-shell"]');
    expect(config.timeoutMs).toBe(12000);
  });

  it('creates every route and viewport target against the real preview origin', () => {
    const config = resolvePreviewInspectionConfig({ browserInspection: {
      enabled: true, routes: ['/', '/settings'], viewports: [{ width: 1440, height: 900 }, { width: 390, height: 844 }],
    } });
    const targets = buildPreviewTargets('https://preview.example.test/app/', config);
    expect(targets).toHaveLength(4);
    expect(targets.map(target => target.url)).toEqual([
      'https://preview.example.test/', 'https://preview.example.test/settings',
      'https://preview.example.test/', 'https://preview.example.test/settings',
    ]);
  });

  it('rejects disabled inspection, non-http URLs and malformed routes', () => {
    expect(() => resolvePreviewInspectionConfig({ browserInspection: { enabled: false } })).toThrow(/disabled/);
    const config = resolvePreviewInspectionConfig({ browserInspection: { enabled: true, routes: ['bad-route'] } });
    expect(() => buildPreviewTargets('file:///tmp/app', config)).toThrow(/HTTP or HTTPS/);
    expect(() => buildPreviewTargets('https://preview.example.test', config)).toThrow(/begin with/);
  });
});
