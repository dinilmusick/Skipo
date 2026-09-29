/**
 * ASCII Architecture Flowchart: BreadcrumbNav
 *
 *   ┌──────────────────────────────────┐
 *   │     Initialize BreadcrumbNav     │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │          BreadcrumbNav           │
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

export interface BreadcrumbNavProps extends React.HTMLAttributes<HTMLElement> {
  paths: { label: string; href?: string }[];
}


// ════ BREADCRUMBNAV IMPLEMENTATION ════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export const BreadcrumbNav = forwardRef<HTMLElement, BreadcrumbNavProps>(({
  paths,
  className = '',
  ...props
}, ref) => {
  return (
    <nav ref={ref} className={`skipo-breadcrumb ${className}`} {...props}>
      {paths.map((p, i) => (
        <React.Fragment key={i}>
          {p.href ? <a href={p.href}>{p.label}</a> : <span>{p.label}</span>}
          {i < paths.length - 1 && <span>/</span>}
        </React.Fragment>
      ))}
    </nav>
  );
});
BreadcrumbNav.displayName = 'BreadcrumbNav';