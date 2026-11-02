import { describe, expect, it } from 'vitest';
import { resolveSkipoWebContainerManifest, SkipoWebContainerManifestSchema } from './webContainerManifest.js';

describe('Skipo WebContainer manifest', () => {
  it('resolves standard commands from package scripts', () => {
    const manifest = resolveSkipoWebContainerManifest({ packageManager: 'pnpm@10.33.0', scripts: { dev: 'vite', lint: 'tsc --noEmit', test: 'vitest run', build: 'vite build' } });
    expect(manifest.workspaceRoot).toBe('/workspace');
    expect(manifest.commands.install).toEqual(['pnpm', 'install', '--no-frozen-lockfile']);
    expect(manifest.commands.dev).toEqual(['pnpm', 'dev', '--host', '0.0.0.0']);
    expect(manifest.commands.validate).toEqual(['pnpm', 'lint']);
  });
  it('honours explicit app command overrides', () => {
    const manifest = resolveSkipoWebContainerManifest({ packageManager: 'npm@10.0.0', scripts: { dev: 'vite', validate: 'node validate.mjs' } }, { commands: { dev: ['node', 'server.js'], validate: ['npm', 'run', 'validate'] } });
    expect(manifest.commands.dev).toEqual(['node', 'server.js']);
    expect(manifest.commands.validate).toEqual(['npm', 'run', 'validate']);
  });
  it('rejects unsupported package managers and empty commands', () => {
    expect(() => SkipoWebContainerManifestSchema.parse({ packageManager: 'bun' })).toThrow();
    expect(() => SkipoWebContainerManifestSchema.parse({ commands: { test: [] } })).toThrow();
  });
});
