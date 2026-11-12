import { existsSync } from 'node:fs';
import { isAbsolute, resolve, relative, sep } from 'node:path';
import type { ModuleValidationIssue, ModuleValidationResult } from './ModuleTypes.js';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const MODULE_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const REQUIRED_LIFECYCLE = ['validate', 'initialize', 'start', 'stop', 'dispose'] as const;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const safeRelativePath = (value: unknown): value is string =>
  isString(value) && !isAbsolute(value) && !value.split(/[\\/]/).includes('..') && !value.includes('\0');

export function validateModuleManifest(input: unknown, moduleDirectory?: string): ModuleValidationResult {
  const errors: ModuleValidationIssue[] = [];
  const warnings: ModuleValidationIssue[] = [];
  const add = (code: string, path: string, message: string) => errors.push({ code, path, message });
  if (!isRecord(input)) return { valid: false, errors: [{ code: 'manifest.object', path: '$', message: 'Manifest must be a JSON object.' }], warnings };
  const module = input.module;
  const app = input.application;
  const api = input.api;
  const backend = isRecord(api) ? api.backendFacade : undefined;
  const runtime = input.runtime;
  const resources = input.resources;
  const ui = input.ui;
  const lifecycle = input.lifecycle;
  const appRecord = isRecord(app) ? app : {};
  const backendRecord = isRecord(backend) ? backend : {};
  const resourcesRecord = isRecord(resources) ? resources : {};
  const uiRecord = isRecord(ui) ? ui : {};
  const requiredResources = Array.isArray(resourcesRecord.requires) ? resourcesRecord.requires : [];
  const optionalResources = Array.isArray(resourcesRecord.optional) ? resourcesRecord.optional : [];
  const uiExports = Array.isArray(uiRecord.exports) ? uiRecord.exports : [];

  if (input.contractVersion !== '1.0.0') add('manifest.version', 'contractVersion', 'Unsupported module contract version; expected 1.0.0.');
  if (!isRecord(module)) add('module.object', 'module', 'Module identity is required.');
  else {
    if (!isString(module.id) || !MODULE_ID.test(module.id)) add('module.id', 'module.id', 'Module ID must be a stable lowercase identifier using letters, digits, dots or hyphens.');
    if (!isString(module.name)) add('module.name', 'module.name', 'Module name is required.');
    if (!isString(module.version) || !SEMVER.test(module.version)) add('module.version', 'module.version', 'Module version must be semantic versioning.');
  }
  if (!isRecord(app)) add('application.object', 'application', 'Application declaration is required.');
  else {
    if (app.framework !== 'skipo') add('application.framework', 'application.framework', 'Module must declare the Skipo framework.');
    if (!safeRelativePath(app.root)) add('application.root', 'application.root', 'Application root must be a safe relative path.');
    if (app.standalone !== true) add('application.standalone', 'application.standalone', 'A module must remain independently executable.');
    if (app.moduleCapable !== true) add('application.moduleCapable', 'application.moduleCapable', 'Application must explicitly declare module capability.');
    if (!['standalone', 'embedded', 'both'].includes(String(app.execution))) add('application.execution', 'application.execution', 'Execution must be standalone, embedded or both.');
  }
  if (!isRecord(api)) add('api.object', 'api', 'API declaration is required.');
  else {
    if (!isString(api.baseRoute) || !/^\/api(?:\/[a-zA-Z0-9._~-]+)*$/.test(api.baseRoute)) add('api.route', 'api.baseRoute', 'API base route must be an absolute /api route without query or fragment.');
    if (!isRecord(backend) || backend.mode !== 'declared' || !safeRelativePath(backend.entry) || !isStringArray(backend.consumes)) add('api.backendFacade', 'api.backendFacade', 'A declared backend facade entry and consumed-resource list are required.');
    else if (new Set(backend.consumes).size !== backend.consumes.length) add('api.backendFacade.duplicate', 'api.backendFacade.consumes', 'Consumed parent resources must be unique.');
  }
  if (!Array.isArray(input.capabilities) || input.capabilities.some(c => !isRecord(c) || !isString(c.id) || !isString(c.description))) add('capabilities.shape', 'capabilities', 'Capabilities must contain unique IDs and descriptions.');
  else if (new Set(input.capabilities.map(c => (c as Record<string, unknown>).id)).size !== input.capabilities.length) add('capabilities.duplicate', 'capabilities', 'Capability IDs must be unique.');
  if (!isRecord(runtime) || !isStringArray(runtime.targets) || runtime.targets.length === 0 || !Array.isArray(runtime.requirements)) add('runtime.shape', 'runtime', 'Runtime targets and requirements must be declared.');
  else {
    if (new Set(runtime.targets).size !== runtime.targets.length) add('runtime.targets.duplicate', 'runtime.targets', 'Runtime targets must be unique.');
    runtime.requirements.forEach((requirement, index) => {
      if (!isRecord(requirement) || !isString(requirement.id)) add('runtime.requirement', `runtime.requirements[${index}]`, 'Runtime requirements need a stable ID.');
    });
  }
  if (!isRecord(resources) || !Array.isArray(resourcesRecord.requires) || !Array.isArray(resourcesRecord.optional)) add('resources.shape', 'resources', 'Required and optional parent resources must be declared as arrays.');
  else {
    for (const [group, entries] of [['requires', requiredResources], ['optional', optionalResources]] as const) {
      entries.forEach((entry, index) => {
        if (!isRecord(entry) || !isString(entry.id) || !isString(entry.kind) || typeof entry.required !== 'boolean') add('resources.entry', `resources.${group}[${index}]`, 'Resource entries require id, kind and required boolean.');
      });
    }
  }
  if (!isRecord(ui) || !Array.isArray(uiRecord.exports)) add('ui.shape', 'ui.exports', 'UI exports must be declared as an array.');
  else {
    const ids = new Set<string>();
    uiExports.forEach((entry, index) => {
      if (!isRecord(entry) || !isString(entry.id) || !safeRelativePath(entry.entry) || !['page', 'panel', 'widget', 'navigation'].includes(String(entry.kind))) add('ui.entry', `ui.exports[${index}]`, 'UI exports require a unique ID, safe entry path and supported kind.');
      else if (ids.has(entry.id)) add('ui.duplicate', `ui.exports[${index}].id`, 'UI export IDs must be unique.');
      else ids.add(entry.id);
    });
  }
  if (!isRecord(lifecycle) || !Array.isArray(lifecycle.supported)) add('lifecycle.shape', 'lifecycle.supported', 'Supported lifecycle phases must be declared.');
  else {
    const allowed = new Set(REQUIRED_LIFECYCLE);
    for (const phase of lifecycle.supported) if (!allowed.has(phase as typeof REQUIRED_LIFECYCLE[number])) add('lifecycle.phase', 'lifecycle.supported', `Unsupported lifecycle phase "${String(phase)}".`);
    for (const phase of REQUIRED_LIFECYCLE) if (!lifecycle.supported.includes(phase)) add('lifecycle.missing', 'lifecycle.supported', `Required lifecycle phase "${phase}" is missing.`);
  }

  if (moduleDirectory && errors.length === 0) {
    const appRoot = resolve(moduleDirectory, appRecord.root as string);
    const ensureInside = (candidate: string) => {
      const rel = relative(resolve(moduleDirectory), candidate);
      return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
    };
    if (!ensureInside(appRoot)) add('application.root.escape', 'application.root', 'Application root resolves outside the module directory.');
    else {
      for (const directory of ['src/frontend', 'src/backend', 'src/libraries']) {
        if (!existsSync(resolve(appRoot, directory))) add('application.structure', directory, `Complete Skipo application plane "${directory}" is missing.`);
      }
      if (!existsSync(resolve(appRoot, 'package.json'))) add('application.package', 'package.json', 'Complete Skipo application must include package.json.');
      const backendEntry = resolve(appRoot, backendRecord.entry as string);
      if (!ensureInside(backendEntry) || !existsSync(backendEntry)) add('api.backendFacade.entry', 'api.backendFacade.entry', 'Declared backend facade entry must exist inside the application root.');
      for (const [index, entry] of uiExports.entries()) {
        if (!isRecord(entry)) continue;
        const target = resolve(appRoot, entry.entry as string);
        if (!ensureInside(target) || !existsSync(target)) add('ui.entry.missing', `ui.exports[${index}].entry`, 'Declared UI export entry must exist inside the application root.');
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}
