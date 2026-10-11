import {
  b2ListBuckets
} from "./chunk-4QEMALXF.js";

// src/srkl/SrklClient.ts
var CANONICAL_SRKL_URL = "https://srkl-engine.vercel.app";
var SrklClient = class {
  baseUrl;
  userId;
  token;
  workspaceId;
  getAuthHeadersCustom;
  constructor(options = {}) {
    this.baseUrl = (options.srklUrl || CANONICAL_SRKL_URL).replace(/\/+$/, "");
    this.userId = options.userId || "usr-anon";
    this.token = options.token;
    this.workspaceId = options.workspaceId;
    this.getAuthHeadersCustom = options.getAuthHeaders;
  }
  setBaseUrl(url) {
    this.baseUrl = url.replace(/\/+$/, "");
  }
  getBaseUrl() {
    return this.baseUrl;
  }
  buildHeaders() {
    const headers = {
      "Content-Type": "application/json",
      "x-user-id": this.userId
    };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    if (this.workspaceId) headers["x-workspace-id"] = this.workspaceId;
    if (this.getAuthHeadersCustom) Object.assign(headers, this.getAuthHeadersCustom());
    return headers;
  }
  async checkHealth() {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/api/ecosystem/health`, { headers: this.buildHeaders() });
      const latencyMs = Date.now() - start;
      if (!res.ok) return { ok: false, latencyMs };
      const data = await res.json();
      return { ok: true, latencyMs, status: data.status };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
  /**
   * Standardized Skipo Ecosystem Accounts Discovery Protocol.
   * Consumes an AppAccountManifest and returns uniform EcosystemAccount[] matching the app's requirements.
   */
  async fetchEcosystemAccounts(manifest, options = {}) {
    const wsId = options.workspaceId || this.workspaceId;
    const timeout = options.timeoutMs || 6e3;
    try {
      const res = await fetch(`${this.baseUrl}/api/ecosystem/accounts`, {
        method: "POST",
        headers: { ...this.buildHeaders(), "x-app-id": manifest.appId },
        body: JSON.stringify({ manifest, workspaceId: wsId }),
        signal: AbortSignal.timeout(timeout)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.accounts)) return data.accounts;
      }
    } catch (err) {
      console.warn("[SrklClient] /api/ecosystem/accounts call failed, falling back:", err.message);
    }
    try {
      const legacyServices = await this.getServices(manifest.requiredServices || [], { workspaceId: wsId });
      return legacyServices.map((s) => ({
        id: s.id,
        serviceId: s.serviceId,
        provider: (s.serviceId || "unknown").toUpperCase(),
        category: s.serviceId.includes("b2") || s.serviceId.includes("backblaze") || s.serviceId.includes("s3") ? "storage" : "deployment",
        name: s.name,
        status: s.status || "CONNECTED",
        credentials: s.credentials || {},
        metadata: s.metadata,
        createdAt: s.createdAt
      }));
    } catch {
      return [];
    }
  }
  async getServices(types = [], options = {}) {
    const queryTypes = types.length > 0 ? types.join(",") : (options.types || []).join(",");
    const wsId = options.workspaceId || this.workspaceId;
    const url = new URL(`${this.baseUrl}/api/ecosystem/services`);
    if (queryTypes) url.searchParams.set("types", queryTypes);
    if (wsId) url.searchParams.set("workspaceId", wsId);
    const res = await fetch(url.toString(), { method: "GET", headers: this.buildHeaders() });
    if (!res.ok) throw new Error(`SRKL service query failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data.services || [];
  }
  async getStorageConnections(userIdOverride) {
    const headers = this.buildHeaders();
    if (userIdOverride) headers["x-user-id"] = userIdOverride;
    const res = await fetch(`${this.baseUrl}/api/workspaces/storage/connections`, { method: "GET", headers });
    if (!res.ok) throw new Error(`SRKL storage connections query failed (${res.status})`);
    const data = await res.json();
    return Array.isArray(data.connections) ? data.connections : [];
  }
  async getBackblazeBuckets(keyId, applicationKey) {
    const res = await fetch(`${this.baseUrl}/api/backblaze/buckets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId, applicationKey })
    });
    if (!res.ok) throw new Error(`SRKL bucket listing failed (${res.status})`);
    const data = await res.json();
    return data.buckets || [];
  }
  static filterRelevantServices(services, allowedTypes) {
    const normalized = allowedTypes.map((t) => t.toLowerCase());
    return services.filter((s) => normalized.includes((s.serviceId || "").toLowerCase()));
  }
  static adaptToStorageConnection(account) {
    const creds = account.credentials || {};
    const sId = (account.serviceId || "").toLowerCase();
    const isB2 = sId.includes("backblaze") || sId === "b2";
    return {
      id: `conn-srkl-${account.id}`,
      provider: isB2 ? "backblaze_b2" : "aws_s3",
      label: `SRKL: ${account.name || (isB2 ? "Backblaze" : "S3")}`,
      role: "redundant_clone",
      enabled: true,
      createdAt: account.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      b2KeyId: creds.keyId || creds.b2KeyId,
      b2ApplicationKey: creds.applicationKey || creds.b2ApplicationKey,
      b2BucketName: creds.bucketName || creds.bucketId || creds.b2BucketName,
      b2Region: creds.region || creds.b2Region,
      b2Endpoint: creds.endpoint || creds.b2Endpoint,
      s3AccessKeyId: creds.accessKeyId || creds.keyId || creds.s3AccessKeyId,
      s3SecretAccessKey: creds.secretAccessKey || creds.applicationKey || creds.s3SecretAccessKey,
      s3BucketName: creds.bucketName || creds.s3BucketName,
      s3Region: creds.region || creds.s3Region,
      s3Endpoint: creds.endpoint || creds.s3Endpoint
    };
  }
};
function createSrklClient(options = {}) {
  return new SrklClient(options);
}

// src/srkl/SrklDiscoveryService.ts
var cachedSrklUrl = null;
async function getPrimarySrklDeploymentUrl(queryDb) {
  if (cachedSrklUrl && Date.now() < cachedSrklUrl.expiresAt) return cachedSrklUrl.url;
  if (queryDb) {
    try {
      const res = await queryDb(
        `SELECT url FROM "ultrst-srkl-deployments" WHERE is_active = true ORDER BY is_primary DESC, priority DESC, created_at ASC LIMIT 1`,
        []
      );
      if (res.rows.length > 0 && res.rows[0].url) {
        const url = res.rows[0].url.trim().replace(/\/+$/, "");
        cachedSrklUrl = { url, expiresAt: Date.now() + 10 * 60 * 1e3 };
        return url;
      }
    } catch {
    }
  }
  const fallback = "https://srkl-engine.vercel.app";
  cachedSrklUrl = { url: fallback, expiresAt: Date.now() + 10 * 60 * 1e3 };
  return fallback;
}
async function getSrklAccounts(userId, service, queryDb) {
  const srklUrl = await getPrimarySrklDeploymentUrl(queryDb);
  const accounts = [];
  const seenKeys = /* @__PURE__ */ new Set();
  if (queryDb && userId) {
    try {
      const uRes = await queryDb(`SELECT app_profiles FROM "ultrst-users" WHERE id = $1 LIMIT 1`, [userId]);
      if (uRes.rows.length > 0) {
        const p = typeof uRes.rows[0].app_profiles === "string" ? JSON.parse(uRes.rows[0].app_profiles) : uRes.rows[0].app_profiles || {};
        const pool = [
          ...p.srkl?.storage_connections || [],
          ...p.depm?.storage_connections || [],
          ...p.qwnsr?.storage_connections || [],
          ...p.loky?.storage_connections || []
        ];
        for (const conn of pool) {
          if (service && !conn.provider?.toLowerCase().includes(service.toLowerCase())) continue;
          const kId = (conn.b2KeyId || conn.keyId || conn.accessKeyId || "").trim();
          const key = kId ? `key:${kId}` : `id:${conn.id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            accounts.push({
              id: conn.id,
              name: conn.label || conn.id,
              provider: conn.provider,
              serviceId: conn.provider,
              credentials: {
                keyId: conn.b2KeyId || conn.keyId,
                applicationKey: conn.b2ApplicationKey || conn.appKey,
                bucketName: conn.b2BucketName || conn.bucketName,
                region: conn.b2Region || conn.region,
                endpoint: conn.b2Endpoint || conn.endpoint
              }
            });
          }
        }
      }
    } catch {
    }
  }
  try {
    const res = await fetch(`${srklUrl}/api/ecosystem/services`, {
      headers: { "x-user-id": userId, Accept: "application/json" },
      signal: AbortSignal.timeout(5e3)
    });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data.services) ? data.services : [];
      for (const item of list) {
        const sId = String(item.serviceId || item.id || "").toLowerCase();
        if (service && !sId.includes(service.toLowerCase())) continue;
        const kId = (item.credentials?.keyId || item.credentials?.b2KeyId || "").trim();
        const key = kId ? `key:${kId}` : `id:${item.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          accounts.push(item);
        }
      }
    }
  } catch {
  }
  return { success: true, deploymentUrl: srklUrl, count: accounts.length, accounts };
}
async function srklListBackblazeBuckets(keyId, applicationKey, _bucketId, _bucketName, userId, queryDb) {
  let resolvedKeyId = (keyId || "").trim();
  let resolvedAppKey = (applicationKey || "").trim();
  if ((!resolvedKeyId || !resolvedAppKey) && userId && queryDb) {
    const accountsRes = await getSrklAccounts(userId, "backblaze", queryDb);
    const matched = accountsRes.accounts.find((a) => (a.credentials?.keyId || a.credentials?.b2KeyId) === resolvedKeyId) || accountsRes.accounts[0];
    if (matched) {
      resolvedKeyId = matched.credentials?.keyId || matched.credentials?.b2KeyId || resolvedKeyId;
      resolvedAppKey = matched.credentials?.applicationKey || matched.credentials?.b2ApplicationKey || resolvedAppKey;
    }
  }
  if (!resolvedKeyId || !resolvedAppKey) {
    return { success: false, buckets: [], error: "Backblaze B2 Key ID and Application Key are required" };
  }
  try {
    const buckets = await b2ListBuckets(resolvedKeyId, resolvedAppKey);
    return { success: true, buckets };
  } catch (err) {
    return { success: false, buckets: [], error: err.message };
  }
}

// src/srkl/useSrklServices.ts
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
function useSrklServices(options) {
  const { declaredTypes, userId, token, workspaceId, autoFetch = true } = options;
  const getStoredUrl = () => {
    try {
      return globalThis?.localStorage?.getItem("srkl_endpoint_url") || null;
    } catch {
      return null;
    }
  };
  const initialUrl = options.srklUrl || getStoredUrl() || CANONICAL_SRKL_URL;
  const [srklUrl, setSrklUrlState] = useState(initialUrl);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latencyMs, setLatencyMs] = useState(null);
  const hasFetchedRef = useRef(false);
  const client = useMemo(
    () => new SrklClient({ srklUrl, userId, token, workspaceId }),
    [srklUrl, userId, token, workspaceId]
  );
  const setSrklUrl = useCallback((url) => {
    const clean = url.trim().replace(/\/+$/, "");
    setSrklUrlState(clean);
    try {
      globalThis?.localStorage?.setItem("srkl_endpoint_url", clean);
    } catch {
    }
  }, []);
  const refetch = useCallback(async (force = false) => {
    if (!declaredTypes || declaredTypes.length === 0) return;
    if (hasFetchedRef.current && !force) return;
    hasFetchedRef.current = true;
    setLoading(true);
    setError(null);
    const health = await client.checkHealth();
    setIsConnected(health.ok);
    setLatencyMs(health.latencyMs);
    if (!health.ok) {
      setLoading(false);
      setError(`Cannot connect to SRKL Hub at ${srklUrl}`);
      return;
    }
    try {
      const data = await client.getServices(declaredTypes);
      const filtered = SrklClient.filterRelevantServices(data, declaredTypes);
      setServices(filtered);
    } catch (err) {
      setError(err.message || "Failed to fetch services from SRKL");
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [client, declaredTypes, srklUrl]);
  useEffect(() => {
    if (autoFetch) {
      refetch();
    }
  }, [refetch, autoFetch]);
  return {
    services,
    loading,
    error,
    isConnected,
    latencyMs,
    refetch,
    srklUrl,
    setSrklUrl,
    client
  };
}

export {
  CANONICAL_SRKL_URL,
  SrklClient,
  createSrklClient,
  getPrimarySrklDeploymentUrl,
  getSrklAccounts,
  srklListBackblazeBuckets,
  useSrklServices
};
