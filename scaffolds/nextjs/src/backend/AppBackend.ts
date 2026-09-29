// ══════════════════════════════════════════════════════════════════════════════
// MYAPP BACKEND FACADE (§0 UNIVERSAL BACKEND ENTRYPOINT)
// Single source of truth for all backend operations (Law L7, Law L23)
// ══════════════════════════════════════════════════════════════════════════════

import * as authCore from './services/core/authCore';
import * as storageCore from './services/core/storageCore';
import * as workspaceCore from './services/core/workspaceCore';
import * as unifiedDb from './services/core/unifiedDb';
import { ExecutableBackendFacade } from '../libraries/skipo/backend/execution/BackendFacade';
import { WorkerExecutionBoundary } from '../libraries/skipo/backend/execution/WorkerExecutionBoundary';

export const services = {
  auth: authCore,
  storage: storageCore,
  workspace: workspaceCore,
  db: unifiedDb,
};

export const orchestrations = {};

export const executableFacade = new ExecutableBackendFacade('AppBackend');
export const appWorkerBoundary = new WorkerExecutionBoundary('app_worker_main', executableFacade);

export const appBackend = {
  services,
  orchestrations,
  worker: appWorkerBoundary,
  WorkerExecutionBoundary: appWorkerBoundary,
  isWorkerContext: true,
};

export const AppBackend = appBackend;
export default appBackend;
