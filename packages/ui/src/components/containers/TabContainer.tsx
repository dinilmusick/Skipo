\'use client\';
import React, { forwardRef, useState } from 'react';
import '../../styles/containers.css';

export interface TabContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: { id: string; label: string; content: React.ReactNode }[];
}

export const TabContainer = forwardRef<HTMLDivElement, TabContainerProps>(({
  tabs,
  className = '',
  ...props
}, ref) => {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id);
  return (
    <div ref={ref} className={`skipo-tab-container ${className}`} {...props}>
      <div className="skipo-tab-list">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </div>
      <div className="skipo-tab-panel">
        {tabs.find(t => t.id === activeTab)?.content}
      </div>
    </div>
  );
});
TabContainer.displayName = 'TabContainer';
