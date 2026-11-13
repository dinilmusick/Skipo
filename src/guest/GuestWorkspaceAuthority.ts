import type {
  GuestRuntimeUsage,
  GuestWorkspaceEntry,
  GuestWorkspaceQuotas,
  GuestWorkspaceStore,
} from './GuestWorkspace.js';

export class GuestWorkspaceAuthorityError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GuestWorkspaceAuthorityError';
  }
}

interface NamespaceState {
  expiresAt: number;
  readonly files: Map<string, Uint8Array>;
  readonly directories: Set<string>;
  operations: number;
  runtimeMemoryBytes: number;
  runtimeCpuMs: number;
  runtimeDurationMs: number;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new GuestWorkspaceAuthorityError(name + ' must be a positive integer', 'INVALID_QUOTA', 400);
  }
  return value;
}

function safePath(path: string): string {
  if (!path || path.startsWith('/') || path.includes('\\\\') ||
      path.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new GuestWorkspaceAuthorityError('Workspace path is invalid', 'INVALID_PATH', 400);
  }
  return path;
}

function entry(path: string, sizeBytes: number, isFolder: boolean): GuestWorkspaceEntry {
  return {
    path,
    name: path.split('/').pop() ?? path,
    sizeBytes,
    updatedAt: Date.now(),
    isFolder,
  };
}

/**
 * Single-process volatile authority. Run one instance per authority deployment.
 * It intentionally has no disk/database fallback: a process restart destroys all
 * guest data, and missing namespaces are never recreated by ordinary read/write.
 */
