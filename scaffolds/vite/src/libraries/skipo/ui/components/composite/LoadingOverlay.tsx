/**
 * ASCII Architecture Flowchart: LoadingOverlay
 *
 *   ┌──────────────────────────────────┐
 *   │    Initialize LoadingOverlay     │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │          LoadingOverlay          │
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
import '../../styles/composite.css';


// ════ LOADINGOVERLAY IMPLEMENTATION ═══════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export const LoadingOverlay = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({
  className = '',
  ...props
}, ref) => {
  return (
    <div ref={ref} className={`skipo-loading-overlay ${className}`} {...props}>
      <span className="skipo-spinner">Loading...</span>
    </div>
  );
});
LoadingOverlay.displayName = 'LoadingOverlay';