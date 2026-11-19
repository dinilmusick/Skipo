import { createApplicationAuthClient } from '@dinilmusick/gutts/auth';

export const SKIPO_ECOSYSTEM_ID = 'ultrst-armada';
export const SKIPO_APPLICATION_ID = 'my-app';

export function getSkipoApplicationId(): string {
  return SKIPO_APPLICATION_ID;
}

/**
 * The browser sees only first-party HttpOnly cookies from Kloks' application
 * OAuth BFF. It never stores Luth bearer tokens, code verifiers or client secrets.
 */
export const luthAuthClient = createApplicationAuthClient();

/** App-owned APIs use the same-site session cookie; no bearer shim. */
export async function luthFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  // Do not forward a caller's untrusted bearer/session token into the BFF.
  headers.delete('Authorization');
  return fetch(input, {
    ...init, headers,
    credentials: 'same-origin',
    cache: init.cache ?? 'no-store',
  });
}
