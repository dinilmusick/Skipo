/**
 * ASCII Architecture Flowchart: SectionContainer
 *
 *   ┌──────────────────────────────────┐
 *   │   Initialize SectionContainer    │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │         SectionContainer         │
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
import React, { forwardRef, useState } from 'react';
import '../../styles/containers.css';

export interface SectionContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  heading: React.ReactNode;
  collapsible?: boolean;
}


// ════ SECTIONCONTAINER IMPLEMENTATION ═════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export const SectionContainer = forwardRef<HTMLDivElement, SectionContainerProps>(({
  heading,
  collapsible,
  children,
  className = '',
  ...props
}, ref) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section ref={ref} className={`skipo-section-container ${className}`} {...props}>
      <h3 onClick={() => collapsible && setCollapsed(!collapsed)}>{heading}</h3>
      {!collapsed && <div>{children}</div>}
    </section>
  );
});
SectionContainer.displayName = 'SectionContainer';