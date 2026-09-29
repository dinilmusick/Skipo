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

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export * from './auth/index.js';
export * from './storage/index.js';
export * from './workspace/index.js';
export * from './control-plane/index.js';
export * from './api/index.js';
export * from './data/index.js';
export * from './connectivity/index.js';
export * from './client/index.js';
export * from './srkl/index.js';
export * from './architecture/types.js';
export * from './execution/index.js';