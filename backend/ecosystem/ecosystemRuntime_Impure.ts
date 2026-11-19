import {
  consumeInvocation, createInvocation, findDeployment, refreshDeployment, refreshDeploymentById,
  publishDeploymentCapabilityRevision, normalizeStaticCapabilityDescriptors,
  type EcosystemEnv, type Query, type StaticCapabilityDescriptor, systemQuery,
  validatedDeploymentOrigin, validStaticHandle,
} from './deploymentStore_Impure.js';
import {
  handleDeploymentProof, type DeploymentEnvironment,
} from './deploymentProof_Impure.js';

const invocationPath = '/api/ecosystem/invoke';
const heartbeatInterval = 5 * 60_000;
const appPattern = /^[a-z][a-z0-9-]{0,62}$/;
// Dotted and colon-qualified registered operations share the registry's
// reserved-name and traversal guard; legacy camelCase remains compatible.
const ticketPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
type Capability = (params: unknown, context: {
  userId: string; callerApp: string; env: EcosystemEnv;
}) => Promise<unknown>;
type RemoteApps = Record<string, Record<string, (params: unknown) => Promise<unknown>>>;

function deploymentOrigin(input: unknown): string {
  return validatedDeploymentOrigin(input);
}

/**
 * Match the actual Skipo BackendFacade API (getService/listCapabilities and a
 * private Map) as well as compatibility facade inventories. No metadata-only
 * descriptor is proof that an operation is installed or callable.
 */
export interface BackendFacadeOperationSource {
  facade: {
    /** Canonical Skipo BackendFacade lookup; may throw if a service is missing. */
    getService?: (serviceId: string) => unknown;
    listCapabilities?: () => readonly {
      serviceId: string;
      invocation: { operation: string };
    }[];
    /** Transitional Kloks/consumer inventory; supports Map and plain record. */
    services?: ReadonlyMap<string, unknown> | Record<string, unknown>;
  };
  registry: {
    getCommand: (domain: string, operation: string) =>
      { handler?: unknown; domain?: string; name?: string } | undefined;
    getQuery: (domain: string, operation: string) =>
      { handler?: unknown; domain?: string; name?: string } | undefined;
  };
}

function installedBackendService(
  facade: BackendFacadeOperationSource['facade'], serviceId: string,
): unknown {
  // Real Skipo BackendFacade stores services in a private Map and exposes
  // getService(). Never infer service ownership from a public display name.
  if (typeof facade.getService === 'function') {
    try { return facade.getService(serviceId); } catch { return undefined; }
  }
  const services = facade.services;
  if (services instanceof Map) return services.get(serviceId);
  return services && Object.prototype.hasOwnProperty.call(services, serviceId)
    ? (services as Record<string, unknown>)[serviceId] : undefined;
}

function validRegisteredOperation(
  entry: { handler?: unknown; domain?: string; name?: string } | undefined,
  domain: string, operation: string,
): boolean {
  return !!entry && typeof entry.handler === 'function' &&
    (entry.domain === undefined || entry.domain === domain) &&
    (entry.name === undefined || entry.name === operation);
}

/** Verify exact runtime service + executing handler provenance on every publication. */
export function verifyRegisteredBackendFacadeOperations(
  source: BackendFacadeOperationSource | undefined,
  descriptors: readonly StaticCapabilityDescriptor[],
): void {
  if (!source?.facade ||
      (typeof source.facade.getService !== 'function' &&
        !source.facade.services) ||
      typeof source.registry?.getCommand !== 'function' ||
      typeof source.registry?.getQuery !== 'function') {
    throw new Error('Static publication requires a real BackendFacade and BackendRegistry.');
  }
  const facade = source.facade;
  for (const descriptor of descriptors) {
    const { serviceId, operationId } = descriptor.invocation;
    const service = installedBackendService(facade, serviceId);
    if (!service || typeof service !== 'object' ||
        ('id' in service && service.id !== serviceId) ||
        (typeof (service as { execute?: unknown }).execute !== 'function' &&
          typeof (service as { call?: unknown }).call !== 'function')) {
      throw new Error('Static capability service is not installed on BackendFacade.');
    }
    // No fallback from a malformed command to a different query operation:
    // the exact live registry domain, name and callable handler must match.
    const command = source.registry.getCommand(serviceId, operationId);
    const query = source.registry.getQuery(serviceId, operationId);
    const matches = Number(validRegisteredOperation(command, serviceId, operationId)) +
      Number(validRegisteredOperation(query, serviceId, operationId));
    if (matches !== 1) {
      throw new Error('Static capability operation is not uniquely registered in BackendRegistry.');
    }
    // If canonical facade metadata exists, do not advertise an operation that
    // its own service namespace does not expose.
    if (typeof facade.listCapabilities === 'function') {
      const catalog = facade.listCapabilities();
      if (!Array.isArray(catalog) ||
          !catalog.some(item => item?.serviceId === serviceId &&
            item?.invocation?.operation === operationId)) {
        throw new Error('Static capability operation is absent from BackendFacade capability catalog.');
      }
    }
  }
}

