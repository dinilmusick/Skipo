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
import { workingWorkspaceService } from '@ultrst-armada/kloks/backend';
import { WorkerExecutionBoundary } from '@ultrst-armada/krnl';
import { FodRuntime, createFodServiceFacadeForWorkspace, scanBackendFacadeToNodes } from '@ultrst-armada/kloks/fod';
import { guttsFodNodeDefinitions, executeGuttsApi } from '@dinilmusick/gutts/api';
import { createAikoRuntime as buildAikoRuntime, createAikoServiceFacade } from './aikoRuntime.js';

export const orchestrations = {
  orchestratorA: OrchestratorADefinition,
  audioMidi: AudioMidiOrchestratorDefinition,
};

export const appWorkerBoundary = new WorkerExecutionBoundary('app_worker_main');

export const createFodRuntime = (workspaceId: string) => {
  const runtime = new FodRuntime({ workspaceId, workspaceService: workingWorkspaceService });
  const host = scanBackendFacadeToNodes({ services, orchestrations });
  const guttsEndpoints = guttsFodNodeDefinitions.map((node: any) => ({
    id: String(node.metadata.apiId), serviceId: '@dinilmusick/gutts', serviceName: 'GutTS',
    operationId: String(node.metadata.apiId), operationName: node.label, description: node.description,
    invoke: (input: Record<string, unknown>) => executeGuttsApi(String(node.metadata.apiId), input),
  }));
  runtime.setEndpoints([...host.endpoints, ...guttsEndpoints], [...host.nodes as any, ...guttsFodNodeDefinitions as any]);
  return runtime;
};

export const FodServiceFacade = createFodServiceFacadeForWorkspace(createFodRuntime);

export const bugReportService = {
  report: async (input: any, options?: any) => {
    const authId = options?.session?.userId ?? options?.auth?.user?.id;
    const authToken = options?.auth?.token;
    const baseUrl = options?.serviceOrigin;
    if (!baseUrl) throw new Error('[Skipo:Bug] Krusbl origin must be resolved from the system database.');
    if (!authId || !authToken) throw new Error('[Skipo:Bug] A verified Luth identity and bearer token are required.');
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
          applicationId: options?.applicationId ?? input?.context?.applicationId ?? 'skipo-app',
          applicationType: 'skipo' as const,
          ...input?.context,
        },
      }),
    });
    if (!response.ok) throw new Error('[Skipo:Bug] Krusbl returned HTTP ' + response.status + ': ' + await response.text());
    return response.json();
  },
};

export const createAikoRuntime = (workspaceId: string) => {
  const rt = buildAikoRuntime(workspaceId, {
    fod: createFodRuntime(workspaceId),
    backend: { services, orchestrations },
  }) as any;
  rt.reportBug = (report: any, context: any) => bugReportService.report(report, context);
  return rt;
};

export const AikoServiceFacade = createAikoServiceFacade(createAikoRuntime);

export const services = {
  serviceA: ServiceAFacade,
  serviceB: ServiceBFacade,
  audioHardware: AudioHardwareServiceFacade,
  midi: MidiServiceFacade,
  auth: AuthServiceFacade,
  storage: StorageServiceFacade,
  workspace: WorkspaceServiceFacade,
  fod: FodServiceFacade,
  aiko: AikoServiceFacade,
  bugReport: bugReportService,
};

export const AppBackend = {
  services,
  orchestrations,
  worker: appWorkerBoundary,
  WorkerExecutionBoundary: appWorkerBoundary,
};

export default AppBackend;
