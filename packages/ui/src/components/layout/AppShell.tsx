\'use client\';
import React, { forwardRef } from 'react';
import '../../styles/layout.css';

export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  footer?: React.ReactNode;
}

export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(({
  header,
  sidebar,
  footer,
  children,
  className = '',
  ...props
}, ref) => {
  return (
    <div ref={ref} className={`skipo-app-shell ${className}`} {...props}>
      {sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {header}
        <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>
        {footer}
      </div>
    </div>
  );
});
AppShell.displayName = 'AppShell';
