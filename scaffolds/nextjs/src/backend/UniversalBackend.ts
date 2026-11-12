import { BackendFacade } from './BackendFacade.js';
import { createAppExternalInterfaces } from './externalInterfaces.js';
import { LuthAuthServiceFacade } from './LuthAuthServiceFacade.js';

export const backendFacade = new BackendFacade();

export const services = Object.freeze({
  auth: LuthAuthServiceFacade,
});

export const externalInterfaces = createAppExternalInterfaces(backendFacade);

export const AppBackend = Object.freeze({
  services,
  backendFacade,
  externalInterfaces,
});

export default AppBackend;
