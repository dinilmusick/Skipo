/**
 * ASCII Architecture Flowchart: types
 *
 *   ┌──────────────────────────────────────┐
 *   │           Initialize types           │
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

import type { HandleDirection, HandleCategory } from '../../domain/BaseHandle.js';

// ════ CONNECTIONRULESTORE EXTRACTED TYPES ═════════════════════════════════════════
export interface HandleDescriptor {
  dataType?: string;
  direction?: HandleDirection | 'input' | 'output';
  handleCategory?: HandleCategory;
}