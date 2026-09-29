/**
 * ASCII Architecture Flowchart: useCanvas
 *
 *   ┌──────────────────────────────────┐
 *   │       Initialize useCanvas       │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │             addItem              │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │        updateItemPosition        │
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
import type { Transform, CanvasItem } from './types.js';


// ════ USECANVAS IMPLEMENTATION ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export function useCanvas(initialTransform: Transform = { x: 0, y: 0, scale: 1 }) {
  const [transform, setTransform] = useState<Transform>(initialTransform);
  const [items, setItems] = useState<CanvasItem[]>([]);

  const addItem = useCallback((item: CanvasItem) => {
    setItems(prev => [...prev, item]);
  }, []);

  const updateItemPosition = useCallback((id: string, x: number, y: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, x, y } : item));
  }, []);

  return {
    transform,
    setTransform,
    items,
    setItems,
    addItem,
    updateItemPosition
  };
}