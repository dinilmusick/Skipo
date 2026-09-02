'use client';

import React, { useState } from 'react';

export interface IconOnlyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip: string;
  icon: React.ReactNode;
  active?: boolean;
  variant?: 'accent' | 'surface' | 'subtle' | 'danger' | 'secondary';
  position?: 'top' | 'bottom' | 'left' | 'right';
  badgeCount?: number | string;
}

/**
 * Neo-Brutalist Icon-Only Button with Tactile Glow & Hover Tooltip
 * Zero on-screen text labels on button surface; details revealed strictly on hover.
 */
export const IconOnlyButton: React.FC<IconOnlyButtonProps> = ({
  tooltip,
  icon,
  active = false,
  variant = 'surface',
  position = 'top',
  badgeCount,
  className = '',
  onClick,
  disabled,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getVariantStyles = () => {
    if (active) {
      return {
        bg: '#D4AF37',
        color: '#000000',
        border: '2px solid #D4AF37',
        glow: '0 0 14px rgba(212, 175, 55, 0.5), 2px 2px 0px #000000',
      };
    }
    switch (variant) {
      case 'accent':
        return {
          bg: '#D4AF37',
          color: '#000000',
          border: '2px solid #D4AF37',
          glow: '0 0 14px rgba(212, 175, 55, 0.5), 2px 2px 0px #000000',
        };
      case 'danger':
        return {
          bg: isHovered ? '#dc2626' : '#1C1A15',
          color: isHovered ? '#ffffff' : '#ef4444',
          border: '2px solid #ef4444',
          glow: '0 0 14px rgba(239, 68, 68, 0.5), 2px 2px 0px #000000',
        };
      case 'secondary':
        return {
          bg: isHovered ? '#B59443' : '#1E1B10',
          color: isHovered ? '#000000' : '#F3EDE0',
          border: '2px solid #D4AF37',
          glow: '0 0 12px rgba(212, 175, 55, 0.4), 2px 2px 0px #000000',
        };
      case 'subtle':
        return {
          bg: isHovered ? '#26241D' : '#141310',
          color: isHovered ? '#F3EDE0' : '#A09580',
          border: '1px solid #D4AF37',
          glow: '0 0 10px rgba(212, 175, 55, 0.3), 1px 1px 0px #000000',
        };
      default: // surface
        return {
          bg: isHovered ? '#26241D' : '#141310',
          color: '#F3EDE0',
          border: '2px solid #D4AF37',
          glow: '0 0 12px rgba(212, 175, 55, 0.4), 2px 2px 0px #000000',
        };
    }
  };

  const currentStyles = getVariantStyles();

  const tooltipPosClass = {
    top: 'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2',
    bottom: 'top-[calc(100%+8px)] left-1/2 -translate-x-1/2',
    left: 'right-[calc(100%+8px)] top-1/2 -translate-y-1/2',
    right: 'left-[calc(100%+8px)] top-1/2 -translate-y-1/2',
  }[position];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-label={tooltip}
        disabled={disabled}
        className={`krnl-btn-icon-only flex items-center justify-start p-2.5 transition-all duration-300 ease-in-out cursor-pointer select-none relative ${
          disabled ? 'opacity-40 cursor-not-allowed' : ''
        } ${className}`}
        style={{
          background: currentStyles.bg,
          color: currentStyles.color,
          border: currentStyles.border,
          boxShadow: isHovered || active ? currentStyles.glow : '2px 2px 0px #000000',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
        {...props}
      >
        <div className="flex items-center justify-center min-w-[18px]">
          {icon}
        </div>
        
        <span
          className={`overflow-hidden transition-all duration-300 ease-in-out font-mono font-black uppercase text-[10px] tracking-wider whitespace-nowrap ${
            isHovered ? 'max-w-[260px] opacity-100 ml-2' : 'max-w-0 opacity-0'
          }`}
        >
          {tooltip}
        </span>

        {badgeCount !== undefined && (
          <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 text-[9px] font-black bg-[#D4AF37] text-black border border-black shadow-sm z-10">
            {badgeCount}
          </span>
        )}
      </button>
    </div>
  );
};
