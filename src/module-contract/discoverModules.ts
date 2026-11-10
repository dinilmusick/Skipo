import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { DiscoveredModule, ModuleDiscoveryResult, ModuleValidationIssue, SkipoModuleManifest } from './ModuleTypes.js';
import { validateModuleManifest } from './validateModuleManifest.js';

export async function discoverModules(modulesDirectory: string): Promise<ModuleDiscoveryResult> {
  const modules: DiscoveredModule[] = [];
  const errors: { directory: string; issues: readonly ModuleValidationIssue[] }[] = [];
  let entries;
  try { entries = await readdir(modulesDirectory, { withFileTypes: true }); }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read module directory.';
    return { modules, errors: [{ directory: modulesDirectory, issues: [{ code: 'discovery.directory', path: modulesDirectory, message }] }] };
  }
  const seenIds = new Set<string>();
  for (const entry of entries.filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const directory = resolve(modulesDirectory, entry.name);
    const manifestPath = join(directory, 'skipo.module.json');
    let parsed: unknown;
    try { parsed = JSON.parse(await readFile(manifestPath, 'utf8')); }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read module manifest.';
      errors.push({ directory, issues: [{ code: 'discovery.manifest', path: manifestPath, message }] });
      continue;
    }
    const validation = validateModuleManifest(parsed, directory);
    if (!validation.valid) { errors.push({ directory, issues: validation.errors }); continue; }
    const manifest = parsed as SkipoModuleManifest;
    if (seenIds.has(manifest.module.id)) {
      errors.push({ directory, issues: [{ code: 'discovery.duplicate-id', path: 'module.id', message: `Duplicate module ID "${manifest.module.id}".` }] });
      continue;
    }
    seenIds.add(manifest.module.id);
    modules.push({ directory, manifestPath, manifest });
  }
  return { modules, errors };
}
