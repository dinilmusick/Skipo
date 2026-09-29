/**
 * ASCII Architecture Flowchart: canonicalElements
 *
 *   ┌──────────────────────────────────┐
 *   │   Initialize canonicalElements   │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │        CANONICAL_ELEMENTS        │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │  Return State / Result Payload   │
 *   └──────────────────────────────────┘
 */

import { CANONICAL_ELEMENTS_BASE } from './canonicalElementsBase.js';
import { CANONICAL_ELEMENTS_DOMAIN } from './canonicalElementsDomain.js';

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export { CANONICAL_ELEMENTS_BASE, CANONICAL_ELEMENTS_DOMAIN };

// ════ CANONICALELEMENTS IMPLEMENTATION ════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export const CANONICAL_ELEMENTS = [...CANONICAL_ELEMENTS_BASE, ...CANONICAL_ELEMENTS_DOMAIN];