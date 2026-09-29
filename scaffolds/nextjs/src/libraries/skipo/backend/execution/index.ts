/**
 * ASCII Architecture Flowchart: index
 *
 *   ┌──────────────────────────────────────┐
 *   │           Initialize index           │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │  Execute Component / Pipeline Logic  │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │    Return State / Result Payload     │
 *   └──────────────────────────────────────┘
 */

/**
// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

 * @file index.ts
 * @description Public exports for @skipo/backend/execution.
 */

export * from './types.js';
export * from './OperationComponent.js';
export * from './ServiceDispatcher.js';
export * from './BackendFacade.js';
export * from './WorkerExecutionBoundary.js';
export * from './DependencyOrdering.js';
export * from './ResultFlowBridge.js';