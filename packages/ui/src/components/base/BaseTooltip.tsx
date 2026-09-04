\'use client\';
import React, { forwardRef } from 'react';
import '../../styles/base.css';

export interface BaseTooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const BaseTooltip = forwardRef<HTMLDivElement, BaseTooltipProps>(({
  content,
  position = 'top',
  children,
  className = '',
  ...props
}, ref) => {
  return (
    <div className="skipo-tooltip-wrapper" style={{position: 'relative', display: 'inline-block'}}>
      {children}
      <div ref={ref} className={`skipo-tooltip skipo-tooltip--${position} ${className}`} {...props}>
        {content}
      </div>
    </div>
  );
});
BaseTooltip.displayName = 'BaseTooltip';
