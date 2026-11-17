// ══════════════════════════════════════════════════════════════════════════════
// 1. MINIMAL BACKEND FACADE (@ultrst-armada/kloks/* & @ultrst-armada/krnl COMPOSITION)
// ══════════════════════════════════════════════════════════════════════════════

import {
  StorageServiceFacade,
  WorkspaceServiceFacade,
} from '@ultrst-armada/kloks/backend/krnl-services';
import { WorkerExecutionBoundary } from '@ultrst-armada/krnl';
import { createGoogleDriveWorkspaceStorage } from './storage/googleDriveWorkspaceStorage.js';
import { LuthAuthServiceFacade } from './LuthAuthServiceFacade.js';
import { BackendFacade } from './BackendFacade.js';
import { createAppExternalInterfaces } from './externalInterfaces.js';

export const orchestrations = {};

export const appWorkerBoundary = new WorkerExecutionBoundary('app_worker_main');

export const bugReportService = {
  report: async (input: any, options?: any) => {
    const authId = options?.session?.userId ?? options?.auth?.user?.id;
    return { success: true, report: input, reporterId: authId };
  },
};

export const services = {
  auth: LuthAuthServiceFacade,
  storage: StorageServiceFacade,
  workspace: WorkspaceServiceFacade,
  bugReport: bugReportService,
};

export const backendFacade = new BackendFacade();
// The Kloks 2.x operation facades expose execute() rather than the older
// KRNL IServiceFacade interface. They remain accessible through services
// and canonical HTTP routes; do not misregister them as incompatible types.
export const externalInterfaces = createAppExternalInterfaces(backendFacade);

export const storageProviders = {
  googleDrive: { create: createGoogleDriveWorkspaceStorage },
};

export const AppBackend = {
  services,
  storageProviders,
  orchestrations,
  worker: appWorkerBoundary,
  WorkerExecutionBoundary: appWorkerBoundary,
  backendFacade,
  externalInterfaces,
};

export default AppBackend;
