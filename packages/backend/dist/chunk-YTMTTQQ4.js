// src/srkl/SrklClient.ts
var SrklClient = class {
  baseUrl;
  userId;
  token;
  workspaceId;
  getAuthHeadersCustom;
  constructor(options = {}) {
    this.baseUrl = (options.srklUrl || "http://localhost:3001").replace(/\/+$/, "");
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
    if (this.getAuthHeadersCustom) {
      Object.assign(headers, this.getAuthHeadersCustom());
    }
    return headers;
  }
  async checkHealth() {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/api/ecosystem/health`, {
        headers: this.buildHeaders()
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) return { ok: false, latencyMs };
      const data = await res.json();
      return { ok: true, latencyMs, status: data?.status };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
  async getServices(types = [], options = {}) {
    const queryTypes = types.length > 0 ? types.join(",") : (options.types || []).join(",");
    const wsId = options.workspaceId || this.workspaceId;
    const url = new URL(`${this.baseUrl}/api/ecosystem/services`);
    if (queryTypes) url.searchParams.set("types", queryTypes);
    if (wsId) url.searchParams.set("workspaceId", wsId);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: this.buildHeaders()
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`SRKL service query failed (${res.status}): ${errText}`);
    }
    const data = await res.json();
    return data.services || [];
  }
  async getServiceById(id, options = {}) {
    const wsId = options.workspaceId || this.workspaceId;
    const url = new URL(`${this.baseUrl}/api/ecosystem/services/${encodeURIComponent(id)}`);
    if (wsId) url.searchParams.set("workspaceId", wsId);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: this.buildHeaders()
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`SRKL service lookup failed (${res.status})`);
    const data = await res.json();
    return data?.service || null;
  }
  static adaptToStorageConnection(account) {
    const creds = account.credentials || {};
    const sId = (account.serviceId || "").toLowerCase();
    const isB2 = sId.includes("backblaze") || sId === "b2";
    const provider = isB2 ? "backblaze_b2" : "aws_s3";
    return {
      id: `conn-srkl-${account.id}`,
      provider,
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

// src/srkl/useSrklServices.ts
import { useState, useEffect, useCallback, useMemo } from "react";
function getStoredSrklUrl(fallback) {
  try {
    const storage = globalThis?.localStorage;
    if (storage && typeof storage.getItem === "function") {
      return storage.getItem("srkl_endpoint_url") || fallback;
    }
  } catch {
  }
  return fallback;
}
function persistSrklUrl(url) {
  try {
    const storage = globalThis?.localStorage;
    if (storage && typeof storage.setItem === "function") {
      storage.setItem("srkl_endpoint_url", url);
    }
  } catch {
  }
}
function useSrklServices(options) {
  const { declaredTypes, userId, token, workspaceId, autoFetch = true } = options;
  const initialUrl = options.srklUrl || getStoredSrklUrl("http://localhost:3001");
  const [srklUrl, setSrklUrlState] = useState(initialUrl);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latencyMs, setLatencyMs] = useState(null);
  const client = useMemo(
    () => new SrklClient({ srklUrl, userId, token, workspaceId }),
    [srklUrl, userId, token, workspaceId]
  );
  const setSrklUrl = useCallback((url) => {
    const clean = url.trim().replace(/\/+$/, "");
    setSrklUrlState(clean);
    persistSrklUrl(clean);
  }, []);
  const refetch = useCallback(async () => {
    if (!declaredTypes || declaredTypes.length === 0) return;
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
      setServices(data);
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
  SrklClient,
  createSrklClient,
  useSrklServices
};
