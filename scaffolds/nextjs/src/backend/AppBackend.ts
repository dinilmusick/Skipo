// ══════════════════════════════════════════════════════════════════════════════
// 1. MINIMAL BACKEND FACADE (@ultrst-armada/kloks/* & @ultrst-armada/krnl COMPOSITION)
// ══════════════════════════════════════════════════════════════════════════════

import { ServiceAFacade, ServiceBFacade } from '@ultrst-armada/kloks/services';
import { OrchestratorADefinition, AudioMidiOrchestratorDefinition } from '@ultrst-armada/kloks/orchestrations';
import { AudioHardwareServiceFacade, MidiServiceFacade } from '@ultrst-armada/kloks/audio-midi';
import {
  AuthServiceFacade,
  StorageServiceFacade,
  WorkspaceServiceFacade,
} from '@ultrst-armada/kloks/backend/krnl-services';
import { WorkerExecutionBoundary } from '@ultrst-armada/krnl';

export const services = {
  serviceA: ServiceAFacade,
  serviceB: ServiceBFacade,
  audioHardware: AudioHardwareServiceFacade,
  midi: MidiServiceFacade,
  auth: AuthServiceFacade,
  storage: StorageServiceFacade,
  workspace: WorkspaceServiceFacade,
};

export const orchestrations = {
  orchestratorA: OrchestratorADefinition,
  audioMidi: AudioMidiOrchestratorDefinition,
};

export const appWorkerBoundary = new WorkerExecutionBoundary('app_worker_main');

export const AppBackend = {
  services,
  orchestrations,
  worker: appWorkerBoundary,
  WorkerExecutionBoundary: appWorkerBoundary,
};

export default AppBackend;
