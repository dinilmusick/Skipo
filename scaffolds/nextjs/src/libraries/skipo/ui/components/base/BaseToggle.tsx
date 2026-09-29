/**
 * ASCII Architecture Flowchart: BaseToggle
 *
 *   ┌──────────────────────────────────┐
 *   │      Initialize BaseToggle       │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │            BaseToggle            │
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
import '../../styles/base.css';

export interface BaseToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}


// ════ BASETOGGLE IMPLEMENTATION ═══════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export const BaseToggle = forwardRef<HTMLInputElement, BaseToggleProps>(({
  label,
  className = '',
  ...props
}, ref) => {
  return (
    <label className="skipo-toggle-label">
      <input ref={ref} type="checkbox" className={`skipo-toggle ${className}`} {...props} />
      {label && <span>{label}</span>}
    </label>
  );
});
BaseToggle.displayName = 'BaseToggle';