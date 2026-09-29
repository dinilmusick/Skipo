/**
 * ASCII Architecture Flowchart: DockItem
 *
 *   ┌──────────────────────────────────┐
 *   │       Initialize DockItem        │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │             DockItem             │
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
import type { DockItemConfig } from './types.js';

interface DockItemProps {
  key?: React.Key;
  item: DockItemConfig;
  isActive?: boolean;
  onClick?: () => void;
}


// ════ DOCKITEM IMPLEMENTATION ═════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export function DockItem({ item, isActive, onClick }: DockItemProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        cursor: 'pointer',
        backgroundColor: isActive ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
        transition: 'background-color 0.2s, transform 0.1s',
        color: 'var(--skipo-text-primary, #ffffff)',
      }}
      onClick={() => {
        onClick?.();
        item.onClick?.();
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isActive ? 'rgba(255, 255, 255, 0.15)' : 'transparent';
        e.currentTarget.style.transform = 'scale(1)';
      }}
      title={item.label}
    >
      <div style={{ fontSize: '24px' }}>{item.icon}</div>
      {item.badge && (
        <div style={{
          position: 'absolute',
          top: '0',
          right: '0',
          backgroundColor: '#ff4d4f',
          color: 'white',
          fontSize: '10px',
          fontWeight: 'bold',
          padding: '2px 6px',
          borderRadius: '10px',
          transform: 'translate(25%, -25%)',
          border: '2px solid #1e1e1e'
        }}>
          {item.badge}
        </div>
      )}
      {isActive && (
        <div style={{
          position: 'absolute',
          bottom: '-6px',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'var(--skipo-accent, #d4af37)',
        }} />
      )}
    </div>
  );
}