/**
 * ASCII Architecture Flowchart: SearchInput
 *
 *   ┌──────────────────────────────────┐
 *   │      Initialize SearchInput      │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │           SearchInput            │
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
import { BaseInput } from '../base/BaseInput.js';
import '../../styles/composite.css';


// ════ SEARCHINPUT IMPLEMENTATION ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export const SearchInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({
  className = '',
  ...props
}, ref) => {
  return (
    <div className="skipo-search-input">
      <BaseInput ref={ref} type="search" placeholder="Search..." className={className} {...props} />
    </div>
  );
});
SearchInput.displayName = 'SearchInput';