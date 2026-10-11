'use client';
import type React from 'react';
import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import type { GraphNode } from './types.js';
import { MovableSocketView } from './MovableSocketView.js';
import { NodeEmblem } from './NodeEmblem.js';
import { useBottomStrip } from '@skipo/ui';

export interface NodeCardProps {
  node: GraphNode;
  selected?: boolean;
  onMouseDown?: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick?: (nodeId: string) => void;
  onSocketMouseDown?: (e: React.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
  onSocketMouseUp?: (e: React.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
  onSocketNudgeChange?: (nodeId: string, socketId: string, nudge: { x: number; y: number }) => void;
  onToggleMinimize?: (nodeId: string, isMinimized: boolean) => void;
}

export function NodeCard({
  node, selected, onMouseDown, onDoubleClick,
  onSocketMouseDown, onSocketMouseUp, onSocketNudgeChange, onToggleMinimize
}: NodeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(node.minimized ?? false);
  const [measuredHeight, setMeasuredHeight] = useState<number>(isMinimized ? 40 : (node.height ?? 130));
  const { setInspectionText } = useBottomStrip();

  useEffect(() => {
    if (node.minimized !== undefined && node.minimized !== isMinimized) {
      setIsMinimized(node.minimized);
    }
  }, [node.minimized]);

  useLayoutEffect(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      if (rect.height && Math.abs(rect.height - measuredHeight) > 1) {
        setMeasuredHeight(rect.height);
      }
    }
  });

  const toggleMinimize = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = !isMinimized;
    setIsMinimized(next);
    onToggleMinimize?.(node.id, next);
  };

  const handleMouseEnter = () => {
    // Show system name in bottom bar on hover (Law L9 & L19)
    const desc = (node.data?.description as string) || `System: ${node.type} • Title: ${node.label}`;
    setInspectionText(node.type, desc);
  };

  const minWidth = node.width ?? 150;
  const minHeight = isMinimized ? 40 : (node.height ?? 130);
  const isLongText = (node.label || '').length > 11;

  return (
    <div
      ref={cardRef}
      style={{
        position: 'absolute', left: node.position.x, top: node.position.y,
        minWidth, width: node.width ? `${node.width}px` : 'max-content',
        minHeight, height: isMinimized ? '40px' : 'auto', userSelect: 'none'
      }}
      onMouseDown={(e) => onMouseDown?.(e, node.id)}
      onDoubleClick={(e) => { e.stopPropagation(); toggleMinimize(); onDoubleClick?.(node.id); }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setInspectionText(null)}
    >
      <style>{`
        @keyframes skipo-marquee-rtl { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
      `}</style>

      {/* Perimeter Bounded Node Body: Expanded vs Minimized */}
      <div
        style={{
          width: '100%', minHeight, height: '100%', position: 'relative',
          display: 'flex', flexDirection: isMinimized ? 'row' : 'column',
          backgroundColor: 'var(--skipo-surface, rgba(25, 25, 25, 0.92))',
          backdropFilter: 'blur(10px)',
          border: `2px solid ${selected ? 'var(--skipo-accent, #d4af37)' : 'var(--skipo-border, #333)'}`,
          borderRadius: '8px',
          boxShadow: selected ? '0 0 16px rgba(212, 175, 55, 0.45)' : '0 4px 10px rgba(0,0,0,0.4)',
          overflow: 'visible', boxSizing: 'border-box'
        }}
      >
        {isMinimized ? (
          /* Minimized View: Exactly 1/3 Icon and 2/3 Title (Custom Name) */
          <>
            <div style={{
              width: '33.333%', flex: '0 0 33.333%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, transparent 72%)',
              borderRight: '1px solid var(--skipo-border, #333)', boxSizing: 'border-box'
            }}>
              <NodeEmblem type={node.type} size={20} />
            </div>
            <div style={{
              width: '66.667%', flex: '0 0 66.667%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: isLongText ? 'flex-start' : 'center',
              padding: '0 8px', boxSizing: 'border-box', overflow: 'hidden'
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
                fontSize: '11px', fontWeight: 600, color: 'var(--skipo-text, #fff)',
                letterSpacing: '0.02em', animation: isLongText ? 'skipo-marquee-rtl 6s linear infinite' : 'none'
              }}>
                <span>{node.label}</span>
                {isLongText && <span style={{ paddingLeft: '16px', opacity: 0.8 }}>• {node.label}</span>}
              </div>
            </div>
          </>
        ) : (
          /* Expanded View: Full Emblem Top + Bottom Title Strip */
          <>
            <div style={{
              flex: '1 0 auto', minHeight: '84px', width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              background: 'radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, transparent 72%)',
              padding: '12px', boxSizing: 'border-box'
            }}>
              <NodeEmblem type={node.type} size={38} />
              <button
                type="button"
                onClick={toggleMinimize}
                title="Minimize Node"
                style={{
                  position: 'absolute', top: 6, right: 6, width: 18, height: 18,
                  borderRadius: 4, background: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--skipo-border, #444)', color: 'var(--skipo-text-muted, #aaa)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 0
                }}
              >
                −
              </button>
            </div>
            <div style={{
              flex: '0 0 auto', minHeight: '38px', width: '100%',
              borderTop: '1px solid var(--skipo-border, #333)', backgroundColor: 'rgba(0, 0, 0, 0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '6px 8px', boxSizing: 'border-box'
            }}>
              <div style={{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: isLongText ? 'flex-start' : 'center' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
                  fontSize: '11px', fontWeight: 600, color: 'var(--skipo-text, #fff)',
                  letterSpacing: '0.02em', animation: isLongText ? 'skipo-marquee-rtl 6s linear infinite' : 'none'
                }}>
                  <span>{node.label}</span>
                  {isLongText && <span style={{ paddingLeft: '16px', opacity: 0.8 }}>• {node.label}</span>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sockets */}
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
