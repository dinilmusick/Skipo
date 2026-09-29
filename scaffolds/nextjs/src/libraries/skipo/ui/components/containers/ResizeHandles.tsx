/**
 * ASCII Architecture Flowchart: ResizeHandles
 *
 *   ┌──────────────────────────────────┐
 *   │     Initialize ResizeHandles     │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │        RESIZE_DIRECTIONS         │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │          ResizeHandles           │
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
import type React from 'react';

export type ResizeDirection = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

const RESIZE_DIRECTIONS: ResizeDirection[] = ['nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'];

export interface ResizeHandlesProps {
  onStartResize: (dir: ResizeDirection, e: React.MouseEvent) => void;
}


// ════ RESIZEHANDLES IMPLEMENTATION ════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export function ResizeHandles({ onStartResize }: ResizeHandlesProps) {
  return (
    <>
      {RESIZE_DIRECTIONS.map(dir => (
        <div
          key={dir}
          className={`skipo-resize-handle skipo-resize-${dir}`}
          onMouseDown={(e) => onStartResize(dir, e)}
        />
      ))}
    </>
  );
}