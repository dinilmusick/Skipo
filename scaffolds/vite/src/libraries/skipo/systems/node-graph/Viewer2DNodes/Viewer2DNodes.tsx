/**
 * ASCII Architecture Flowchart: Viewer2DNodes
 *
 *   ┌──────────────────────────────────┐
 *   │     Initialize Viewer2DNodes     │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │          Viewer2DNodes           │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │            cardWidth             │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │           headerHeight           │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │  Return State / Result Payload   │
 *   └──────────────────────────────────┘
 */

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export * from './types';
export * from './helpers';

'use client';
import type React from 'react';
import { useState, useRef } from 'react';
import type { GraphNode, Socket } from '../types.js';
import { getBeamPoints, calculateSocketCoordinates } from '../spatial/socketCoordinates.js';
import type { Viewer2DNodesProps } from './types.js';
import { MovableSocketHandle } from './helpers.js';



// ════ VIEWER2DNODES IMPLEMENTATION ════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export function Viewer2DNodes({
  node,
  selected,
  onMouseDown,
  onDoubleClick,
  onSocketMouseDown,
  onSocketNudgeChange
}: Viewer2DNodesProps) {
  const cardWidth = node.width ?? 180;
  const headerHeight = 36;
  const socketSpacing = 36;
  const centerX = cardWidth / 2;

  return (
    <div
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: cardWidth,
        backgroundColor: 'rgba(20, 24, 30, 0.9)',
        backdropFilter: 'blur(12px)',
        border: `2px solid ${selected ? 'var(--skipo-accent, #d4af37)' : 'rgba(255, 255, 255, 0.12)'}`,
        borderRadius: '10px',
        color: '#f5ede4',
        fontFamily: 'Inter, system-ui, sans-serif',
        userSelect: 'none',
        boxShadow: selected ? '0 0 20px rgba(212, 175, 55, 0.45)' : '0 8px 16px rgba(0, 0, 0, 0.4)',
        zIndex: selected ? 25 : 15
      }}
      onMouseDown={(e) => onMouseDown?.(e, node.id)}
      onDoubleClick={() => onDoubleClick?.(node.id)}
    >
      {/* Node Header */}
      <div
        style={{
          height: `${headerHeight}px`,
          padding: '0 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px'
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.02em' }}>{node.label}</span>
        <span
          style={{
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: '#a0aec0'
          }}
        >
          {node.type}
        </span>
      </div>

      {/* Node Content / Body Area */}
      <div style={{ position: 'relative', minHeight: '60px', padding: '12px 16px' }}>
        {node.data && (
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            {Object.keys(node.data).length} properties
          </div>
        )}
      </div>

      {/* Sockets Container (centered horizontally at node midpoint) */}
      <div style={{ position: 'absolute', top: headerHeight + 10, left: centerX, width: 0, height: 0 }}>
        {node.inputs?.map((socket, idx) => (
          <MovableSocketHandle
            key={socket.id}
            socket={socket}
            nodeId={node.id}
            cardWidth={cardWidth}
            isOutput={false}
            baseY={idx * socketSpacing}
            onSocketMouseDown={onSocketMouseDown}
            onSocketNudgeChange={onSocketNudgeChange}
          />
        ))}

        {node.outputs?.map((socket, idx) => (
          <MovableSocketHandle
            key={socket.id}
            socket={socket}
            nodeId={node.id}
            cardWidth={cardWidth}
            isOutput={true}
            baseY={idx * socketSpacing}
            onSocketMouseDown={onSocketMouseDown}
            onSocketNudgeChange={onSocketNudgeChange}
          />
        ))}
      </div>
    </div>
  );
}