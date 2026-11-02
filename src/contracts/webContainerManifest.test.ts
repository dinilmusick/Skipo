import { describe, expect, it } from 'vitest';
import { resolveSkipoWebContainerManifest, SkipoWebContainerManifestSchema } from './webContainerManifest.js';

describe('Skipo WebContainer manifest', () => {
  it('resolves standard commands from package scripts', () => {
    const manifest = resolveSkipoWebContainerManifest({ packageManager: 'pnpm@10.33.0', scripts: { dev: 'vite', lint: 'tsc --noEmit', test: 'vitest run', build: 'vite build' } });
    expect(manifest.workspaceRoot).toBe('/workspace');
    expect(manifest.commands.install).toEqual(['pnpm', 'install', '--no-frozen-lockfile']);
    expect(manifest.commands.dev).toEqual(['pnpm', 'dev', '--host', '0.0.0.0']);
    expect(manifest.commands.validate).toEqual(['pnpm', 'lint']);
    expect(manifest.browserInspection.enabled).toBe(false);
    expect(manifest.browserInspection.routes).toEqual(['/']);
    expect(manifest.browserInspection.viewports).toEqual([{ width: 1440, height: 900 }, { width: 390, height: 844 }]);
  });
  it('honours explicit app command overrides', () => {
    const manifest = resolveSkipoWebContainerManifest({ packageManager: 'npm@10.0.0', scripts: { dev: 'vite', validate: 'node validate.mjs' } }, { commands: { dev: ['node', 'server.js'], validate: ['npm', 'run', 'validate'] } });
    expect(manifest.commands.dev).toEqual(['node', 'server.js']);
    expect(manifest.commands.validate).toEqual(['npm', 'run', 'validate']);
  });
  it('accepts app-specific browser inspection routes and viewport profiles', () => {
    const manifest = resolveSkipoWebContainerManifest({}, { browserInspection: { enabled: true, routes: ['/','/settings'], viewports: [{ width: 1280, height: 800 }], captureDom: true, screenshotDirectory: 'artifacts/browser' } });
    expect(manifest.browserInspection.enabled).toBe(true);
    expect(manifest.browserInspection.routes).toEqual(['/','/settings']);
    expect(manifest.browserInspection.viewports).toEqual([{ width: 1280, height: 800 }]);
  });

  it('rejects unsupported package managers and empty commands', () => {
    expect(() => SkipoWebContainerManifestSchema.parse({ packageManager: 'bun' })).toThrow();
    expect(() => SkipoWebContainerManifestSchema.parse({ commands: { test: [] } })).toThrow();
  });
});
