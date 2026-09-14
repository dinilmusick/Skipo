/**
 * @file gateway.ts
 * @description Central Service Gateway.
 * Conforms to APP_ARCHITECTURE_SPEC Sections 14, 15, 16, 17.
 */

import { serviceRegistry } from './registry/serviceRegistry';
import { serviceResolver } from './resolver/serviceResolver';
import { httpTransport } from './transport/httpTransport';

export class Gateway {
  public get registry() {
    return serviceRegistry;
  }

  public get resolver() {
    return serviceResolver;
  }

  public get transport() {
    return httpTransport;
  }

  public async invoke<T = unknown>(
    serviceName: string,
    action: string,
    payload: unknown
  ): Promise<T> {
    const resolution = await this.resolver.resolve(serviceName);
    if (!resolution) {
      throw new Error(`Gateway resolution failed: Service '${serviceName}' is not registered.`);
    }

    if (resolution.deployment === 'local') {
      throw new Error(`Local service '${serviceName}' should be invoked directly via its facade.`);
    }

    const endpoint = resolution.endpoint || `/api/${serviceName}`;
    const encoded = this.transport.encode({ action, payload });
    const response = await this.transport.send(endpoint, encoded);
    return this.transport.decode<T>(response);
  }
}

export const gateway = new Gateway();
