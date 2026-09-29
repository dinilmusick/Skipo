/**
 * ASCII Architecture Flowchart: PanelContainer
 *
 *   ┌──────────────────────────────────┐
 *   │    Initialize PanelContainer     │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │          PanelContainer          │
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
import '../../styles/containers.css';


// ════ PANELCONTAINER IMPLEMENTATION ═══════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export const PanelContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({
  className = '',
  children,
  ...props
}, ref) => {
  return (
    <div ref={ref} className={`skipo-panel-container ${className}`} {...props}>
      {children}
    </div>
  );
});
PanelContainer.displayName = 'PanelContainer';