/**
 * ASCII Architecture Flowchart: ConnectionRuleStore
 *
 *   ┌──────────────────────────────────────┐
 *   │    Initialize ConnectionRuleStore    │
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

// ════ CONNECTIONRULESTORE BACKWARD-COMPATIBLE BARREL FACADE ═══════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export * from './ConnectionRuleStore/ConnectionRuleStore';
export * from './ConnectionRuleStore/types';
export { ConnectionRuleStore as default } from './ConnectionRuleStore/ConnectionRuleStore';