export class InMemoryGuestWorkspaceAuthority implements GuestWorkspaceStore {
  private readonly namespaces = new Map<string, NamespaceState>();
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly now: () => number = Date.now) {}

  private async exclusive<T>(operation: () => T | Promise<T>): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => { release = resolve; });
    const previous = this.tail;
    this.tail = previous.then(() => next);
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private active(namespace: string): NamespaceState {
    const state = this.namespaces.get(namespace);
    if (!state || state.expiresAt <= this.now()) {
      if (state) this.namespaces.delete(namespace);
      throw new GuestWorkspaceAuthorityError(
        'Guest workspace is unavailable or expired',
        'GUEST_WORKSPACE_UNAVAILABLE',
        410,
      );
    }
    return state;
  }

  async createNamespace(
    namespace: string,
    expiresAt: number,
    limits: Pick<GuestWorkspaceQuotas, 'maxConcurrentLeases'>,
  ): Promise<void> {
    await this.exclusive(() => {
      if (!namespace || !Number.isFinite(expiresAt) || expiresAt <= this.now()) {
        throw new GuestWorkspaceAuthorityError('Invalid guest namespace or expiry', 'INVALID_NAMESPACE', 400);
      }
      const capacity = positiveInteger(limits.maxConcurrentLeases, 'maxConcurrentLeases');
      for (const [key, value] of this.namespaces) {
        if (value.expiresAt <= this.now()) this.namespaces.delete(key);
      }
      if (this.namespaces.has(namespace)) return;
      if (this.namespaces.size >= capacity) {
        throw new GuestWorkspaceAuthorityError('Guest deployment capacity is exhausted', 'GUEST_CAPACITY_EXHAUSTED', 429);
      }
      this.namespaces.set(namespace, {
        expiresAt,
        files: new Map(),
        directories: new Set(),
        operations: 0,
        runtimeMemoryBytes: 0,
        runtimeCpuMs: 0,
        runtimeDurationMs: 0,
      });
    });
  }

  async read(namespace: string, path: string): Promise<Uint8Array | undefined> {
    return this.exclusive(() => {
      const value = this.active(namespace).files.get(safePath(path));
      return value ? value.slice() : undefined;
    });
  }

  async write(
    namespace: string,
    path: string,
    data: Uint8Array,
    limits: Pick<GuestWorkspaceQuotas, 'maxBytes' | 'maxFiles'>,
  ): Promise<void> {
    await this.exclusive(() => {
      const state = this.active(namespace);
      const key = safePath(path);
      const maxBytes = positiveInteger(limits.maxBytes, 'maxBytes');
      const maxFiles = positiveInteger(limits.maxFiles, 'maxFiles');
      const previous = state.files.get(key);
      let usedBytes = 0;
      for (const [file, bytes] of state.files) {
        if (file !== key) usedBytes += bytes.byteLength;
      }
      const nextBytes = usedBytes + data.byteLength;
      const nextFiles = state.files.size + (previous ? 0 : 1);
      if (nextBytes > maxBytes || nextFiles > maxFiles) {
        throw new GuestWorkspaceAuthorityError('Guest workspace quota exceeded', 'GUEST_QUOTA_EXCEEDED', 413);
      }
      state.files.set(key, data.slice());
    });
  }

  async delete(namespace: string, path: string): Promise<boolean> {
    return this.exclusive(() => this.active(namespace).files.delete(safePath(path)));
  }

  async mkdir(namespace: string, path: string): Promise<void> {
    await this.exclusive(() => {
      const state = this.active(namespace);
      const key = safePath(path);
      state.directories.add(key);
      const parts = key.split('/');
      for (let index = 1; index < parts.length; index += 1) {
        state.directories.add(parts.slice(0, index).join('/'));
      }
    });
  }

  async list(namespace: string, prefix: string): Promise<GuestWorkspaceEntry[]> {
    return this.exclusive(() => {
      const state = this.active(namespace);
      const normalized = prefix ? safePath(prefix) : '';
      const files = [...state.files.entries()]
        .filter(([path]) => !normalized || path === normalized || path.startsWith(normalized + '/'))
        .map(([path, bytes]) => entry(path, bytes.byteLength, false));
      const directories = [...state.directories]
        .filter((path) => !normalized || path === normalized || path.startsWith(normalized + '/'))
        .map((path) => entry(path, 0, true));
      return [...directories, ...files].sort((left, right) => left.path.localeCompare(right.path));
    });
  }

  async consume(
    namespace: string,
    usage: { operations: number },
    quota: Pick<GuestWorkspaceQuotas, 'maxOperations'>,
  ): Promise<void> {
    await this.exclusive(() => {
      const state = this.active(namespace);
      const amount = positiveInteger(usage.operations, 'operations');
      const maximum = positiveInteger(quota.maxOperations, 'maxOperations');
      if (state.operations + amount > maximum) {
        throw new GuestWorkspaceAuthorityError('Guest operation budget exceeded', 'GUEST_QUOTA_EXCEEDED', 429);
      }
      state.operations += amount;
    });
  }

  async consumeRuntime(
    namespace: string,
    usage: GuestRuntimeUsage,
    quota: Pick<GuestWorkspaceQuotas, 'maxRuntimeMemoryBytes' | 'maxRuntimeCpuMs' | 'maxRuntimeDurationMs'>,
  ): Promise<void> {
    await this.exclusive(() => {
      const state = this.active(namespace);
      const values = [usage.memoryBytes, usage.cpuMs, usage.durationMs];
      if (values.some((value) => !Number.isFinite(value) || value < 0)) {
        throw new GuestWorkspaceAuthorityError('Runtime usage is invalid', 'INVALID_USAGE', 400);
      }
      const memory = positiveInteger(quota.maxRuntimeMemoryBytes, 'maxRuntimeMemoryBytes');
      const cpu = positiveInteger(quota.maxRuntimeCpuMs, 'maxRuntimeCpuMs');
      const duration = positiveInteger(quota.maxRuntimeDurationMs, 'maxRuntimeDurationMs');
      const nextCpu = state.runtimeCpuMs + usage.cpuMs;
      const nextDuration = state.runtimeDurationMs + usage.durationMs;
      if (usage.memoryBytes > memory || nextCpu > cpu || nextDuration > duration) {
        throw new GuestWorkspaceAuthorityError('Guest runtime budget exceeded', 'GUEST_RUNTIME_BUDGET_EXCEEDED', 429);
      }
      state.runtimeMemoryBytes = usage.memoryBytes;
      state.runtimeCpuMs = nextCpu;
      state.runtimeDurationMs = nextDuration;
    });
  }

  async deleteNamespace(namespace: string): Promise<boolean> {
    return this.exclusive(() => this.namespaces.delete(namespace));
  }

  async deleteExpired(now: number): Promise<number> {
    return this.exclusive(() => {
      let removed = 0;
      for (const [namespace, state] of this.namespaces) {
        if (state.expiresAt <= now) {
          this.namespaces.delete(namespace);
          removed += 1;
        }
      }
      return removed;
    });
  }

  /** Safe for a scheduled job or a bounded request-triggered sweep. */
  async reapExpired(): Promise<number> {
    return this.deleteExpired(this.now());
  }
}

