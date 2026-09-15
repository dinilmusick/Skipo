/**
 * @file useSrklServices.ts
 * @description React Hook for discovering and consuming services from SRKL Vaults.
 * Strictly adheres to Skipo governance (< 200 lines).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SrklClient } from '../lib/srkl/SrklClient';
import { SrklServiceAccount } from '../lib/srkl/types';

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

export function useSrklServices(options: UseSrklServicesOptions): UseSrklServicesResult {
  const { declaredTypes, userId, token, workspaceId, autoFetch = true } = options;
  const initialUrl = options.srklUrl || (typeof window !== 'undefined'
    ? localStorage.getItem('srkl_endpoint_url') || 'http://localhost:3001'
    : 'http://localhost:3001');

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
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('srkl_endpoint_url', clean); } catch {}
    }
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
