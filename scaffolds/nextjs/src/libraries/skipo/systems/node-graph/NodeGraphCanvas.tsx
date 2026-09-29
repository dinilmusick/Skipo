/**
 * ASCII Architecture Flowchart: NodeGraphCanvas
 *
 *   ┌──────────────────────────────────────┐
 *   │      Initialize NodeGraphCanvas      │
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

// ════ NODEGRAPHCANVAS BACKWARD-COMPATIBLE BARREL FACADE ═══════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export * from './NodeGraphCanvas/NodeGraphCanvas';
export * from './NodeGraphCanvas/types';
export { NodeGraphCanvas as default } from './NodeGraphCanvas/NodeGraphCanvas';