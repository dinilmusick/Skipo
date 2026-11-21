/**
 * Registrar-only origin challenge. No browser or generated app may import this.
 * The Luth/deployment-control verifier must independently authenticate the
 * current actor and return an already approved app/origin/environment binding.
 */
import {
  validatedDeploymentOrigin,
} from './deploymentStore_Impure.js';
import {
  deploymentProofPath, type DeploymentEnvironment,
} from './deploymentProof_Impure.js';
import type {
  TrustedDeploymentAuthority, AuthorizedDeploymentRevocation,
  VerifiedDeploymentLease,
} from './verifiedDeploymentAuthority_Impure.js';

export interface ApprovedDeploymentClaim {
  appId: string;
  deploymentId: string;
  origin: string;
  environment: DeploymentEnvironment;
}
export interface TrustedDeploymentOwnershipVerifier {
  /** Must verify a live Luth principal, application ownership and approved origin. */
  authorizeEnrollment: (untrustedRequest: unknown) =>
    Promise<ApprovedDeploymentClaim | null>;
  /** Must verify a live Luth owner or control-plane revocation authority. */
  authorizeRevocation: (untrustedRequest: unknown) =>
    Promise<AuthorizedDeploymentRevocation | null>;
}

const appPattern = /^[a-z][a-z0-9-]{0,62}$/;
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const environments = new Set(['development', 'preview', 'staging', 'production']);
const maxProofBytes = 1024;
const leaseMillis = 15 * 60_000;

function verifiedClaim(claim: ApprovedDeploymentClaim): ApprovedDeploymentClaim {
  if (!claim || !appPattern.test(claim.appId) ||
      !uuidPattern.test(claim.deploymentId) ||
      !environments.has(claim.environment)) {
    throw new Error('Luth deployment ownership binding is invalid.');
  }
  return { ...claim, origin: validatedDeploymentOrigin(claim.origin) };
}
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function boundedJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.body || response.status !== 200 ||
      !response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new Error('Deployment origin returned no valid proof response.');
  }
  const reader = response.body.getReader();
  let length = 0;
  let content = '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maxProofBytes) throw new Error('Deployment origin proof is oversized.');
      content += decoder.decode(part.value, { stream: true });
    }
    content += decoder.decode();
  } finally {
    void reader.cancel().catch(() => undefined);
  }
  const parsed: unknown = JSON.parse(content);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Deployment origin proof must be an object.');
  }
  return parsed as Record<string, unknown>;
}

export function createHttpDeploymentProofAuthority(
  owner: TrustedDeploymentOwnershipVerifier,
  transport: typeof fetch = fetch,
): TrustedDeploymentAuthority {
  if (!owner || typeof owner.authorizeEnrollment !== 'function' ||
      typeof owner.authorizeRevocation !== 'function' ||
      typeof transport !== 'function') {
    throw new Error('Trusted Luth deployment control and HTTP transport required.');
  }
  return {
    async attest(untrustedRequest: unknown): Promise<VerifiedDeploymentLease | null> {
      const approved = await owner.authorizeEnrollment(untrustedRequest);
      if (!approved) return null;
      const claim = verifiedClaim(approved);
      const nonce = hex(crypto.getRandomValues(new Uint8Array(32)));
      const proofUrl = claim.origin + deploymentProofPath + '?nonce=' + nonce;
      const response = await transport(proofUrl, {
        method: 'GET', redirect: 'error', cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      });
      if (response.redirected || response.url !== proofUrl) {
        throw new Error('Deployment origin proof redirected or changed origin.');
      }
      const body = await boundedJson(response);
      if (Object.keys(body).sort().join(',') !==
          'appId,deploymentId,environment,nonce,origin' ||
          body.appId !== claim.appId ||
          body.deploymentId !== claim.deploymentId ||
          body.environment !== claim.environment ||
          body.origin !== claim.origin ||
          body.nonce !== nonce) {
        throw new Error('Deployment origin proof does not match authenticated enrollment.');
      }
      const proofBytes = new TextEncoder().encode(JSON.stringify({
        appId: claim.appId, deploymentId: claim.deploymentId,
        environment: claim.environment, origin: claim.origin, nonce,
      }));
      const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', proofBytes)));
      return { ...claim, proofDigest: digest,
        leaseExpiresAt: new Date(Date.now() + leaseMillis).toISOString() };
    },
    async authorizeRevocation(untrustedRequest: unknown):
      Promise<AuthorizedDeploymentRevocation | null> {
      const approved = await owner.authorizeRevocation(untrustedRequest);
      if (!approved) return null;
      if (!appPattern.test(approved.appId) ||
          !uuidPattern.test(approved.deploymentId)) {
        throw new Error('Luth revocation target is invalid.');
      }
      return { appId: approved.appId, deploymentId: approved.deploymentId };
    },
  };
}
