/** JSON Schema for the versioned, declarative Skipo Module manifest. */
export const SKIPO_MODULE_MANIFEST_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://skipo.dev/schemas/module-v1.json',
  title: 'Skipo Module Manifest',
  type: 'object',
  additionalProperties: false,
  required: ['contractVersion', 'module', 'application', 'api', 'capabilities', 'runtime', 'resources', 'ui', 'lifecycle'],
  properties: {
    contractVersion: { type: 'string', const: '1.0.0' },
    module: {
      type: 'object', additionalProperties: false, required: ['id', 'name', 'version'],
      properties: {
        id: { type: 'string', pattern: '^[a-z0-9]+(?:[.-][a-z0-9]+)*$' },
        name: { type: 'string', minLength: 1 },
        version: { type: 'string', pattern: '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$' },
        description: { type: 'string' }
      }
    },
    application: {
      type: 'object', additionalProperties: false,
      required: ['framework', 'root', 'standalone', 'moduleCapable', 'execution'],
      properties: {
        framework: { const: 'skipo' }, root: { type: 'string' },
        standalone: { const: true }, moduleCapable: { const: true },
        execution: { enum: ['standalone', 'embedded', 'both'] }
      }
    },
    api: {
      type: 'object', additionalProperties: false, required: ['baseRoute', 'backendFacade'],
      properties: {
        baseRoute: { type: 'string', pattern: '^/api(?:/[a-zA-Z0-9._~-]+)*$' },
        backendFacade: {
          type: 'object', additionalProperties: false, required: ['mode', 'entry', 'consumes'],
          properties: {
            mode: { const: 'declared' }, entry: { type: 'string', minLength: 1 },
            consumes: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true }
          }
        }
      }
    },
    capabilities: { type: 'array', items: { type: 'object', required: ['id', 'description'], properties: { id: { type: 'string' }, description: { type: 'string' }, version: { type: 'string' } }, additionalProperties: false } },
    runtime: { type: 'object', required: ['targets', 'requirements'], properties: { targets: { type: 'array', items: { type: 'string' }, minItems: 1, uniqueItems: true }, requirements: { type: 'array', items: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, range: { type: 'string' }, optional: { type: 'boolean' } }, additionalProperties: false } } }, additionalProperties: false },
    resources: { type: 'object', required: ['requires', 'optional'], properties: { requires: { type: 'array' }, optional: { type: 'array' } }, additionalProperties: false },
    ui: { type: 'object', required: ['exports'], properties: { exports: { type: 'array', items: { type: 'object', required: ['id', 'entry', 'kind'], properties: { id: { type: 'string' }, entry: { type: 'string' }, kind: { enum: ['page', 'panel', 'widget', 'navigation'] }, route: { type: 'string' } }, additionalProperties: false } } }, additionalProperties: false },
    lifecycle: { type: 'object', required: ['supported'], properties: { supported: { type: 'array', items: { enum: ['validate', 'initialize', 'start', 'stop', 'dispose'] }, uniqueItems: true } }, additionalProperties: false }
  }
} as const;
