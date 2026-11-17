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
    const authToken = options?.authToken ?? options?.auth?.token ?? '';
    const authId = options?.session?.userId ?? options?.auth?.user?.id ?? '';
    const environment = options?.env ?? {};
    const baseUrl = String(environment.KRUSBL_URL ?? '');
    if (!baseUrl) throw new Error('[Skipo:Bug] KRUSBL_URL is required.');
    if (!authId && !authToken) throw new Error('[Skipo:Bug] Authenticated session is required.');
    const response = await fetch(baseUrl.replace(/\/$/, '') + '/api/bugs', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + authToken,
      },
      body: JSON.stringify({
        ...input,
        reporterId: authId,
        context: {
          applicationId: environment.APPLICATION_ID || 'skipo-app',
          applicationType: 'skipo' as const,
          applicationVersion: environment.APPLICATION_VERSION,
          deploymentId: environment.DEPLOYMENT_ID,
          sourceRevision: environment.SOURCE_REVISION,
          ...input?.context,
        },
      }),
    });
    if (!response.ok) throw new Error('[Skipo:Bug] Krusbl returned HTTP ' + response.status + ': ' + await response.text());
    return response.json();
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
