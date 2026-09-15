/**
 * @file useSrklCredentials.ts
 * @description React hook for ecosystem consumer apps (e.g. DEPM) to automatically
 * load, decrypt, and manage SRKL credentials client-side with full reactive lifecycle.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SrklVaultAccessClient, VaultAccessClientOptions } from '../lib/SrklVaultAccessClient';
import { SrklCredentialRegistry } from '../lib/SrklCredentialRegistry';
import { ServiceAccountEntry } from '../lib/types';

export interface UseSrklCredentialsProps extends VaultAccessClientOptions {
  userSessionToken: string | null;
  workspaceId?: string;
  autoLoad?: boolean;
  initSqlJsFn?: any;
}

export interface UseSrklCredentialsResult {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  registry: SrklCredentialRegistry;
  availableServices: string[];
  getAccounts: (serviceId: string) => ServiceAccountEntry[];
  getPrimaryAccount: (serviceId: string) => ServiceAccountEntry | null;
  reload: () => Promise<void>;
  expiresAt: string | null;
}

export function useSrklCredentials({
  srklApiBaseUrl,
  appId,
  supportedServices,
  userSessionToken,
  workspaceId,
  autoLoad = true,
  initSqlJsFn,
}: UseSrklCredentialsProps): UseSrklCredentialsResult {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [availableServices, setAvailableServices] = useState<string[]>([]);

  const clientRef = useRef<SrklVaultAccessClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new SrklVaultAccessClient({
      srklApiBaseUrl,
      appId,
      supportedServices,
    });
  }

  const load = useCallback(async () => {
    if (!userSessionToken) {
      setIsReady(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = clientRef.current!;
      const reg = await client.loadCredentials(userSessionToken, workspaceId, initSqlJsFn);
      const grant = client.getActiveGrant();

      setAvailableServices(reg.listAvailableServices());
      setExpiresAt(grant?.expiresAt || null);
      setIsReady(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load credentials from SRKL');
      setIsReady(false);
    } finally {
      setIsLoading(false);
    }
  }, [userSessionToken, workspaceId, initSqlJsFn]);

  useEffect(() => {
    if (autoLoad && userSessionToken) {
      load();
    }
  }, [autoLoad, userSessionToken, load]);

  const getAccounts = useCallback((serviceId: string) => {
    return clientRef.current?.getRegistry().getAccountsForService(serviceId) || [];
  }, []);

  const getPrimaryAccount = useCallback((serviceId: string) => {
    return clientRef.current?.getRegistry().getPrimaryAccount(serviceId) || null;
  }, []);

  return {
    isLoading,
    isReady,
    error,
    registry: clientRef.current!.getRegistry(),
    availableServices,
    getAccounts,
    getPrimaryAccount,
    reload: load,
    expiresAt,
  };
}
