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
  OrchestratorAFacade,
  OrchestratorBFacade,
} from '@ultrst-armada/kloks/orchestrations';
import {
  AudioHardwareServiceFacade,
  MidiServiceFacade,
  AudioMidiOrchestratorFacade,
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
 *          services and orchestrators directly from @kloks/* packages and executing
 *          cross-service workflows via canonical ServiceOrchestration and SkipoQ / KrnlQ.
 *
 * Flow Chart:
 *   [External Caller] ───► [SkipoBackend / ServiceFacade] ───► [SkipoQ / KrnlQ Job]
 *                                                                     │
 *   [Result] ◄─── [Functionality / Service] ◄─── [Worker] ◄───────────┘
 * ──────────────────────────────────────────────────────────────────────────────
 */
export const services = {
  serviceA: ServiceAFacade,
  serviceB: ServiceBFacade,
  serviceC: ServiceCFacade,
  serviceD: ServiceDFacade,
  audioHardware: AudioHardwareServiceFacade,
  midi: MidiServiceFacade,
  functions: FunctionsServiceFacade,
  auth: AuthServiceFacade,
  storage: StorageServiceFacade,
  workspace: WorkspaceServiceFacade,
  controlPlane: ControlPlaneServiceFacade,
  stateLifecycle: StateLifecycleServiceFacade,
  nodeGraphEngine: NodeGraphEngineServiceFacade,
};

// Register domain services in SkipoExecutionEngine
for (const [name, svc] of Object.entries(services)) {
  skipoExecutionEngine.registerService(name, svc);
}

export const serviceOrchestrations = {
  orchestratorA: OrchestratorAFacade,
  orchestratorB: OrchestratorBFacade,
  audioMidi: AudioMidiOrchestratorFacade,
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

export const SkipoBackend = {
  services,
  serviceOrchestrations,
  orchestrations,
  worker: skipoWorkerBoundary,
  WorkerExecutionBoundary: skipoWorkerBoundary,
  executeService,
  executeOrchestration,
};

export default SkipoBackend;
