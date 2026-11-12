import { BackendFacade } from './BackendFacade.js';
import { createAppExternalInterfaces } from './externalInterfaces.js';
import { LuthAuthServiceFacade } from './LuthAuthServiceFacade.js';

/** Register only application capabilities; authentication is delegated to Luth. */
export const backendFacade = new BackendFacade();
export const externalInterfaces = createAppExternalInterfaces(backendFacade);
export const services = Object.freeze({ auth: LuthAuthServiceFacade });
export const storageProviders = Object.freeze({});

export const AppBackend = {
  services,
  storageProviders,
  backendFacade,
  externalInterfaces,
};

export default AppBackend;
