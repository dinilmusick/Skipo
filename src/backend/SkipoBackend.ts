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
import { WorkerExecutionBoundary } from '@ultrst-armada/krnl';
import { ServiceOrchestration } from './orchestration/ServiceOrchestration.js';
import {
  skipoExecutionEngine,
  skipoWorkerBoundary,
  type ServiceExecutionOptions,
} from './execution/SkipoExecutionEngine.js';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * BACKEND FACADE: SkipoBackend
 * ──────────────────────────────────────────────────────────────────────────────
 * Purpose: Primary application backend composition entrypoint importing ready-made
 *          services and pure orchestration definitions directly from @kloks/* packages
 *          and executing cross-service workflows via canonical ServiceOrchestration and SkipoQ.
 *
 * Flow Chart:
 *   [External Caller] ───► [SkipoBackend / ServiceFacade] ───► [SkipoQ Job]
 *                                                                     │
 *   [Result] ◄─── [Functionality / Service] ◄─── [Worker] ◄───────────┘
 * ──────────────────────────────────────────────────────────────────────────────
 */
export interface ServiceExecutableFacade {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  execute<TIn = unknown, TOut = unknown>(operation: string, input?: TIn, options?: any): Promise<TOut>;
  [key: string]: any;
}

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

// Register domain services in SkipoExecutionEngine
for (const [name, svc] of Object.entries(services)) {
  skipoExecutionEngine.registerService(name, svc);
}

const serviceResolverMap: Record<string, any> = {
  'kloks.service.a': ServiceAFacade,
  'kloks.service.b': ServiceBFacade,
  'kloks.service.c': ServiceCFacade,
  'kloks.service.d': ServiceDFacade,
  'kloks.audio.hardware': AudioHardwareServiceFacade,
  'kloks.midi.subsystem': MidiServiceFacade,
  [AudioHardwareServiceFacade.id]: AudioHardwareServiceFacade,
  [MidiServiceFacade.id]: MidiServiceFacade,
  audioHardware: AudioHardwareServiceFacade,
  midi: MidiServiceFacade,
  serviceA: ServiceAFacade,
  serviceB: ServiceBFacade,
  serviceC: ServiceCFacade,
  serviceD: ServiceDFacade,
};

function resolveService(id: string): any {
  const resolved = serviceResolverMap[id] || skipoExecutionEngine.getService(id);
  if (!resolved) {
    throw new Error(`[SkipoBackend] Cannot resolve service '${id}'.`);
  }
  return resolved;
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
  services: Record<string, ServiceExecutableFacade>;
  serviceOrchestrations: typeof serviceOrchestrations;
  orchestrations: typeof serviceOrchestrations;
  worker: typeof skipoWorkerBoundary;
  WorkerExecutionBoundary: typeof skipoWorkerBoundary;
  executeService: typeof executeService;
  executeOrchestration: typeof executeOrchestration;
  [key: string]: any;
}

export const SkipoBackend: SkipoBackendFacade = {
  services,
  serviceOrchestrations,
  orchestrations,
  worker: skipoWorkerBoundary,
  WorkerExecutionBoundary: skipoWorkerBoundary,
  executeService,
  executeOrchestration,
};

export default SkipoBackend;
