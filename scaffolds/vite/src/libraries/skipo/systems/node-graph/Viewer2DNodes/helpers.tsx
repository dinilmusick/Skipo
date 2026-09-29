/**
 * ASCII Architecture Flowchart: helpers
 *
 *   ┌──────────────────────────────────┐
 *   │        Initialize helpers        │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │       MovableSocketHandle        │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │  Return State / Result Payload   │
 *   └──────────────────────────────────┘
 */

// ════ VIEWER2DNODES EXTRACTED HELPERS ═════════════════════════════════════════════
import React from 'react';
import { MovableSocketView } from '../MovableSocketView';
import type { MovableSocketHandleProps } from './types';

export function MovableSocketHandle({
  socket,
  nodeId,
  isOutput,
  baseY,
  onSocketMouseDown,
  onSocketNudgeChange
}: MovableSocketHandleProps) {
  return (
    <MovableSocketView
      nodeId={nodeId}
      socket={socket}
      isRight={isOutput}
      topOffset={baseY}
      onMouseDown={onSocketMouseDown}
      onSocketNudgeChange={onSocketNudgeChange}
    />
  );
}