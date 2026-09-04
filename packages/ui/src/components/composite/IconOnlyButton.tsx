\'use client\';
import React, { forwardRef } from 'react';
import { BaseTooltip } from '../base/BaseTooltip.js';
import '../../styles/composite.css';

export interface IconOnlyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export const IconOnlyButton = forwardRef<HTMLButtonElement, IconOnlyButtonProps>(({
  icon,
  label,
  tooltipPosition,
  className = '',
  ...props
}, ref) => {
  return (
    <BaseTooltip content={label} position={tooltipPosition}>
      <button ref={ref} className={`skipo-icon-btn ${className}`} aria-label={label} {...props}>
        {icon}
      </button>
    </BaseTooltip>
  );
});
IconOnlyButton.displayName = 'IconOnlyButton';
