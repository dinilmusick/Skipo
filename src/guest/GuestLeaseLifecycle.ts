import { GuestResourceRegistry } from "./GuestResourceRegistry.js";

export interface GuestLeaseLifecycleBinding {
  readonly leaseId: string;
  readonly credential: string;
  readonly workspaceNamespace: string;
}

export interface GuestLeaseLifecycleAuthority {
  revoke(leaseId: string): Promise<boolean>;
  destroyWorkspace(namespace: string): Promise<boolean>;
  deleteExpired(now: number): Promise<number>;
}

function allowedOrigin(request: Request, configuredOrigins: readonly string[]): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET" || request.method === "HEAD";
  if (origin === "null") return false;
  const expected = new Set([new URL(request.url).origin, ...configuredOrigins]);
  return expected.has(origin);
}

function guestCredential(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name !== "__Host-skipo_guest") continue;
    try { return decodeURIComponent(value.join("=")); } catch { return null; }
  }
  return null;
}

export function createGuestTeardownHandler(options: {
  authority: GuestLeaseLifecycleAuthority;
  resolveLease: (credential: string) => Promise<{ leaseId: string; workspaceNamespace: string } | null>;
  allowedOrigins?: readonly string[];
  registry?: GuestResourceRegistry;
}): (request: Request) => Promise<Response | null> {
  return async (request) => {
    const url = new URL(request.url);
    if (url.pathname !== "/api/guest/teardown") return null;
    if (request.method !== "POST") {
      return Response.json({ error: { code: "METHOD_NOT_ALLOWED" } }, { status: 405 });
    }
    if (!allowedOrigin(request, options.allowedOrigins ?? [])) {
      return Response.json({ error: { code: "GUEST_ORIGIN_REJECTED" } }, { status: 403 });
    }
    const credential = guestCredential(request);
    if (!credential) {
      return Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
    }
    const lease = await options.resolveLease(credential);
    if (!lease) {
      return Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
    }

    const resources = options.registry
      ? await options.registry.releaseLease(lease.leaseId)
      : { released: 0, failed: 0 };
    const revoked = await options.authority.revoke(lease.leaseId);
    const destroyed = await options.authority.destroyWorkspace(lease.workspaceNamespace);
    return Response.json(
      { revoked, destroyed, resources },
      { headers: { "cache-control": "no-store" } },
    );
  };
}

export function installGuestPageExitSignal(options: {
  endpoint?: string;
  fetchImpl?: typeof fetch;
}): () => void {
  const endpoint = options.endpoint ?? "/api/guest/teardown";
  const fetchImpl = options.fetchImpl ?? fetch;

  const teardown = () => {
    const body = new Blob(["{}"], { type: "application/json" });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(endpoint, body)) return;
    }
    void fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: "{}",
      keepalive: true,
    }).catch(() => undefined);
  };

  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("pagehide", teardown, { capture: true });
  return () => window.removeEventListener("pagehide", teardown, { capture: true });
}

export async function runAuthoritativeGuestCleanup(
  authority: Pick<GuestLeaseLifecycleAuthority, "deleteExpired">,
  now = Date.now(),
): Promise<number> {
  return authority.deleteExpired(now);
}
