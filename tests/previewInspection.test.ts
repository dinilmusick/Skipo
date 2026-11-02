import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPreviewTargets, resolvePreviewInspectionConfig, runPreviewInspection } from '../scripts/inspect_preview.mjs';

const temporaryDirectories = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

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

  it('preserves preview subpaths while expanding route and viewport targets', () => {
    const config = resolvePreviewInspectionConfig({ browserInspection: {
      enabled: true, routes: ['/', '/settings'], viewports: [{ width: 1440, height: 900 }, { width: 390, height: 844 }],
    } });
    const targets = buildPreviewTargets('https://preview.example.test/app/', config);
    expect(targets).toHaveLength(4);
    expect(targets.map(target => target.url)).toEqual([
      'https://preview.example.test/app/', 'https://preview.example.test/app/settings',
      'https://preview.example.test/app/', 'https://preview.example.test/app/settings',
    ]);
  });

  it('rejects disabled inspection, non-http URLs and malformed routes', () => {
    expect(() => resolvePreviewInspectionConfig({ browserInspection: { enabled: false } })).toThrow(/disabled/);
    const config = resolvePreviewInspectionConfig({ browserInspection: { enabled: true, routes: ['bad-route'] } });
    expect(() => buildPreviewTargets('file:///tmp/app', config)).toThrow(/HTTP or HTTPS/);
    expect(() => buildPreviewTargets('https://preview.example.test', config)).toThrow(/begin with/);
  });

  it('persists real browser console, page, network and rendered DOM evidence', async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), 'skipo-preview-'));
    temporaryDirectories.push(outputDirectory);
    const listeners = new Map();
    const page = {
      on: (event, handler) => listeners.set(event, handler),
      goto: async () => {
        listeners.get('console')?.({ type: () => 'warning', text: () => 'layout warning', location: () => ({ url: 'https://preview.test', lineNumber: 1 }) });
        listeners.get('console')?.({ type: () => 'error', text: () => 'render failure', location: () => ({ url: 'https://preview.test', lineNumber: 2 }) });
        listeners.get('pageerror')?.(new Error('uncaught render exception'));
        listeners.get('requestfailed')?.({ url: () => 'https://preview.test/api', method: () => 'GET', failure: () => ({ errorText: 'net::ERR_FAILED' }) });
        listeners.get('response')?.({ status: () => 503, url: () => 'https://preview.test/api' });
        return { status: () => 200 };
      },
      title: async () => 'Preview app',
      locator: () => ({ first() { return this; }, count: async () => 1, isVisible: async () => true, innerText: async () => 'Workspace home' }),
      content: async () => '<html><body>Workspace home</body></html>',
      screenshot: async ({ path }) => { const { writeFile } = await import('node:fs/promises'); await writeFile(path, 'png'); },
      close: async () => {},
    };
    const browser = { newPage: async () => page, close: async () => {} };
    const result = await runPreviewInspection({
      baseUrl: 'https://preview.test', outputDirectory,
      manifest: { browserInspection: { enabled: true, routes: ['/'], viewports: [{ width: 800, height: 600 }], checks: [{ selector: 'main', visible: true, text: 'Workspace' }] } },
      playwright: { chromium: { launch: async () => browser } },
    });
    const persisted = JSON.parse(await readFile(result.reportPath, 'utf8'));
    expect(result.ok).toBe(false);
    expect(result.summary.consoleLogs).toBe(2);
    expect(result.summary.errors).toBe(4);
    expect(persisted.results[0].title).toBe('Preview app');
    expect(persisted.results[0].domSnapshot).toContain('Workspace home');
    expect(persisted.results[0].checks[0].passed).toBe(true);
    expect(persisted.results[0].errors.map(error => error.kind)).toEqual(['console', 'pageerror', 'requestfailed', 'http']);
  });
});
