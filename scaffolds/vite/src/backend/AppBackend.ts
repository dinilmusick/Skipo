// ══════════════════════════════════════════════════════════════════════════════
// 1. MINIMAL BACKEND FACADE (@ultrst-armada/kloks/* & @ultrst-armada/krnl COMPOSITION)
// ══════════════════════════════════════════════════════════════════════════════

import { ServiceAFacade, ServiceBFacade } from '@ultrst-armada/kloks/services';
import { OrchestratorADefinition, AudioMidiOrchestratorDefinition } from '@ultrst-armada/kloks/orchestrations';
import { AudioHardwareServiceFacade, MidiServiceFacade } from '@ultrst-armada/kloks/audio-midi';
import {
  StorageServiceFacade,
  WorkspaceServiceFacade,
} from '@ultrst-armada/kloks/backend/krnl-services';
import { WorkerExecutionBoundary } from '@ultrst-armada/krnl';
import { createGoogleDriveWorkspaceStorage } from './storage/googleDriveWorkspaceStorage.js';

export const orchestrations = {
  orchestratorA: OrchestratorADefinition,
  audioMidi: AudioMidiOrchestratorDefinition,
};

export const appWorkerBoundary = new WorkerExecutionBoundary('app_worker_main');

export const bugReportService = {
  report: async (input: any, options?: any) => {
    const authToken = options?.authToken ?? options?.auth?.token ?? '';
    const authId = options?.session?.userId ?? options?.auth?.user?.id ?? '';
    const baseUrl = process.env.KRUSBL_URL;
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
          applicationId: process.env.APPLICATION_ID || 'skipo-app',
          applicationType: 'skipo' as const,
          applicationVersion: process.env.APPLICATION_VERSION,
          deploymentId: process.env.DEPLOYMENT_ID,
          sourceRevision: process.env.SOURCE_REVISION,
          ...input?.context,
        },
      }),
    });
    if (!response.ok) throw new Error('[Skipo:Bug] Krusbl returned HTTP ' + response.status + ': ' + await response.text());
    return response.json();
  },
};

export const storageProviders = {
  googleDrive: { create: createGoogleDriveWorkspaceStorage },
};

export const AppBackend = {
  services,
  storageProviders,
  orchestrations,
  worker: appWorkerBoundary,
  WorkerExecutionBoundary: appWorkerBoundary,
};

export default AppBackend;
