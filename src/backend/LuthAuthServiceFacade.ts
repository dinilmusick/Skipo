import { getLuthSession, proxyLuthAuthRequest } from './auth/luthSession.js';

/** Provider-neutral auth service backed exclusively by canonical Luth sessions. */
export const LuthAuthServiceFacade = {
  id: 'auth',
  name: 'Luth Authentication',
  version: '1.0.0',
  libraries: Object.freeze({}),
  functionalities: Object.freeze({}),
  orchestrations: Object.freeze({}),
  async getSession(request: Request) {
    return getLuthSession(request);
  },
  async getCurrentUser(request: Request) {
    const session = await getLuthSession(request);
    return session?.user ?? null;
  },
  async proxyRequest(request: Request) {
    return proxyLuthAuthRequest(request);
  },
  async execute<TIn = unknown, TOut = unknown>(
    operation: string,
    input?: TIn,
    options?: any,
  ): Promise<TOut> {
    const candidate = input instanceof Request
      ? input
      : (input as { request?: Request } | undefined)?.request ?? options?.request;
    if (!(candidate instanceof Request)) {
      throw new Error('Luth auth service operations require a Web Request.');
    }
    let result: unknown;
    switch (operation) {
      case 'getSession':
        result = await getLuthSession(candidate);
        break;
      case 'getCurrentUser':
        result = (await getLuthSession(candidate))?.user ?? null;
        break;
      case 'proxyRequest':
        result = await proxyLuthAuthRequest(candidate);
        break;
      default:
        throw new Error(`Unsupported Luth auth operation: ${operation}`);
    }
    return result as TOut;
  },
};

export default LuthAuthServiceFacade;
