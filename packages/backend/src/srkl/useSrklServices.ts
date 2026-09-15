/**
 * @file useSrklServices.ts
 * @description React Hook for discovering and consuming services from SRKL Vaults.
 * Used by client apps to reactively load credentials matching declared requirements.
 * Strictly adheres to Skipo governance (< 200 lines).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SrklClient } from './SrklClient.js';
import { SrklServiceAccount } from './types.js';

export interface UseSrklServicesOptions {
  srklUrl?: string;
  declaredTypes: string[];
  userId?: string;
  token?: string;
  workspaceId?: string;
  autoFetch?: boolean;
}

export interface UseSrklServicesResult {
  services: SrklServiceAccount[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  latencyMs: number | null;
  refetch: () => Promise<void>;
  srklUrl: string;
  setSrklUrl: (url: string) => void;
  client: SrklClient;
}

function getStoredSrklUrl(fallback: string): string {
  try {
    const storage = (globalThis as any)?.localStorage;
    if (storage && typeof storage.getItem === 'function') {
      return storage.getItem('srkl_endpoint_url') || fallback;
    }
  } catch {}
  return fallback;
}

function persistSrklUrl(url: string): void {
  try {
    const storage = (globalThis as any)?.localStorage;
    if (storage && typeof storage.setItem === 'function') {
      storage.setItem('srkl_endpoint_url', url);
    }
  } catch {}
}

export function useSrklServices(options: UseSrklServicesOptions): UseSrklServicesResult {
  const { declaredTypes, userId, token, workspaceId, autoFetch = true } = options;
  const initialUrl = options.srklUrl || getStoredSrklUrl('http://localhost:3001');

  const [srklUrl, setSrklUrlState] = useState<string>(initialUrl);
  const [services, setServices] = useState<SrklServiceAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const client = useMemo(
    () => new SrklClient({ srklUrl, userId, token, workspaceId }),
    [srklUrl, userId, token, workspaceId]
  );

  const setSrklUrl = useCallback((url: string) => {
    const clean = url.trim().replace(/\/+$/, '');
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
    } catch (err: any) {
      setError(err.message || 'Failed to fetch services from SRKL');
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
    client,
  };
}
