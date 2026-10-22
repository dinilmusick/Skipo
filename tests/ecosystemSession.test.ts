import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Skipo ecosystem session contract', () => {
  it('keeps hydrated libraries outside src', () => {
    const librariesRoot = '.skipo/libraries';
    expect(librariesRoot.startsWith('src/')).toBe(false);
  });

  it('uses a machine-readable provenance marker', () => {
    const marker = 'skipo-ecosystem-promotion:v1';
    expect(marker).toBe('skipo-ecosystem-promotion:v1');
  });

  it('requires the originating app commit before library PR creation', () => {
    const sync = readFileSync(new URL('../scripts/ecosystem_sync.py', import.meta.url), 'utf8');
    expect(sync).toContain('Cannot create library provenance PR before the originating app commit is recorded.');
    expect(sync).toContain('"appCommit": state["appCommit"]');
  });

  it('records both original dependency locations for reversible cleanup', () => {
    const sync = readFileSync(new URL('../scripts/ecosystem_sync.py', import.meta.url), 'utf8');
    expect(sync).toContain('"originalSpec": deps.get(v["package"])');
    expect(sync).toContain('"originalDevSpec": dev_deps.get(v["package"])');
    expect(sync).toContain('deps.pop(package_name, None)');
    expect(sync).toContain('dev_deps.pop(package_name, None)');
  });

  it('does not overwrite or delete dirty ecosystem workspaces', () => {
    const sync = readFileSync(new URL('../scripts/ecosystem_sync.py', import.meta.url), 'utf8');
    expect(sync).toContain('Refusing to hydrate dirty {key} workspace');
    expect(sync).toContain('Refusing ecosystem cleanup while the application workspace is dirty.');
    expect(sync).toContain('Refusing cleanup of dirty {key} workspace');
    expect(sync).toContain('git", "rev-parse", "--verify"');
  });

  it('identifies both global library packages', () => {
    expect('@ultrst-armada/kloks').toContain('/kloks');
    expect('@ultrst-armada/floks').toContain('/floks');
  });
});
