import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverModules, validateModuleManifest, SKIPO_MODULE_MANIFEST_SCHEMA, type SkipoModuleManifest } from '../src/module-contract/index.js';

const fixture = (): SkipoModuleManifest => ({
  contractVersion: '1.0.0',
  module: { id: 'com.example.analytics', name: 'Analytics', version: '1.2.3' },
  application: { framework: 'skipo', root: '.', standalone: true, moduleCapable: true, execution: 'both' },
  api: { baseRoute: '/api/analytics', backendFacade: { mode: 'declared', entry: 'src/backend/AppBackend.ts', consumes: ['workspace'] } },
  capabilities: [{ id: 'analytics.read', description: 'Read analytics data.' }],
  runtime: { targets: ['node', 'browser'], requirements: [{ id: 'node', range: '>=20' }] },
  resources: { requires: [{ id: 'workspace', kind: 'workspace', required: true }], optional: [] },
  ui: { exports: [{ id: 'analytics.home', entry: 'src/frontend/Analytics.tsx', kind: 'page', route: '/analytics' }] },
  lifecycle: { supported: ['validate', 'initialize', 'start', 'stop', 'dispose'] }
});

const roots: string[] = [];
async function makeModule(root: string, directory: string, manifest: SkipoModuleManifest) {
  const app = join(root, directory);
  await mkdir(join(app, 'src/frontend'), { recursive: true });
  await mkdir(join(app, 'src/backend'), { recursive: true });
  await mkdir(join(app, 'src/libraries'), { recursive: true });
  await writeFile(join(app, 'package.json'), JSON.stringify({ name: 'fixture', private: true }));
  await writeFile(join(app, 'src/backend/AppBackend.ts'), 'export const backend = {};');
  await writeFile(join(app, 'src/frontend/Analytics.tsx'), 'export const Analytics = () => null;');
  await writeFile(join(app, 'skipo.module.json'), JSON.stringify(manifest));
}
async function tempRoot() { const root = await mkdtemp(join(tmpdir(), 'skipo-module-')); roots.push(root); return root; }
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe('Skipo Module Contract v1', () => {
  it('exports the versioned JSON Schema used by manifest tooling', () => {\n    expect(SKIPO_MODULE_MANIFEST_SCHEMA.properties.contractVersion.const).toBe('1.0.0');\n    expect(SKIPO_MODULE_MANIFEST_SCHEMA.required).toContain('module');\n  });\n  it('accepts a complete standalone-capable module', () => {
    expect(validateModuleManifest(fixture()).valid).toBe(true);
  });
  it('rejects malformed identity, version and non-module-capable applications', () => {
    const invalid = { ...fixture(), module: { ...fixture().module, id: 'Bad ID', version: 'latest' }, application: { ...fixture().application, moduleCapable: false } };
    const result = validateModuleManifest(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.map(issue => issue.code)).toEqual(expect.arrayContaining(['module.id', 'module.version', 'application.moduleCapable']));
  });
  it('rejects unsafe paths, invalid API routes and duplicate UI exports', () => {
    const base = fixture();
    const invalid = { ...base, api: { ...base.api, baseRoute: 'https://evil.test' , backendFacade: { ...base.api.backendFacade, entry: '../outside.ts' } }, ui: { exports: [base.ui.exports[0], base.ui.exports[0]] } };
    const result = validateModuleManifest(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.map(issue => issue.code)).toEqual(expect.arrayContaining(['api.route', 'api.backendFacade', 'ui.duplicate']));
  });
  it('requires complete lifecycle metadata and declared parent resource shape', () => {
    const base = fixture();
    const invalid = { ...base, lifecycle: { supported: ['start'] }, resources: { requires: [{ id: 'x' }], optional: [] } };
    const result = validateModuleManifest(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(issue => issue.code === 'lifecycle.missing')).toBe(true);
    expect(result.errors.some(issue => issue.code === 'resources.entry')).toBe(true);
  });
  it('validates actual complete application structure and referenced entry files', async () => {
    const root = await tempRoot();
    const directory = join(root, 'analytics');
    await makeModule(root, 'analytics', fixture());
    expect(validateModuleManifest(fixture(), directory).valid).toBe(true);
    await rm(join(directory, 'src/frontend/Analytics.tsx'));
    expect(validateModuleManifest(fixture(), directory).errors.some(issue => issue.code === 'ui.entry.missing')).toBe(true);
  });
  it('discovers multiple valid modules and rejects malformed candidates without executing them', async () => {
    const root = await tempRoot();
    const modules = join(root, 'src/modules');
    await mkdir(modules, { recursive: true });
    await makeModule(modules, 'analytics', fixture());
    const second = { ...fixture(), module: { id: 'com.example.reports', name: 'Reports', version: '1.0.0' } };
    await makeModule(modules, 'reports', second);
    const invalidDir = join(modules, 'broken');
    await mkdir(invalidDir);
    await writeFile(join(invalidDir, 'skipo.module.json'), '{invalid');
    const result = await discoverModules(modules);
    expect(result.modules.map(item => item.manifest.module.id)).toEqual(['com.example.analytics', 'com.example.reports']);
    expect(result.errors).toHaveLength(1);
  });
  it('reports duplicate stable IDs and missing module directories', async () => {
    const root = await tempRoot();
    const modules = join(root, 'modules');
    await mkdir(modules, { recursive: true });
    await makeModule(modules, 'one', fixture());
    await makeModule(modules, 'two', fixture());
    const result = await discoverModules(modules);
    expect(result.modules).toHaveLength(1);
    expect(result.errors[0].issues[0].code).toBe('discovery.duplicate-id');
    const missing = await discoverModules(join(root, 'does-not-exist'));
    expect(missing.errors[0].issues[0].code).toBe('discovery.directory');
  });
});
