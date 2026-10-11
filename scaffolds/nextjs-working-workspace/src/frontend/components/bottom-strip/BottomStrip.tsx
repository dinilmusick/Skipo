// ══════════════════════════════════════════════════════════════════════════════
// SKIPO CANONICAL BOTTOM STRIP (Laws L9, L18, L19 Compliance)
// Exclusivity: Dynamic hover inspection in center, 'D' key description inspector
// ══════════════════════════════════════════════════════════════════════════════

'use client';

import React from 'react';
import { useInspectionStore } from '../../../frontend-state/inspectionStore';
import { useAppStore } from '../../../frontend-state/appStore';

export const BottomStrip: React.FC = () => {
  const { hoverLabel, hoverDescription, isDKeyPressed, activeApiCount, systemMessage } = useInspectionStore();
  const { activeWorkspace } = useAppStore();

  const showDescription = isDKeyPressed && Boolean(hoverDescription);
  const displayText = showDescription
    ? hoverDescription
    : hoverLabel || 'HOVER UI ELEMENT // HOLD "D" TO INSPECT';

  return (
    <footer
      data-testid="bottom-strip"
      className="fixed bottom-0 left-0 right-0 h-8 z-50 flex items-center justify-between px-3 text-xs font-mono select-none"
      style={{
        backgroundColor: 'var(--skipo-bg-panel, #0f172a)',
        borderTop: '1px solid var(--skipo-border-subtle, #334155)',
        color: 'var(--skipo-text-muted, #94a3b8)',
      }}
    >
      {/* Left: System & Workspace Status */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-2 h-2 rounded-full inline-block animate-pulse"
          style={{ backgroundColor: 'var(--skipo-status-online, #10b981)' }}
        />
        <span className="font-semibold uppercase tracking-wider text-[10px]" style={{ color: 'var(--skipo-text-primary, #f8fafc)' }}>
          {systemMessage}
        </span>
        {activeWorkspace && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold"
            style={{
              backgroundColor: 'var(--skipo-accent-subtle, #1e293b)',
              color: 'var(--skipo-accent-contrast, #38bdf8)',
              border: '1px solid var(--skipo-border-subtle, #334155)',
            }}
          >
            WS: {activeWorkspace.name}
          </span>
        )}
      </div>

      {/* Center: Dynamic Hover Inspection Only (Law L9 Exclusivity) */}
      <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
        <div
          data-testid="bottom-strip-center"
          className="flex items-center gap-1.5 truncate transition-all duration-150"
        >
          {showDescription && (
            <span
              className="px-1 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: 'var(--skipo-status-warning, #f59e0b)',
                color: '#000',
              }}
            >
              D-INSPECT
            </span>
          )}
          <span
            className={`truncate ${showDescription ? 'text-[11px] font-light italic' : 'text-xs font-medium'}`}
            style={{
              color: hoverLabel || showDescription
                ? 'var(--skipo-text-primary, #f8fafc)'
                : 'var(--skipo-text-muted, #64748b)',
            }}
          >
            {displayText}
          </span>
        </div>
      </div>

      {/* Right: API Indicators & Queue Status */}
      <div className="flex items-center gap-3 shrink-0">
        {activeApiCount > 0 && (
          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--skipo-accent-contrast, #38bdf8)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            API: {activeApiCount} req
          </span>
        )}
        <span
          className="px-1.5 py-0.5 text-[9px] rounded uppercase font-semibold"
          style={{
            backgroundColor: 'var(--skipo-bg-subtle, #1e293b)',
            border: '1px solid var(--skipo-border-subtle, #334155)',
            color: 'var(--skipo-text-muted, #94a3b8)',
          }}
        >
          SKIPO CORE
        </span>
      </div>
    </footer>
  );
};
