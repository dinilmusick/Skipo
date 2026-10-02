'use client';
import React, { useRef, useState, useLayoutEffect } from 'react';
import type { GraphNode } from './types.js';
import { MovableSocketView } from './MovableSocketView.js';

export interface NodeCardProps {
  node: GraphNode;
  selected?: boolean;
  onMouseDown?: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick?: (nodeId: string) => void;
  onSocketMouseDown?: (e: React.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
  onSocketMouseUp?: (e: React.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
  onSocketNudgeChange?: (nodeId: string, socketId: string, nudge: { x: number; y: number }) => void;
}

function renderNodeEmblem(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('entity') || t.includes('system')) {
    return (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--skipo-accent, #d4af37)" strokeWidth="1.8">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    );
  }
  if (t.includes('func') || t.includes('logic')) {
    return (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--skipo-accent, #61afef)" strokeWidth="1.8">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    );
  }
  if (t.includes('data') || t.includes('state') || t.includes('db')) {
    return (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#98c379" strokeWidth="1.8">
        <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    );
  }
  if (t.includes('number') || t.includes('math')) {
    return (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--skipo-accent, #61afef)" strokeWidth="1.8">
        <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
      </svg>
    );
  }
  if (t.includes('string') || t.includes('text')) {
    return (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#98c379" strokeWidth="1.8">
        <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    );
  }
  if (t.includes('bool') || t.includes('toggle')) {
    return (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#e5c07b" strokeWidth="1.8">
        <rect x="1" y="5" width="22" height="14" rx="7" ry="7" /><circle cx="16" cy="12" r="3" fill="#e5c07b" />
      </svg>
    );
  }
  if (t.includes('vector') || t.includes('vec')) {
    return (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#56b6c2" strokeWidth="1.8">
        <path d="M5 19L19 5" /><polyline points="9 5 19 5 19 15" />
      </svg>
    );
  }
  if (t.includes('color')) {
    return (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#e06c75" strokeWidth="1.8">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    );
  }
  if (t.includes('display') || t.includes('view') || t.includes('out')) {
    return (
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#c678dd" strokeWidth="1.8">
        <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  }
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--skipo-accent, #61afef)" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export function NodeCard({
  node, selected, onMouseDown, onDoubleClick,
  onSocketMouseDown, onSocketMouseUp, onSocketNudgeChange
}: NodeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number>(node.height ?? 130);

  useLayoutEffect(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      if (rect.height && Math.abs(rect.height - measuredHeight) > 1) {
        setMeasuredHeight(rect.height);
      }
    }
  });

  const minWidth = node.width ?? 130;
  const minHeight = node.height ?? 130;
  const isLongText = (node.label || '').length > 11;

  return (
    <div
      ref={cardRef}
      style={{
        position: 'absolute', left: node.position.x, top: node.position.y,
        minWidth, width: node.width ? `${node.width}px` : 'max-content',
        minHeight, height: 'auto', userSelect: 'none'
      }}
      onMouseDown={(e) => onMouseDown?.(e, node.id)}
      onDoubleClick={() => onDoubleClick?.(node.id)}
    >
      <style>{`
        @keyframes skipo-marquee-rtl { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
      `}</style>

      {/* Perimeter Bounded Node Body: Natural Content-Driven Expansion */}
      <div
        style={{
          width: '100%', minHeight, height: '100%', position: 'relative',
          display: 'flex', flexDirection: 'column',
          backgroundColor: 'var(--skipo-surface, rgba(25, 25, 25, 0.92))',
          backdropFilter: 'blur(10px)',
          border: `2px solid ${selected ? 'var(--skipo-accent, #d4af37)' : 'var(--skipo-border, #333)'}`,
          borderRadius: '8px',
          boxShadow: selected ? '0 0 16px rgba(212, 175, 55, 0.45)' : '0 4px 10px rgba(0,0,0,0.4)',
          overflow: 'visible', boxSizing: 'border-box'
        }}
      >
        {/* Top Portion: Scaled Icon Emblem */}
        <div
          style={{
            flex: '1 0 auto', minHeight: '84px', width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            background: 'radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, transparent 72%)',
            padding: '12px'
          }}
        >
          {renderNodeEmblem(node.type)}
        </div>

        {/* Bottom Content Area: Natural Height Text & Child Info */}
        <div
          style={{
            flex: '0 0 auto', minHeight: '38px', width: '100%',
            borderTop: '1px solid var(--skipo-border, #333)',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '6px 8px', boxSizing: 'border-box'
          }}
        >
          <div style={{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: isLongText ? 'flex-start' : 'center' }}>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
                fontSize: '11px', fontWeight: 600, color: 'var(--skipo-text, #fff)',
                letterSpacing: '0.02em', animation: isLongText ? 'skipo-marquee-rtl 6s linear infinite' : 'none'
              }}
            >
              <span>{node.label}</span>
              {isLongText && <span style={{ paddingLeft: '16px', opacity: 0.8 }}>• {node.label}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Input Sockets along Left Outer Border */}
      {node.inputs?.map((socket, idx) => {
        const total = node.inputs?.length ?? 1;
        const topOffset = total === 1 ? measuredHeight * 0.5 : (measuredHeight * 0.25) + idx * 24;
        return (
          <MovableSocketView
            key={socket.id} nodeId={node.id} socket={socket} topOffset={topOffset}
            onMouseDown={onSocketMouseDown} onMouseUp={onSocketMouseUp} onSocketNudgeChange={onSocketNudgeChange}
          />
        );
      })}

      {/* Output Sockets along Right Outer Border */}
      {node.outputs?.map((socket, idx) => {
        const total = node.outputs?.length ?? 1;
        const topOffset = total === 1 ? measuredHeight * 0.5 : (measuredHeight * 0.25) + idx * 24;
        return (
          <MovableSocketView
            key={socket.id} nodeId={node.id} socket={socket} isRight topOffset={topOffset}
            onMouseDown={onSocketMouseDown} onMouseUp={onSocketMouseUp} onSocketNudgeChange={onSocketNudgeChange}
          />
        );
      })}
    </div>
  );
}
