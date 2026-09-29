/**
 * ASCII Architecture Flowchart: HeaderBar
 *
 *   ┌──────────────────────────────────┐
 *   │       Initialize HeaderBar       │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │            HeaderBar             │
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
import React, { forwardRef } from 'react';
import '../../styles/layout.css';

export interface HeaderBarProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  nav?: React.ReactNode;
  actions?: React.ReactNode;
}


// ════ HEADERBAR IMPLEMENTATION ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export const HeaderBar = forwardRef<HTMLElement, HeaderBarProps>(({
  title,
  nav,
  actions,
  className = '',
  ...props
}, ref) => {
  return (
    <header ref={ref} className={`skipo-header ${className}`} {...props}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {title && <strong>{title}</strong>}
        {nav}
      </div>
      {actions && <div>{actions}</div>}
    </header>
  );
});
HeaderBar.displayName = 'HeaderBar';