export interface GuestWorkspaceAuthorityHandlerOptions {
  /** At least 32 random bytes, injected from deployment secrets. */
  serviceToken: string;
  authority: GuestWorkspaceStore;
  maxBodyBytes?: number;
}

function equalSecret(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return mismatch === 0;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GuestWorkspaceAuthorityError('Invalid request body', 'INVALID_REQUEST', 400);
  }
  return value as Record<string, unknown>;
}

function stringField(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || !value) {
    throw new GuestWorkspaceAuthorityError('Invalid ' + key, 'INVALID_REQUEST', 400);
  }
  return value;
}

function numberField(input: Record<string, unknown>, key: string): number {
  const value = input[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GuestWorkspaceAuthorityError('Invalid ' + key, 'INVALID_REQUEST', 400);
  }
  return value;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToBase64(value: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < value.length; offset += 0x8000) {
    binary += String.fromCharCode(...value.subarray(offset, Math.min(offset + 0x8000, value.length)));
  }
  return btoa(binary);
}

export function createGuestWorkspaceAuthorityHandler(
  options: GuestWorkspaceAuthorityHandlerOptions,
): (request: Request) => Promise<Response> {
  if (options.serviceToken.length < 43) throw new Error('Guest authority service token must contain at least 32 random bytes');
  const maxBodyBytes = options.maxBodyBytes ?? 16 * 1024 * 1024;
  positiveInteger(maxBodyBytes, 'maxBodyBytes');

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true, mode: 'volatile-memory', persistentWorkspace: false }, {
        headers: { 'cache-control': 'no-store' },
      });
    }
    if (url.pathname !== '/v1/guest-workspace' || request.method !== 'POST') {
      return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
    }
    const authorization = request.headers.get('authorization') ?? '';
    if (!equalSecret(authorization, 'Bearer ' + options.serviceToken)) {
      return Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401, headers: { 'cache-control': 'no-store' } });
    }
    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (declaredLength > maxBodyBytes) {
      return Response.json({ error: { code: 'BODY_TOO_LARGE' } }, { status: 413 });
    }

    try {
      const raw = await request.arrayBuffer();
      if (raw.byteLength > maxBodyBytes) {
        return Response.json({ error: { code: 'BODY_TOO_LARGE' } }, { status: 413 });
      }
      const input = object(JSON.parse(new TextDecoder().decode(raw)));
      const action = stringField(input, 'action');
      const namespace = typeof input.namespace === 'string' ? input.namespace : '';
      let result: unknown;
      switch (action) {
        case 'createNamespace': {
          const limits = object(input.limits);
          await options.authority.createNamespace(namespace, numberField(input, 'expiresAt'), {
            maxConcurrentLeases: numberField(limits, 'maxConcurrentLeases'),
          });
          result = null;
          break;
        }
        case 'read': {
          const value = await options.authority.read(namespace, stringField(input, 'path'));
          result = value ? bytesToBase64(value) : null;
          break;
        }
        case 'write': {
          const limits = object(input.limits);
          await options.authority.write(namespace, stringField(input, 'path'), base64ToBytes(stringField(input, 'data')), {
            maxBytes: numberField(limits, 'maxBytes'),
            maxFiles: numberField(limits, 'maxFiles'),
          });
          result = null;
          break;
        }
        case 'delete':
          result = await options.authority.delete(namespace, stringField(input, 'path'));
          break;
        case 'mkdir':
          await options.authority.mkdir(namespace, stringField(input, 'path'));
          result = null;
          break;
        case 'list':
          result = await options.authority.list(namespace, typeof input.prefix === 'string' ? input.prefix : '');
          break;
        case 'consume': {
          const usage = object(input.usage);
          const quota = object(input.quota);
          await options.authority.consume(namespace, { operations: numberField(usage, 'operations') }, {
            maxOperations: numberField(quota, 'maxOperations'),
          });
          result = null;
          break;
        }
        case 'consumeRuntime': {
          const usage = object(input.usage);
          const quota = object(input.quota);
          await options.authority.consumeRuntime(namespace, {
            memoryBytes: numberField(usage, 'memoryBytes'),
            cpuMs: numberField(usage, 'cpuMs'),
            durationMs: numberField(usage, 'durationMs'),
          }, {
            maxRuntimeMemoryBytes: numberField(quota, 'maxRuntimeMemoryBytes'),
            maxRuntimeCpuMs: numberField(quota, 'maxRuntimeCpuMs'),
            maxRuntimeDurationMs: numberField(quota, 'maxRuntimeDurationMs'),
          });
          result = null;
          break;
        }
        case 'deleteNamespace':
          result = await options.authority.deleteNamespace(namespace);
          break;
        case 'deleteExpired':
          result = await options.authority.deleteExpired(numberField(input, 'now'));
          break;
        default:
          throw new GuestWorkspaceAuthorityError('Unsupported authority action', 'INVALID_ACTION', 400);
      }
      return Response.json({ result }, { headers: { 'cache-control': 'no-store' } });
    } catch (error) {
      const failure = error instanceof GuestWorkspaceAuthorityError
        ? error
        : new GuestWorkspaceAuthorityError('Guest authority operation failed', 'AUTHORITY_FAILURE', 503);
      return Response.json({ error: { code: failure.code, message: failure.message } }, {
        status: failure.status,
        headers: { 'cache-control': 'no-store' },
      });
    }
  };
}

