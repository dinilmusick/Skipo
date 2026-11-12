import { BackendFacade } from './BackendFacade.js';
import { createAppExternalInterfaces } from './externalInterfaces.js';

/**
 * The universal app starts with no provider-specific services installed.
 * Register only the capabilities this application actually uses.
 */
export const backendFacade = new BackendFacade();
export const externalInterfaces = createAppExternalInterfaces(backendFacade);
export const services = Object.freeze({});
export const storageProviders = Object.freeze({});

export const AppBackend = {
  services,
  storageProviders,
  backendFacade,
  externalInterfaces,
};

export default AppBackend;
