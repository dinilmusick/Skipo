'use client';
import React, { forwardRef } from 'react';
import { useBottomStrip } from './BottomStripContext.js';
import { StatusLight } from './StatusLight.js';
import { AutoSaveToggle } from './AutoSaveToggle.js';
import { ApiCallIndicator } from './ApiCallIndicator.js';
import { SystemMessageDisplay } from './SystemMessageDisplay.js';

export interface BottomStripProps extends React.HTMLAttributes<HTMLElement> {
  leftSlot?: React.ReactNode;
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  hideDefaultLeft?: boolean;
  hideDefaultRight?: boolean;
}

export const BottomStrip = forwardRef<HTMLElement, BottomStripProps>(({
  leftSlot,
  centerSlot,
  rightSlot,
  hideDefaultLeft = false,
  hideDefaultRight = false,
  className = '',
  ...props
}, ref) => {
  const { inspectionText } = useBottomStrip();

  return (
    <footer
      ref={ref}
      className={`skipo-bottom-strip ${className}`}
      style={{
        height: 'var(--skipo-bottom-strip-height, 30px)',
        minHeight: 'var(--skipo-bottom-strip-height, 30px)',
        background: 'var(--skipo-bottom-strip-bg, rgba(15, 17, 21, 0.95))',
        borderTop: 'var(--skipo-border, 2px solid rgba(255, 255, 255, 0.85))',
        backdropFilter: 'var(--skipo-matte-blur, blur(20px))',
        WebkitBackdropFilter: 'var(--skipo-matte-blur, blur(20px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0.75rem',
        fontSize: '11px',
        fontFamily: 'var(--skipo-font-mono)',
        zIndex: 40,
        position: 'relative',
        userSelect: 'none',
      }}
      {...props}
    >
      {/* Left Slot: Status light, auto-save toggle, etc. */}
      <div
        className="skipo-bottom-strip__left"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
          minWidth: '120px',
        }}
      >
        {!hideDefaultLeft && (
          <>
            <StatusLight />
            <AutoSaveToggle />
          </>
        )}
        {leftSlot}
      </div>

      {/* Center Slot: Smoothly fading translucent inspection text */}
      <div
        className="skipo-bottom-strip__center"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '0 1rem',
          pointerEvents: 'none',
        }}
      >
        {centerSlot || (
          <span
            className="skipo-inspection-text"
            style={{
              color: 'var(--skipo-inspection-text-color, rgba(241, 245, 249, 0.80))',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: inspectionText ? 0.85 : 0,
              transform: inspectionText ? 'translateY(0)' : 'translateY(2px)',
              transition: 'opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {inspectionText || ''}
          </span>
        )}
      </div>

      {/* Right Slot: API activity & system messages */}
      <div
        className="skipo-bottom-strip__right"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px',
          flexShrink: 0,
          minWidth: '140px',
        }}
      >
        {rightSlot}
        {!hideDefaultRight && (
          <>
            <ApiCallIndicator />
            <SystemMessageDisplay />
          </>
        )}
      </div>
    </footer>
  );
});

BottomStrip.displayName = 'BottomStrip';
