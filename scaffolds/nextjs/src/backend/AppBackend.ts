import {
  StorageServiceFacade,
  WorkspaceServiceFacade,
} from '@ultrst-armada/kloks/backend/krnl-services';
import { createGoogleDriveWorkspaceStorage } from './storage/googleDriveWorkspaceStorage.js';
import { BackendFacade } from './BackendFacade.js';
import { createAppExternalInterfaces } from './externalInterfaces.js';

export const backendFacade = new BackendFacade();
for (const service of [StorageServiceFacade, WorkspaceServiceFacade]) backendFacade.registerService(service);
export const externalInterfaces = createAppExternalInterfaces(backendFacade);
export const storageProviders = {
  googleDrive: { create: createGoogleDriveWorkspaceStorage },
};

export const AppBackend = {
  services: { storage: StorageServiceFacade, workspace: WorkspaceServiceFacade },
  storageProviders,
  backendFacade,
  externalInterfaces,
};

export default AppBackend;
