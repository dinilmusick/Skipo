import { LuthAuthClient } from '@dinilmusick/gutts';

export const SKIPO_ECOSYSTEM_ID = 'ultrst-armada';
export const SKIPO_APPLICATION_ID = 'my-app';

export function getSkipoApplicationId(): string {
  return SKIPO_APPLICATION_ID;
}

export const luthAuthClient = new LuthAuthClient({
  ecosystemId: SKIPO_ECOSYSTEM_ID,
  applicationId: getSkipoApplicationId(),
  origin: typeof window !== 'undefined' ? window.location.origin : undefined,
  autoRegister: true,
});

/** All same-origin application API requests carry the active Luth session. */
export async function luthFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  new Headers(luthAuthClient.getAuthHeaders()).forEach((value, key) => headers.set(key, value));
  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
    cache: init.cache ?? 'no-store',
  });
}
