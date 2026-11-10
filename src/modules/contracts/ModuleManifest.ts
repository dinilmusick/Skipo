export type SkipoModuleKind = 'skipo-application';

export interface ModuleManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly kind: SkipoModuleKind;
  readonly description?: string;
  readonly dependencies?: readonly string[];
  readonly capabilities?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ModuleMetadata extends ModuleManifest {
  readonly hostId: string;
  readonly instanceId: string;
}

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function validateModuleManifest(
  value: unknown
): asserts value is ModuleManifest {
  if (!value || typeof value !== 'object') {
    throw new Error('Module manifest must be an object.');
  }
  const manifest = value as Partial<ModuleManifest>;
  if (typeof manifest.id !== 'string' || !ID_PATTERN.test(manifest.id)) {
    throw new Error('Module manifest id must be a stable lowercase identifier.');
  }
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    throw new Error('Module manifest name is required.');
  }
  if (typeof manifest.version !== 'string' ||
      !VERSION_PATTERN.test(manifest.version)) {
    throw new Error('Module manifest version must be valid semantic version syntax.');
  }
  if (manifest.kind !== 'skipo-application') {
    throw new Error('Module kind must be skipo-application.');
  }
  for (const field of ['capabilities', 'dependencies'] as const) {
    const entries = manifest[field];
    if (entries !== undefined &&
        (!Array.isArray(entries) ||
         entries.some((entry) => typeof entry !== 'string' || !entry.trim()))) {
      throw new Error(`Module manifest ${field} must contain non-empty strings.`);
    }
    if (entries && new Set(entries).size !== entries.length) {
      throw new Error(`Module manifest ${field} cannot contain duplicates.`);
    }
  }
  if (manifest.metadata !== undefined &&
      (!manifest.metadata || typeof manifest.metadata !== 'object' ||
       Array.isArray(manifest.metadata))) {
    throw new Error('Module manifest metadata must be an object.');
  }
}
