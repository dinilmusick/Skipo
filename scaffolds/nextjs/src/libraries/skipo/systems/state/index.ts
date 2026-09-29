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
 * @description Public exports for @skipo/systems/state.
 */

export * from './types.js';
export * from './LifecycleGraph.js';
export * from './SkipoState.js';
export * from './hooks.js';