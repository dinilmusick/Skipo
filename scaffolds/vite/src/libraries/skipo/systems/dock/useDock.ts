/**
 * ASCII Architecture Flowchart: useDock
 *
 *   ┌──────────────────────────────────┐
 *   │        Initialize useDock        │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │           updateBadge            │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │  Return State / Result Payload   │
 *   └──────────────────────────────────┘
 */

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

'use client';
import { useState, useCallback } from 'react';
import type { DockItemConfig } from './types.js';


// ════ USEDOCK IMPLEMENTATION ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export function useDock(initialItems: DockItemConfig[] = []) {
  const [items, setItems] = useState<DockItemConfig[]>(initialItems);
  const [activeId, setActiveId] = useState<string | undefined>();

  const updateBadge = useCallback((id: string, badge: number | string | undefined) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, badge } : item));
  }, []);

  return {
    items,
    activeId,
    setActiveId,
    updateBadge,
    setItems,
  };
}