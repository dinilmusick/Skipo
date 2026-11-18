import {
  consumeInvocation, createInvocation, findDeployment, refreshDeployment, systemQuery,
  type EcosystemEnv, type Query,
} from './deploymentStore_Impure.js';

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

export function createEcosystemRuntime(options: {
  appId: string;
  capabilities: Record<string, Capability>;
  serviceCapabilities?: Record<string, (params: unknown, context: {
    callerApp: string; env: EcosystemEnv;
  }) => Promise<unknown>>;
  authenticate: (request: Request, env: EcosystemEnv) => Promise<string | null>;
  /** Set only from a trusted registry attestation. Omitted/false means pending enrollment. */
  appIdentityAuthorityVerified?: boolean;
  query?: (env: EcosystemEnv) => Query;
  send?: typeof globalThis.fetch;
}) {
  const { appId } = options;
  const methods = new Map(Object.entries(options.capabilities));
  const serviceMethods = new Map(Object.entries(options.serviceCapabilities ?? {}));
  const capabilities = [...new Set([...methods.keys(), ...serviceMethods.keys()])].sort();
  if (!appPattern.test(appId) || capabilities.some(name => !capabilityPattern.test(name)) ||
      capabilities.length !== methods.size + serviceMethods.size) {
    throw new Error('Invalid ecosystem application or capability identifier.');
  }
  // Never infer enrollment from appId or local configuration. Direct factory users
  // must supply an explicit, trusted authority result; the default is fail-closed.
  const identityAuthorityVerified = options.appIdentityAuthorityVerified === true;
  const query = options.query ?? systemQuery;
  const send = options.send ?? globalThis.fetch;
  let lastRefresh = 0;
  let lastUrl: unknown;
  let pending: Promise<void> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  function heartbeat(env: EcosystemEnv, force = false): Promise<void> {
    if (!identityAuthorityVerified) return Promise.resolve();
    if (!env.APP_URL || !env.SYSTEM_DATABASE_URL) return Promise.resolve();
    // The untouched scaffold default is reserved for local development.
    if (env.APP_URL === 'http://localhost:3000') return Promise.resolve();
    if (pending) return pending;
    if (!force && lastUrl === env.APP_URL && Date.now() - lastRefresh < heartbeatInterval) {
      return Promise.resolve();
    }
    pending = Promise.resolve().then(async () => {
      await refreshDeployment(query(env), appId, deploymentOrigin(env.APP_URL), capabilities);
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
    if (!identityAuthorityVerified) return Promise.resolve();
    const startup = observe(env);
    if (!timer) {
      timer = setInterval(() => { void observe(env); }, heartbeatInterval);
      (timer as unknown as { unref?: () => void }).unref?.();
    }
    return startup;
  }

  async function handle(request: Request, env: EcosystemEnv): Promise<Response | null> {
    if (new URL(request.url).pathname !== invocationPath) return null;
    const respond = (body: unknown, status = 200) => Response.json(body, {
      status, headers: { 'cache-control': 'no-store' },
    });
    if (!identityAuthorityVerified) {
      return respond({ error: 'APP_ENROLLMENT_REQUIRED' }, 503);
    }
    if (request.method !== 'POST') return respond({ error: 'METHOD_NOT_ALLOWED' }, 405);
    const ticket = request.headers.get('x-skipo-invocation') || '';
    if (!ticketPattern.test(ticket)) return respond({ error: 'INVALID_INVOCATION' }, 401);
    try {
      const invocation = await consumeInvocation(query(env), ticket, appId, deploymentOrigin(env.APP_URL));
      if (!invocation) return respond({ error: 'INVALID_INVOCATION' }, 401);
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
    if (!identityAuthorityVerified) {
      throw new Error('Application enrollment is required before calling ecosystem apps.');
    }
    const userId = await options.authenticate(request, env);
    if (!userId) throw new Error('A verified Luth session is required to call ecosystem apps.');
    return createClient(env, userId);
  }

  function createClient(env: EcosystemEnv, userId: string | null): RemoteApps {
    async function invoke(app: string, capability: string, params: unknown) {
      if (!identityAuthorityVerified) {
        throw new Error('Application enrollment is required before calling ecosystem apps.');
      }
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
