import { LuthAuthClient } from '@ultrst-armada/kloks/auth';

export const SKIPO_ECOSYSTEM_ID = 'ultrst-armada';
export const SKIPO_APPLICATION_ID = 'my-app';

export function getSkipoApplicationId(): string {
  return SKIPO_APPLICATION_ID;
}

// A browser Luth client must never be constructed during Next.js prerender.
// The server-side fetch adapter verifies requests independently.
export const luthAuthClient = typeof window !== 'undefined'
  ? new LuthAuthClient({
      ecosystemId: SKIPO_ECOSYSTEM_ID,
      applicationId: getSkipoApplicationId(),
      autoRegister: true,
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
