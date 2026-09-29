/**
 * ASCII Architecture Flowchart: useTileMenu
 *
 *   ┌──────────────────────────────────┐
 *   │      Initialize useTileMenu      │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │             addTile              │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │            removeTile            │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │           reorderTiles           │
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
import type { TileConfig } from './types.js';


// ════ USETILEMENU IMPLEMENTATION ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export function useTileMenu(initialTiles: TileConfig[] = []) {
  const [tiles, setTiles] = useState<TileConfig[]>(initialTiles);

  const addTile = useCallback((tile: TileConfig) => {
    setTiles(prev => [...prev, tile]);
  }, []);

  const removeTile = useCallback((id: string) => {
    setTiles(prev => prev.filter(t => t.id !== id));
  }, []);

  const reorderTiles = useCallback((newOrder: TileConfig[]) => {
    setTiles(newOrder);
  }, []);

  return {
    tiles,
    addTile,
    removeTile,
    reorderTiles,
  };
}