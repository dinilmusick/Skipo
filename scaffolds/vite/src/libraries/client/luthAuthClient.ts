import { appId } from './appIdentity_Pure.js';
import { LuthAuthClient } from '@ultrst-armada/kloks/auth';

export const SKIPO_ECOSYSTEM_ID = 'ultrst-armada';
// Public routing reference generated from the canonical project manifest.
// The browser must never derive identity from the scaffold name or URL.
export const SKIPO_APPLICATION_ID: string | null = appId;

export function getSkipoApplicationId(): string {
  if (!SKIPO_APPLICATION_ID) {
    throw new Error('Application enrollment is required before Luth authentication.');
  }
  return SKIPO_APPLICATION_ID;
}

// Construct the browser Luth client only in a browser runtime.
// The server-side fetch adapter verifies requests independently.
export const luthAuthClient = typeof window !== 'undefined' && SKIPO_APPLICATION_ID
  ? new LuthAuthClient({
      ecosystemId: SKIPO_ECOSYSTEM_ID,
      applicationId: SKIPO_APPLICATION_ID,
      // Enrollment and ownership proof belong to the canonical registry.
      autoRegister: false,
    })
  : null;

/** All same-origin application API requests carry the active Luth session. */
export async function luthFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!luthAuthClient) throw new Error('Browser Luth session unavailable');
  new Headers(luthAuthClient.getAuthHeaders()).forEach((value, key) => headers.set(key, value));
  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
    cache: init.cache ?? 'no-store',
  });
}
