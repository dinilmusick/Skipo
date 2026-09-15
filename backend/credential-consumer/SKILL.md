# SKILL: SRKL CLIENT-SIDE VAULT CREDENTIAL CONSUMER

```math
\text{credential\_scope} := \text{SRKL.account}[\text{account.id}].\text{services} \cap \text{CONSUMER}.\text{supported\_services}
```

```
PROCESSING MODEL:
  SRKL Server:
    authenticate() + authorize() + provide_DB_access()
    ❌ NO credential_query_processing
    ❌ NO credential_filtering
    ❌ NO service_registration

  CONSUMER Client (Browser):
    fetch_from_bucket(presigned_url)
    decrypt_in_memory(bytes, key_material)
    SQLite_read(sql.js)
    credential_filtering()
    service_registration()
```

---

## 1. When to Use

Use this skill when scaffolding or authoring ecosystem apps (like **DEPM**, **DocuStack**, **Brom**, or any custom tool) that need to consume service credentials (GitHub, Vercel, Backblaze B2, Cloudflare R2, etc.) stored in the user's **SRKL Workspace Vault** without burning server compute on the SRKL deployment.

---

## 2. Directory Layout in Target App

When copying from `Skipo/backend/credential-consumer/`:

```
src/
  libraries/
    srkl-consumer/
      SrklVaultAccessClient.ts      # Core pipeline orchestrator
      SrklCryptoClient.ts           # Browser Web Crypto AES-256-GCM decryptor
      SrklCredentialRegistry.ts     # In-memory filtered registry
      types.ts                      # Shared types & interfaces
  hooks/
    useSrklCredentials.ts           # React integration hook
```

---

## 3. Quickstart (Standard TypeScript / React)

### Step 1: Install Dependencies
```bash
npm install sql.js
npm install -D @types/sql.js
```

### Step 2: React Component Integration (`useSrklCredentials`)

```tsx
import React from 'react';
import initSqlJs from 'sql.js';
import { useSrklCredentials } from '@/hooks/useSrklCredentials';

export function DepmServicePanel({ userSessionToken }: { userSessionToken: string }) {
  const { isReady, isLoading, availableServices, getPrimaryAccount } = useSrklCredentials({
    srklApiBaseUrl: 'https://srkl.ultrst.io',
    appId: 'depm',
    supportedServices: ['vercel', 'github', 'backblaze_b2', 'cloudflare_r2'],
    userSessionToken,
    initSqlJsFn: initSqlJs,
  });

  if (isLoading) return <div>Loading credentials from cloud vault...</div>;
  if (!isReady) return <div>Connect SRKL to load deployment services.</div>;

  const vercel = getPrimaryAccount('vercel');
  const github = getPrimaryAccount('github');

  return (
    <div>
      <h3>Active Services ({availableServices.length})</h3>
      {vercel && <div>Vercel: {vercel.name} (Token Loaded)</div>}
      {github && <div>GitHub: {github.name}</div>}
    </div>
  );
}
```

---

## 4. Invariants & Security Boundaries

1. **Zero SRKL Server Overhead**: SRKL only generates the 15-min presigned S3/B2 URL and scoped AES key material. It never runs SQL queries or iterates over services.
2. **Bucket-to-Browser Direct Transfer**: The encrypted `.srkl/workspace.db.enc` payload is fetched directly from the cloud bucket (Backblaze B2, Cloudflare R2, or S3) into browser memory.
3. **No Persistent Client Storage**: Plaintext credentials are kept in volatile JavaScript memory (`Map`), never persisted into `localStorage`, `IndexedDB`, or cookies.
4. **Strict Scope Intersection**: Only services explicitly listed in `supportedServices` are populated in the in-memory registry. Unsupported services are inaccessible.
