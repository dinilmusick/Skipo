/**
 * @file srklCore.ts
 * @description Universal SRKL Ecosystem Service for DEPM.
 * Governs primary SRKL node lookup, account discovery, and workspace credential sync (< 200 lines).
 */

import { queryUnifiedDb } from './unifiedDb';
import { findUserWorkspace } from './workspaceCore';
import { listCredentials, createCredential, updateCredential, getCredential } from './credentialVaultCore';

let cachedSrklUrl: { url: string; expiresAt: number } | null = null;

export async function getPrimarySrklDeploymentUrl(env?: Record<string, unknown>): Promise<string> {
  if (cachedSrklUrl && Date.now() < cachedSrklUrl.expiresAt) {
    return cachedSrklUrl.url;
  }
  try {
    const res = await queryUnifiedDb(
      `SELECT url FROM "ultrst-srkl-deployments" WHERE is_active = true ORDER BY is_primary DESC, priority DESC, created_at ASC LIMIT 1`,
      [],
      env
    );
    if (res.rows.length > 0 && res.rows[0].url) {
      const url = res.rows[0].url.trim().replace(/\/+$/, '');
      cachedSrklUrl = { url, expiresAt: Date.now() + 10 * 60 * 1000 };
      return url;
    }
  } catch (err: any) {
    console.warn('[SrklCore] Deployment DB lookup fallback:', err.message);
  }
  const fallback = 'https://srkl-engine.vercel.app';
  cachedSrklUrl = { url: fallback, expiresAt: Date.now() + 10 * 60 * 1000 };
  return fallback;
}

export async function getSrklAccounts(userId: string, service?: string, env?: Record<string, unknown>) {
  const srklUrl = await getPrimarySrklDeploymentUrl(env);
  try {
    const res = await fetch(`${srklUrl}/api/ecosystem/services`, {
      headers: { 'x-user-id': userId, 'x-app-id': 'depm', Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`SRKL service lookup failed (${res.status})`);
    const payload: any = await res.json();
    const list = Array.isArray(payload.services) ? payload.services : [];
    const filtered = service
      ? list.filter((a: any) => {
          const sId = String(a.serviceId || a.service_id || '').toLowerCase();
          return sId.includes(service.toLowerCase());
        })
      : list;
    return { success: true, deploymentUrl: srklUrl, userId, count: filtered.length, accounts: filtered };
  } catch (err: any) {
    return { success: false, error: err.message, deploymentUrl: srklUrl, count: 0, accounts: [] };
  }
}

export async function syncSrklAccountsToWorkspace(
  workspaceId: string,
  userId: string,
  vaultKey: string,
  env?: Record<string, unknown>
) {
  const { workspace, connection } = await findUserWorkspace(workspaceId, env);
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found.`);

  const srklRes = await getSrklAccounts(userId, undefined, env);
  if (!srklRes.success) throw new Error(srklRes.error || 'Failed to fetch accounts from SRKL');

  const existingEntries = await listCredentials(workspace, connection);
  const synced: any[] = [];
  const now = new Date().toISOString();

  for (const acct of srklRes.accounts) {
    const credId = `srkl_acct_${(acct.serviceId || acct.id || 'service').replace(/[^a-z0-9_-]/gi, '_')}`;
    const name = acct.name || acct.label || acct.serviceName || acct.serviceId || 'Ecosystem Account';
    const type = `account:${acct.serviceId || 'generic'}`;
    const metadata = {
      serviceId: acct.serviceId,
      provider: acct.provider || acct.serviceId,
      source: 'srkl',
      lastSyncedAt: now,
    };

    const exists = existingEntries.find((e) => e.id === credId);
    if (exists) {
      await updateCredential(workspace, connection, credId, { name, type, secret: acct, metadata }, vaultKey);
    } else {
      await createCredential(workspace, connection, { id: credId, name, type, secret: acct, metadata }, vaultKey);
    }
    synced.push({ id: credId, name, type, metadata });
  }

  return { success: true, workspaceId, count: synced.length, accounts: synced, syncedAt: now };
}

export async function getWorkspaceAccounts(
  workspaceId: string,
  userId: string,
  vaultKey: string,
  env?: Record<string, unknown>,
  includeSecrets = false
) {
  const { workspace, connection } = await findUserWorkspace(workspaceId, env);
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found.`);

  const entries = await listCredentials(workspace, connection);
  const accountEntries = entries.filter((e) => e.type.startsWith('account') || e.metadata?.source === 'srkl');

  if (!includeSecrets) {
    return { success: true, workspaceId, count: accountEntries.length, accounts: accountEntries };
  }

  const detailed = [];
  for (const entry of accountEntries) {
    try {
      const full = await getCredential(workspace, connection, entry.id, vaultKey);
      detailed.push(full);
    } catch {
      detailed.push(entry);
    }
  }
  return { success: true, workspaceId, count: detailed.length, accounts: detailed };
}

export async function getSrklStatus(env?: Record<string, unknown>) {
  const srklUrl = await getPrimarySrklDeploymentUrl(env);
  const start = Date.now();
  try {
    const resp = await fetch(`${srklUrl}/api/ecosystem/health`, { signal: AbortSignal.timeout(5000) });
    const latencyMs = Date.now() - start;
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { success: true, deploymentUrl: srklUrl, online: true, latencyMs, details: data };
    }
    return { success: false, deploymentUrl: srklUrl, online: false, status: resp.status, latencyMs };
  } catch (err: any) {
    return { success: false, deploymentUrl: srklUrl, online: false, error: err.message, latencyMs: Date.now() - start };
  }
}