export interface HttpGuestWorkspaceStoreOptions {
  endpoint: string;
  serviceToken: string;
  fetch?: typeof fetch;
}

export class HttpGuestWorkspaceStore implements GuestWorkspaceStore {
  private readonly endpoint: string;
  private readonly serviceToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpGuestWorkspaceStoreOptions) {
    const endpoint = new URL(options.endpoint);
    if (endpoint.protocol !== 'https:' && endpoint.hostname !== 'localhost' && endpoint.hostname !== '127.0.0.1') {
      throw new Error('Guest authority endpoint must use HTTPS');
    }
    if (options.serviceToken.length < 43) throw new Error('Guest authority service token is too short');
    this.endpoint = new URL('/v1/guest-workspace', endpoint).toString();
    this.serviceToken = options.serviceToken;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async call<T>(action: string, values: Record<string, unknown> = {}): Promise<T> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + this.serviceToken,
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
      body: JSON.stringify({ action, ...values }),
      cache: 'no-store',
    });
    const payload = object(await response.json());
    if (!response.ok) {
      const error = object(payload.error);
      throw new GuestWorkspaceAuthorityError(
        typeof error.message === 'string' ? error.message : 'Guest authority request failed',
        typeof error.code === 'string' ? error.code : 'AUTHORITY_FAILURE',
        response.status,
      );
    }
    return payload.result as T;
  }

  async createNamespace(namespace: string, expiresAt: number, limits: Pick<GuestWorkspaceQuotas, 'maxConcurrentLeases'>): Promise<void> {
    await this.call('createNamespace', { namespace, expiresAt, limits });
  }

  async read(namespace: string, path: string): Promise<Uint8Array | undefined> {
    const value = await this.call<string | null>('read', { namespace, path });
    return value === null ? undefined : base64ToBytes(value);
  }

  async write(namespace: string, path: string, data: Uint8Array, limits: Pick<GuestWorkspaceQuotas, 'maxBytes' | 'maxFiles'>): Promise<void> {
    await this.call('write', { namespace, path, data: bytesToBase64(data), limits });
  }

  async delete(namespace: string, path: string): Promise<boolean> {
    return this.call('delete', { namespace, path });
  }

  async mkdir(namespace: string, path: string): Promise<void> {
    await this.call('mkdir', { namespace, path });
  }

  async list(namespace: string, prefix: string): Promise<GuestWorkspaceEntry[]> {
    return this.call('list', { namespace, prefix });
  }

  async consume(namespace: string, usage: { operations: number }, quota: Pick<GuestWorkspaceQuotas, 'maxOperations'>): Promise<void> {
    await this.call('consume', { namespace, usage, quota });
  }

  async consumeRuntime(
    namespace: string,
    usage: GuestRuntimeUsage,
    quota: Pick<GuestWorkspaceQuotas, 'maxRuntimeMemoryBytes' | 'maxRuntimeCpuMs' | 'maxRuntimeDurationMs'>,
  ): Promise<void> {
    await this.call('consumeRuntime', { namespace, usage, quota });
  }

  async deleteNamespace(namespace: string): Promise<boolean> {
    return this.call('deleteNamespace', { namespace });
  }

  async deleteExpired(now: number): Promise<number> {
    return this.call('deleteExpired', { now });
  }
}