export function createEcosystemRuntime(options: {
  appId: string;
  /** Persistent deployment UUID, provisioned by an approved control plane. */
  deploymentId?: string;
  /** Explicit registered environment; never inferred from the deployment URL. */
  deploymentEnvironment?: DeploymentEnvironment;
  /** Static public metadata only; never include user workflows or session-bound endpoints. */
  capabilityDescriptors?: readonly StaticCapabilityDescriptor[];
  /** Real Kloks BackendFacade and BackendRegistry used to prove operation provenance. */
  backendFacadeOperations?: BackendFacadeOperationSource;
  capabilities: Record<string, Capability>;
  serviceCapabilities?: Record<string, (params: unknown, context: {
    callerApp: string; env: EcosystemEnv;
  }) => Promise<unknown>>;
  authenticate: (request: Request, env: EcosystemEnv) => Promise<string | null>;
  query?: (env: EcosystemEnv) => Query;
  send?: typeof globalThis.fetch;
}) {
  const { appId } = options;
  const methods = new Map(Object.entries(options.capabilities));
  const serviceMethods = new Map(Object.entries(options.serviceCapabilities ?? {}));
  const capabilities = [...new Set([...methods.keys(), ...serviceMethods.keys()])].sort();
  const capabilityDescriptors = options.capabilityDescriptors === undefined
    ? undefined : normalizeStaticCapabilityDescriptors(options.capabilityDescriptors);
  const verifiedSnapshotIds = new Set(capabilityDescriptors?.map(item => item.id) ?? []);
  if (!appPattern.test(appId) || capabilities.some(name => !validStaticHandle(name)) ||
      capabilities.length !== methods.size + serviceMethods.size) {
    throw new Error('Invalid ecosystem application or capability identifier.');
  }
  if (options.deploymentId !== undefined &&
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(options.deploymentId)) {
    throw new Error('Invalid ecosystem deployment identity.');
  }
  if (options.deploymentEnvironment !== undefined &&
      !['development', 'preview', 'staging', 'production']
        .includes(options.deploymentEnvironment)) {
    throw new Error('Invalid ecosystem deployment environment.');
  }
  // A public registry snapshot must describe operations actually installed on
  // this runtime. Client-supplied descriptors alone are never proof of a facade.
  if (capabilityDescriptors !== undefined) {
    if (!options.deploymentId) {
      throw new Error('Publishing static descriptors requires a stable deployment identity.');
    }
    if (capabilityDescriptors.some(descriptor =>
      !methods.has(descriptor.id) && !serviceMethods.has(descriptor.id))) {
      throw new Error('Static capability descriptors must reference registered callable capabilities.');
    }
    verifyRegisteredBackendFacadeOperations(options.backendFacadeOperations, capabilityDescriptors);
  }
  const query = options.query ?? systemQuery;
  const send = options.send ?? globalThis.fetch;
  let lastRefresh = 0;
  let lastUrl: unknown;
  let pending: Promise<void> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  function heartbeat(env: EcosystemEnv, force = false): Promise<void> {
    if (!env.APP_URL || !env.SYSTEM_DATABASE_URL) return Promise.resolve();
    // The untouched scaffold default is reserved for local development.
    if (env.APP_URL === 'http://localhost:3000') return Promise.resolve();
    if (pending) return pending;
    if (!force && lastUrl === env.APP_URL && Date.now() - lastRefresh < heartbeatInterval) {
      return Promise.resolve();
    }
    pending = Promise.resolve().then(async () => {
      if (options.deploymentId) {
        await refreshDeploymentById(query(env), appId, options.deploymentId,
          deploymentOrigin(env.APP_URL), capabilities);
        if (capabilityDescriptors !== undefined) {
          // A handler withdrawn after startup must disappear from the next
          // complete immutable revision rather than remain discoverable.
          const currentDescriptors = capabilityDescriptors.filter(descriptor => {
            try {
              verifyRegisteredBackendFacadeOperations(options.backendFacadeOperations, [descriptor]);
              return true;
            } catch {
              return false;
            }
          });
          await publishDeploymentCapabilityRevision(query(env), options.deploymentId, currentDescriptors);
        }
      } else {
        await refreshDeployment(query(env), appId, deploymentOrigin(env.APP_URL), capabilities);
      }
      lastUrl = env.APP_URL;
      lastRefresh = Date.now();
    }).finally(() => { pending = undefined; });
    return pending;
  }

  function observe(env: EcosystemEnv) {
    return heartbeat(env).catch(() => {
      console.error('[Skipo] Ecosystem deployment heartbeat failed for ' + appId);
    });
  }

  function start(env: EcosystemEnv) {
    const startup = observe(env);
    if (!timer) {
      timer = setInterval(() => { void observe(env); }, heartbeatInterval);
      (timer as unknown as { unref?: () => void }).unref?.();
    }
    return startup;
  }

  async function handle(request: Request, env: EcosystemEnv): Promise<Response | null> {
    const proof = handleDeploymentProof(request, env, {
      appId, deploymentId: options.deploymentId,
      environment: options.deploymentEnvironment,
    });
    if (proof) return proof;
    if (new URL(request.url).pathname !== invocationPath) return null;
    const respond = (body: unknown, status = 200) => Response.json(body, {
      status, headers: { 'cache-control': 'no-store' },
    });
    if (request.method !== 'POST') return respond({ error: 'METHOD_NOT_ALLOWED' }, 405);
    const ticket = request.headers.get('x-skipo-invocation') || '';
    if (!ticketPattern.test(ticket)) return respond({ error: 'INVALID_INVOCATION' }, 401);
    try {
      const invocation = await consumeInvocation(query(env), ticket, appId, deploymentOrigin(env.APP_URL));
      if (!invocation) return respond({ error: 'INVALID_INVOCATION' }, 401);
      // A single-use legacy ticket does NOT carry verified Luth audience, grant
      // or workspace claims. Published facade operations MUST be dispatched
      // through the target's authenticated Kloks invocation boundary.
      if (verifiedSnapshotIds.has(invocation.capability)) {
        return respond({ error: 'AUTHENTICATED_FACADE_ROUTE_REQUIRED' }, 403);
      }
      const context = { callerApp: invocation.caller_app, env };
      const service = serviceMethods.get(invocation.capability);
      if (service) return respond({ output: (await service(invocation.params, context)) ?? null });
      const execute = methods.get(invocation.capability);
      if (!execute) return respond({ error: 'CAPABILITY_NOT_AVAILABLE' }, 404);
      if (!invocation.user_id) return respond({ error: 'LUTH_SESSION_REQUIRED' }, 403);
      const output = await execute(invocation.params, { ...context, userId: invocation.user_id });
      return respond({ output: output ?? null });
    } catch {
      return respond({ error: 'CAPABILITY_EXECUTION_FAILED' }, 500);
    }
  }

  async function client(request: Request, env: EcosystemEnv): Promise<RemoteApps> {
    const userId = await options.authenticate(request, env);
    if (!userId) throw new Error('A verified Luth session is required to call ecosystem apps.');
    return createClient(env, userId);
  }

  function createClient(env: EcosystemEnv, userId: string | null): RemoteApps {
    async function invoke(app: string, capability: string, params: unknown) {
      const payload = JSON.stringify(params ?? null);
      if (new TextEncoder().encode(payload).byteLength > 64 * 1024) {
        throw new Error('Ecosystem capability parameters exceed 64 KiB.');
      }
      const database = query(env);
      const target = await findDeployment(database, app, capability);
      if (!target) throw new Error(`No active deployment exposes ${app}.${capability}.`);
      const url = deploymentOrigin(target);
      const id = await createInvocation(database, appId, app, url, capability, userId, payload);
      const response = await send(url + invocationPath, {
        method: 'POST', headers: { 'x-skipo-invocation': id }, redirect: 'error',
        signal: AbortSignal.timeout(10_000), cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Capability ${app}.${capability} returned HTTP ${response.status}.`);
      const data = await response.json() as { output: unknown };
      if (!data || !Object.hasOwn(data, 'output')) throw new Error('Invalid ecosystem capability response.');
      return data.output;
    }

    return new Proxy(Object.create(null) as RemoteApps, {
      get: (_apps, app) => typeof app !== 'string' || app === 'then' || !appPattern.test(app)
        ? undefined
        : new Proxy(Object.create(null), {
          get: (_target, capability) => typeof capability !== 'string' ||
            capability === 'then' || !validStaticHandle(capability)
            ? undefined : (params: unknown) => invoke(app, capability, params),
        }),
    });
  }

  return { heartbeat, observe, start, handle, client,
    serviceClient: (env: EcosystemEnv) => createClient(env, null),
  };
}
