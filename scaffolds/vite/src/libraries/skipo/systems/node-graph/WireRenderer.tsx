'use client';
import { useState } from 'react';
import type { GraphEdge, NodeGraphConfig } from './types.js';

interface WireRendererProps {
  edges: GraphEdge[];
  nodesData: Record<string, { x: number; y: number; width: number; height: number; inputs: any[]; outputs: any[] }>;
  config?: NodeGraphConfig;
  onDeleteEdge?: (edgeId: string) => void;
  connecting?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    color?: string;
  } | null;
}

export function WireRenderer({ edges, nodesData, config: _config, onDeleteEdge, connecting }: WireRendererProps) {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const getSocketPosition = (nodeId: string, socketId: string, type: 'input' | 'output') => {
    const node = nodesData[nodeId];
    if (!node) return { x: 0, y: 0 };
    
    const sockets = type === 'input' ? node.inputs : node.outputs;
    const socket = sockets?.find(s => s.id === socketId);
    const socketIndex = sockets && socket ? sockets.indexOf(socket) : 0;
    const total = sockets?.length ?? 1;
    const zoom = (node as any).zoom ?? 1;
    const nodeHeight = node.height ?? (130 * zoom);
      
    let x = type === 'input' ? node.x : node.x + (node.width ?? (150 * zoom));
    const baseOffset = total === 1 ? (nodeHeight * 0.5) : (nodeHeight * 0.25) + (Math.max(0, socketIndex) * 24 * zoom);
    let y = node.y + baseOffset;
    
    if (socket?.offset) {
      x += socket.offset.x * zoom;
      y += socket.offset.y * zoom;
    }
    
    return { x, y };
  };

  const renderBezier = (startX: number, startY: number, endX: number, endY: number) => {
    const delta = Math.max(Math.abs(endX - startX) * 0.5, 50);
    return `M ${startX},${startY} C ${startX + delta},${startY} ${endX - delta},${endY} ${endX},${endY}`;
  };

  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
      {edges.map(edge => {
        const start = getSocketPosition(edge.source, edge.sourceSocket, 'output');
        const end = getSocketPosition(edge.target, edge.targetSocket, 'input');
        
        const path = renderBezier(start.x, start.y, end.x, end.y);
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const color = edge.color || '#61afef';
        const isHovered = hoveredEdgeId === edge.id;

        return (
          <g 
            key={edge.id} 
            style={{ pointerEvents: 'auto' }}
            onMouseEnter={() => setHoveredEdgeId(edge.id)}
            onMouseLeave={() => setHoveredEdgeId(null)}
          >
            {/* Generous hit area for easier hover and selection */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            />
            {/* Actual visual wire */}
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={isHovered ? 3.5 : 3}
              opacity={isHovered ? 1 : 0.8}
            />
            {/* Midpoint widgets: ONLY visible when mouse hovers over the wire */}
            {isHovered && onDeleteEdge && (
              <g 
                transform={`translate(${midX}, ${midY})`} 
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteEdge(edge.id);
                }}
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              >
                <circle r={14} fill="transparent" />
                <circle r={8} fill="#ff4d4f" />
                <text x={0} y={0} fontSize={10} fill="white" textAnchor="middle" dominantBaseline="central">✕</text>
              </g>
            )}
          </g>
        );
      })}
      
      {connecting && (
        <path
          d={renderBezier(connecting.startX, connecting.startY, connecting.endX, connecting.endY)}
          fill="none"
          stroke={connecting.color || '#61afef'}
          strokeWidth={3}
          strokeDasharray="5,5"
          opacity={0.8}
        />
      )}
    </svg>
  );
}
