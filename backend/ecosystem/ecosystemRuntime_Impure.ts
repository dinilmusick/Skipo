import {
  consumeInvocation, createInvocation, findDeployment, refreshDeployment, refreshDeploymentById,
  publishDeploymentCapabilityRevision, normalizeStaticCapabilityDescriptors,
  type EcosystemEnv, type Query, type StaticCapabilityDescriptor, systemQuery,
} from './deploymentStore_Impure.js';
import {
  handleDeploymentProof, type DeploymentEnvironment,
} from './deploymentProof_Impure.js';

const invocationPath = '/api/ecosystem/invoke';
const heartbeatInterval = 5 * 60_000;
const appPattern = /^[a-z][a-z0-9-]{0,62}$/;
const capabilityPattern = /^[a-z][a-zA-Z0-9_]{0,63}$/;
const ticketPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
type Capability = (params: unknown, context: {
  userId: string; callerApp: string; env: EcosystemEnv;
}) => Promise<unknown>;
type RemoteApps = Record<string, Record<string, (params: unknown) => Promise<unknown>>>;

function deploymentOrigin(input: unknown): string {
  const url = new URL(typeof input === 'string' ? input.trim() : '');
  const host = url.hostname;
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.pathname !== '/' || url.search || url.hash || !host.includes('.') ||
      /^(?:\d+\.){3}\d+$/.test(host) || /\.(?:localhost|local|internal)\.?$/.test(host)) {
    throw new Error('Ecosystem APP_URL must be an HTTPS origin with a DNS name.');
  }
  return url.origin;
}

/** Exact registered BackendRegistry handler and live BackendFacade service inventory. */
export interface BackendFacadeOperationSource {
  facade: { services: Record<string, unknown> };
  registry: {
    getCommand: (domain: string, operation: string) => { handler?: unknown } | undefined;
    getQuery: (domain: string, operation: string) => { handler?: unknown } | undefined;
  };
}

/** A manually supplied descriptor alone cannot attest that its operation exists. */
export function verifyRegisteredBackendFacadeOperations(
  source: BackendFacadeOperationSource | undefined,
  descriptors: readonly StaticCapabilityDescriptor[],
): void {
  if (!source?.facade?.services ||
      typeof source.registry?.getCommand !== 'function' ||
      typeof source.registry?.getQuery !== 'function') {
    throw new Error('Static publication requires a real BackendFacade and BackendRegistry.');
  }
  for (const descriptor of descriptors) {
    const { serviceId, operationId } = descriptor.invocation;
    const services = source.facade.services;
    const service = Object.prototype.hasOwnProperty.call(services, serviceId)
      ? services[serviceId] : undefined;
    if (!service || typeof service !== 'object' ||
        typeof (service as { execute?: unknown }).execute !== 'function') {
      throw new Error('Static capability service is not installed on BackendFacade.');
    }
    const registered = source.registry.getCommand(serviceId, operationId)
      ?? source.registry.getQuery(serviceId, operationId);
    if (!registered || typeof registered.handler !== 'function') {
      throw new Error('Static capability operation is not registered in BackendRegistry.');
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
  if (!appPattern.test(appId) || capabilities.some(name => !capabilityPattern.test(name)) ||
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
          await publishDeploymentCapabilityRevision(query(env), options.deploymentId, capabilityDescriptors);
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
            capability === 'then' || !capabilityPattern.test(capability)
            ? undefined : (params: unknown) => invoke(app, capability, params),
        }),
    });
  }

  return { heartbeat, observe, start, handle, client,
    serviceClient: (env: EcosystemEnv) => createClient(env, null),
  };
}
