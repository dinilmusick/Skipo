import { createApplicationAuthClient } from '@ultrst-armada/kloks/auth';
import { SKIPO_APPLICATION_ID } from '../../config/applicationIdentity.js';
export { SKIPO_APPLICATION_ID } from '../../config/applicationIdentity.js';

export const SKIPO_ECOSYSTEM_ID = 'ultrst-armada';
export function getSkipoApplicationId(): string { return SKIPO_APPLICATION_ID; }

/** All user authentication runs in the app-owned Kloks OIDC BFF. */
export const luthAuthClient = typeof window !== 'undefined'
  ? createApplicationAuthClient() : null;

/**
 * No OAuth credential, browser bearer or arbitrary external URL can be
 * introduced by application code. The only credential is a same-origin
 * HttpOnly session cookie managed by the browser and Kloks BFF.
 */
export async function luthFetch(
  input: RequestInfo | URL, init: RequestInit = {},
): Promise<Response> {
  const rawUrl = input instanceof Request ? input.url : String(input);
  if (typeof window === 'undefined') {
    throw new Error('Application authenticated fetch requires browser runtime.');
  }
  const target = new URL(rawUrl, window.location.origin);
  if (target.origin !== window.location.origin) {
    throw new Error('UNTRUSTED_APPLICATION_API_ORIGIN');
  }
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  headers.delete('Authorization');
  const request = input instanceof Request ? new Request(input, { headers }) : input;
  return fetch(request, {
    ...init, headers, credentials: 'same-origin',
    cache: init.cache ?? 'no-store',
  });
}
