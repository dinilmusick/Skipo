'use client';
import React, { forwardRef } from 'react';
import { BottomStripProvider } from '../bottom-strip/BottomStripContext.js';
import { BottomStrip, type BottomStripProps } from '../bottom-strip/BottomStrip.js';
import '../../styles/layout.css';

export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  footer?: React.ReactNode;
  bottomStripProps?: BottomStripProps;
  disableBottomStrip?: boolean;
}

/**
 * AppShell — Root layout container providing top toolbar slot, clean central viewport, and bottom strip.
 */
export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(({
  header,
  sidebar,
  footer,
  bottomStripProps,
  disableBottomStrip = false,
  children,
  className = '',
  ...props
}, ref) => {
  return (
    <BottomStripProvider>
      <div
        ref={ref}
        className={`skipo-app-shell ${className}`}
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          background: 'var(--skipo-bg)',
          color: 'var(--skipo-text)',
          fontFamily: 'var(--skipo-font)',
        }}
        {...props}
      >
        {sidebar}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {header}
          <main
            className="skipo-app-shell__main"
            style={{
              flex: 1,
              overflow: 'auto',
              position: 'relative',
            }}
          >
            {children}
          </main>
          {footer !== undefined ? footer : (!disableBottomStrip && <BottomStrip {...bottomStripProps} />)}
        </div>
      </div>
    </BottomStripProvider>
  );
});

AppShell.displayName = 'AppShell';
