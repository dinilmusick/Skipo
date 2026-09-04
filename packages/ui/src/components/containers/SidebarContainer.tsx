\'use client\';
import React, { forwardRef, useState } from 'react';
import '../../styles/containers.css';

export interface SidebarContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  minWidth?: number;
  maxWidth?: number;
}

export const SidebarContainer = forwardRef<HTMLDivElement, SidebarContainerProps>(({
  minWidth = 200,
  maxWidth = 400,
  children,
  className = '',
  ...props
}, ref) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside ref={ref} style={{ width: collapsed ? 60 : minWidth, maxWidth }} className={`skipo-sidebar-container ${className}`} {...props}>
      <button onClick={() => setCollapsed(!collapsed)}>Toggle</button>
      {!collapsed && children}
    </aside>
  );
});
SidebarContainer.displayName = 'SidebarContainer';
