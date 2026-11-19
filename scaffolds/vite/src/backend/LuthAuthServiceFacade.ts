import { getLuthSession } from './auth/luthSession.js';

/** Provider-neutral auth facade backed exclusively by canonical Luth sessions. */
export const LuthAuthServiceFacade = {
  id: 'auth',
  name: 'Luth Authentication',
  version: '1.0.0',
  async getSession(request: Request) {
    return getLuthSession(request);
  },
  async getCurrentUser(request: Request) {
    const session = await getLuthSession(request);
    return session?.user ?? null;
  },
  /** Deliberately fail closed: browser logins use Kloks' OIDC BFF, never a
   * cross-domain Luth cookie proxy. Kept only to signal migration clearly. */
  async proxyRequest(_request: Request) {
    return Response.json({ error: 'LEGACY_AUTH_PROXY_DISABLED' }, {
      status: 410, headers: { 'cache-control': 'no-store' },
    });
  },
};

export default LuthAuthServiceFacade;
