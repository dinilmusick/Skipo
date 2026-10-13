// ══════════════════════════════════════════════════════════════════════════════
// 1. IMPORTS & EXTERNAL DEPENDENCIES (@kloks/* PACKAGES)
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
  ExecutionServiceFacade,
} from '@ultrst-armada/kloks/backend/krnl-services';
import {
  ExecutableBackendFacade,
  WorkerExecutionBoundary,
} from '@ultrst-armada/kloks/backend/execution';
import {
  StateLifecycleServiceFacade,
  NodeGraphEngineServiceFacade,
} from '@ultrst-armada/kloks/state-graph';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * BACKEND FACADE: SkipoBackend
 * ──────────────────────────────────────────────────────────────────────────────
 * Purpose: Primary application backend composition entrypoint importing ready-made
 *          services and orchestrators directly from @kloks/* packages.
 *
 * Flow Chart:
 *   [@kloks/* Services] ───► [@kloks/* Orchestrators] ───► [SkipoBackend Facade]
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
  execution: ExecutionServiceFacade,
  stateLifecycle: StateLifecycleServiceFacade,
  nodeGraphEngine: NodeGraphEngineServiceFacade,
};

export const orchestrations = {
  orchestratorA: OrchestratorAFacade,
  orchestratorB: OrchestratorBFacade,
  audioMidi: AudioMidiOrchestratorFacade,
};

export const executableFacade = new ExecutableBackendFacade('SkipoBackend');
export const skipoWorkerBoundary = new WorkerExecutionBoundary(
  'skipo_worker_main',
  executableFacade
);

export const SkipoBackend = {
  services,
  orchestrations,
  worker: skipoWorkerBoundary,
  WorkerExecutionBoundary: skipoWorkerBoundary,
};

export default SkipoBackend;
