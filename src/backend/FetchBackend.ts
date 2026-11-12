/**
 * Provider-neutral backend entry for the universal Fetch application.
 * The full Skipo product backend is not imported into edge bundles.
 */
import { BackendFacade } from './BackendFacade.js';
import { createAppExternalInterfaces } from './externalInterfaces.js';

export const backendFacade = new BackendFacade();
export const externalInterfaces = createAppExternalInterfaces(backendFacade);
export const services = Object.freeze({});

export const FetchBackend = {
  services,
  backendFacade,
  externalInterfaces,
};

export default FetchBackend;
