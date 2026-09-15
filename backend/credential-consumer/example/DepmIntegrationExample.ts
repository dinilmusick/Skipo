/**
 * @file DepmIntegrationExample.ts
 * @description Complete reference example for DEPM (or any ecosystem app) consuming SRKL credentials.
 * Follows the exact mathematical model:
 *   credential_scope := SRKL.account[account.id].services ∩ DEPM.supported_services
 *   SRKL: authenticate() + authorize() + provide_DB_access() [Zero query overhead on SRKL]
 *   DEPM.client: SQLite_read() + credential_filtering() + service_registration()
 */

import initSqlJs from 'sql.js';
import { SrklVaultAccessClient } from '../lib/SrklVaultAccessClient';

// 1. DEPM specifies supported services
const DEPM_SUPPORTED_SERVICES = ['vercel', 'github', 'backblaze_b2', 'cloudflare_r2'];

export async function initializeDepmWithSrkl(
  userSessionToken: string,
  srklBaseUrl = 'https://srkl.ultrst.io'
) {
  console.log('[DEPM] Initializing SRKL Credential Consumer Pipeline...');

  // 2. Instantiate client with DEPM app identity and supported services
  const client = new SrklVaultAccessClient({
    srklApiBaseUrl: srklBaseUrl,
    appId: 'depm',
    supportedServices: DEPM_SUPPORTED_SERVICES,
  });

  // 3. Load credentials client-side:
  //    - Gets 15m presigned URL from SRKL
  //    - Downloads .srkl/workspace.db.enc directly from B2/R2 bucket
  //    - Decrypts via Web Crypto
  //    - Queries SQLite via sql.js in browser memory
  //    - Filters to only DEPM_SUPPORTED_SERVICES
  const registry = await client.loadCredentials(userSessionToken, undefined, initSqlJs);

  console.log('[DEPM] Services successfully registered:', registry.listAvailableServices());

  // 4. Access credentials for specific services
  const vercelAccount = registry.getPrimaryAccount('vercel');
  if (vercelAccount) {
    console.log('[DEPM] Vercel token available:', vercelAccount.credentials.token ? '***' : 'missing');
  }

  const githubAccount = registry.getPrimaryAccount('github');
  if (githubAccount) {
    console.log('[DEPM] GitHub account ready:', githubAccount.name);
  }

  // Unsupported services in the vault are strictly filtered out
  const unsupportedList = registry.getAccountsForService('unsupported_provider');
  console.assert(unsupportedList.length === 0, 'Unsupported services must never be loaded into registry');

  return registry;
}
