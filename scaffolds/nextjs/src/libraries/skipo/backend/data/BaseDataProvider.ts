/**
 * ASCII Architecture Flowchart: BaseDataProvider
 *
 *   ┌──────────────────────────────────────┐
 *   │     Initialize BaseDataProvider      │
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

import { SkipoBase } from '@skipo/core';
import { IDataProvider, QueryFilter, SortOrder } from './types.js';

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export abstract class BaseDataProvider<T> extends SkipoBase implements IDataProvider<T> {
  abstract query(filters?: QueryFilter[], sort?: SortOrder[], limit?: number): Promise<T[]>;
  abstract getById(id: string): Promise<T | null>;
  abstract insert(item: T): Promise<T>;
  abstract update(id: string, item: Partial<T>): Promise<T>;
  abstract delete(id: string): Promise<boolean>;
  abstract upsert(item: T): Promise<T>;
  abstract count(filters?: QueryFilter[]): Promise<number>;
}