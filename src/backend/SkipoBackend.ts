// ══════════════════════════════════════════════════════════════════════════════
// 1. IMPORTS & EXTERNAL DEPENDENCIES (@kloks/* PACKAGES & @ultrst-armada/krnl)
// ══════════════════════════════════════════════════════════════════════════════

import {
  ServiceAFacade,
  ServiceBFacade,
  ServiceCFacade,
  ServiceDFacade,
} from '@ultrst-armada/kloks/services';
import {
  OrchestratorADefinition,
  OrchestratorBDefinition,
} from '@ultrst-armada/kloks/orchestrations';
import {
  AudioHardwareServiceFacade,
  MidiServiceFacade,
  AudioMidiOrchestratorDefinition,
} from '@ultrst-armada/kloks/audio-midi';
import { FunctionsServiceFacade } from '@ultrst-armada/kloks/functions';
import {
  AuthServiceFacade,
  StorageServiceFacade,
  WorkspaceServiceFacade,
  ControlPlaneServiceFacade,
} from '@ultrst-armada/kloks/backend/krnl-services';
import {
  StateLifecycleServiceFacade,
  NodeGraphEngineServiceFacade,
} from '@ultrst-armada/kloks/state-graph';
import { WorkerExecutionBoundary, type IServiceFacade } from '@ultrst-armada/krnl';
import { BackendFacade } from './BackendFacade.js';
import { createSkipoSemanticRuntime } from './semantic/SkipoSemanticRuntime.js';
import { ServiceOrchestration } from './orchestration/ServiceOrchestration.js';
import {
  skipoExecutionEngine,
  skipoWorkerBoundary,
  type ServiceExecutionOptions,
} from './execution/SkipoExecutionEngine.js';

export interface ServiceExecutableFacade {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  execute<TIn = unknown, TOut = unknown>(operation: string, input?: TIn, options?: any): Promise<TOut>;
  [key: string]: any;
}

export const backendFacade = new BackendFacade();

export const semanticRuntime = createSkipoSemanticRuntime({
  applicationId: 'skipo-application',
  applicationName: 'Skipo Application',
  applicationVersion: '1.0.0',
});

export const services: Record<string, ServiceExecutableFacade> = {
  serviceA: ServiceAFacade as ServiceExecutableFacade,
  serviceB: ServiceBFacade as ServiceExecutableFacade,
  serviceC: ServiceCFacade as ServiceExecutableFacade,
  serviceD: ServiceDFacade as ServiceExecutableFacade,
  audioHardware: AudioHardwareServiceFacade as ServiceExecutableFacade,
  midi: MidiServiceFacade as ServiceExecutableFacade,
  functions: FunctionsServiceFacade as ServiceExecutableFacade,
  auth: AuthServiceFacade as ServiceExecutableFacade,
  storage: StorageServiceFacade as ServiceExecutableFacade,
  workspace: WorkspaceServiceFacade as ServiceExecutableFacade,
  controlPlane: ControlPlaneServiceFacade as ServiceExecutableFacade,
  stateLifecycle: StateLifecycleServiceFacade as ServiceExecutableFacade,
  nodeGraphEngine: NodeGraphEngineServiceFacade as ServiceExecutableFacade,
};

// Register domain services in BackendFacade & SkipoExecutionEngine
for (const [name, svc] of Object.entries(services)) {
  backendFacade.registerService(svc as unknown as IServiceFacade, name);
  skipoExecutionEngine.registerService(name, svc);
  semanticRuntime.registerService(name, svc);
}

semanticRuntime.registerGutTS();

function resolveService(id: string): any {
  try {
    return backendFacade.getService(id);
  } catch {
    const resolved = skipoExecutionEngine.getService(id);
    if (!resolved) {
      throw new Error(`[SkipoBackend] Cannot resolve service '${id}'.`);
    }
    return resolved;
  }
}

export const serviceOrchestrations = {
  orchestratorA: ServiceOrchestration.fromDefinition(OrchestratorADefinition, resolveService),
  orchestratorB: ServiceOrchestration.fromDefinition(OrchestratorBDefinition, resolveService),
  audioMidi: ServiceOrchestration.fromDefinition(AudioMidiOrchestratorDefinition, resolveService),
};

export const orchestrations = serviceOrchestrations;
export const worker = skipoWorkerBoundary;
export const WorkerExecutionBoundaryInstance = skipoWorkerBoundary;
export { WorkerExecutionBoundary };

export async function executeService<TInput = unknown, TOutput = unknown>(
  serviceName: string,
  operation: string,
  input?: TInput,
  options?: ServiceExecutionOptions
): Promise<TOutput> {
  return skipoExecutionEngine.executeService<TInput, TOutput>(
    serviceName,
    operation,
    input,
    options
  );
}

export async function executeOrchestration<TInput = unknown, TOutput = unknown>(
  orchestration: ServiceOrchestration<TInput, TOutput>,
  input: TInput,
  options?: ServiceExecutionOptions
) {
  return skipoExecutionEngine.executeOrchestration<TInput, TOutput>(
    orchestration,
    input,
    options
  );
}

export interface SkipoBackendFacade {
  backendFacade: BackendFacade;
  services: Record<string, ServiceExecutableFacade>;
  serviceOrchestrations: typeof serviceOrchestrations;
  orchestrations: typeof serviceOrchestrations;
  libraries: Record<string, unknown>;
  functionalities: Record<string, unknown>;
  worker: typeof skipoWorkerBoundary;
  WorkerExecutionBoundary: typeof skipoWorkerBoundary;
  executeService: typeof executeService;
  executeOrchestration: typeof executeOrchestration;
  semanticRuntime: typeof semanticRuntime;
  [key: string]: any;
}

export const SkipoBackend: SkipoBackendFacade = {
  backendFacade,
  services,
  serviceOrchestrations,
  orchestrations,
  libraries: backendFacade.libraries,
  functionalities: backendFacade.functionalities,
  worker: skipoWorkerBoundary,
  WorkerExecutionBoundary: skipoWorkerBoundary,
  executeService,
  executeOrchestration,
  semanticRuntime,
};

export default SkipoBackend;
