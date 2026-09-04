'use client';
import React from 'react';
import type { GraphNode, Socket } from './types.js';

interface NodeCardProps {
  node: GraphNode;
  selected?: boolean;
  onMouseDown?: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick?: (nodeId: string) => void;
  onSocketMouseDown?: (e: React.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
}

export function NodeCard({ node, selected, onMouseDown, onDoubleClick, onSocketMouseDown }: NodeCardProps) {
  const width = node.width ?? 150;
  
  return (
    <div
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width,
        backgroundColor: 'rgba(25, 25, 25, 0.8)',
        backdropFilter: 'blur(10px)',
        border: `2px solid ${selected ? '#d4af37' : '#333'}`,
        borderRadius: '8px',
        color: '#fff',
        fontFamily: 'sans-serif',
        userSelect: 'none',
        boxShadow: selected ? '0 0 15px rgba(212, 175, 55, 0.4)' : '0 4px 6px rgba(0,0,0,0.3)',
      }}
      onMouseDown={(e) => onMouseDown?.(e, node.id)}
      onDoubleClick={() => onDoubleClick?.(node.id)}
    >
      <div style={{
        padding: '8px',
        borderBottom: '1px solid #333',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderTopLeftRadius: '6px',
        borderTopRightRadius: '6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <strong style={{ fontSize: '12px' }}>{node.label}</strong>
        <span style={{ fontSize: '10px', backgroundColor: '#444', padding: '2px 4px', borderRadius: '4px' }}>
          {node.type}
        </span>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '50%' }}>
          {node.inputs?.map(socket => (
            <SocketView 
              key={socket.id} 
              socket={socket} 
              onMouseDown={(e) => onSocketMouseDown?.(e, node.id, socket.id, 'input')} 
            />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '50%', alignItems: 'flex-end' }}>
          {node.outputs?.map(socket => (
            <SocketView 
              key={socket.id} 
              socket={socket} 
              onMouseDown={(e) => onSocketMouseDown?.(e, node.id, socket.id, 'output')} 
              isRight
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SocketView({ socket, isRight, onMouseDown }: { socket: Socket, isRight?: boolean, onMouseDown: React.MouseEventHandler }) {
  const dot = (
    <div 
      style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: '#61afef',
        cursor: 'crosshair',
        border: '2px solid #222'
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDown(e);
      }}
    />
  );
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '4px',
      padding: isRight ? '0 0 0 4px' : '0 4px 0 0',
      transform: isRight ? 'translateX(5px)' : 'translateX(-5px)'
    }}>
      {!isRight && dot}
      <span style={{ fontSize: '10px', color: '#ccc' }}>{socket.label}</span>
      {isRight && dot}
    </div>
  );
}
