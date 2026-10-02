// ══════════════════════════════════════════════════════════════════════════════
// SKIPO CANONICAL NODE CARD COMPONENT (Aspect 10 & Law L26 Compliance)
// Features: Handles, status badges, minimized/expanded view, BottomStrip hover
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CustomNodeData } from './types';
import { useBottomStrip } from '../../../libraries/skipo/ui/components/bottom-strip/BottomStripContext';

export const NodeCard: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as CustomNodeData;
  const label = nodeData?.label || 'Node';
  const type = nodeData?.type || 'PROCESSOR';
  const status = nodeData?.status || 'READY';
  const [isMinimized, setIsMinimized] = useState(false);
  const { setInspectionText } = useBottomStrip();

  const statusColors: Record<string, string> = {
    READY: 'var(--skipo-status-online, #10b981)',
    ACTIVE: 'var(--skipo-accent-contrast, #38bdf8)',
    ERROR: 'var(--skipo-status-error, #ef4444)',
    STANDBY: 'var(--skipo-text-muted, #64748b)',
  };

  const toggleMinimize = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsMinimized(prev => !prev);
  };

  return (
    <div
      onMouseEnter={() => setInspectionText(type, `System: ${type} • Title: ${label} | State: ${status}`)}
      onMouseLeave={() => setInspectionText(null)}
      onDoubleClick={toggleMinimize}
      className="rounded-lg select-none transition-all shadow-md relative"
      style={{
        backgroundColor: 'var(--skipo-bg-panel, #0f172a)',
        border: selected
          ? '2px solid var(--skipo-accent-contrast, #38bdf8)'
          : '1px solid var(--skipo-border-subtle, #334155)',
        boxShadow: selected ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none',
        minWidth: isMinimized ? '160px' : '200px',
        padding: isMinimized ? '6px 8px' : '12px'
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 rounded-full border-2"
        style={{
          backgroundColor: 'var(--skipo-accent-contrast, #38bdf8)',
          borderColor: 'var(--skipo-bg-panel, #0f172a)',
        }}
      />

      {isMinimized ? (
        /* Minimized View: Exactly 1/3 Icon + 2/3 Title (Law L26) */
        <div className="flex items-center w-full gap-2">
          <div
            className="w-1/3 flex items-center justify-center border-r border-slate-700/60 pr-2 cursor-pointer"
            onClick={toggleMinimize}
          >
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider truncate"
              style={{
                backgroundColor: 'var(--skipo-bg-subtle, #1e293b)',
                color: 'var(--skipo-accent-contrast, #38bdf8)',
              }}
            >
              {type.slice(0, 4)}
            </span>
          </div>
          <div className="w-2/3 truncate text-xs font-semibold" style={{ color: 'var(--skipo-text-primary, #f8fafc)' }}>
            {label}
          </div>
        </div>
      ) : (
        /* Expanded View */
        <>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{
                backgroundColor: 'var(--skipo-bg-subtle, #1e293b)',
                color: 'var(--skipo-accent-contrast, #38bdf8)',
                border: '1px solid var(--skipo-border-subtle, #334155)',
              }}
            >
              {type}
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: statusColors[status] || statusColors.STANDBY }}
              />
              <span className="text-[10px] font-mono text-slate-400">{status}</span>
              <button
                type="button"
                onClick={toggleMinimize}
                title="Minimize Node"
                className="ml-1 text-xs text-slate-400 hover:text-white px-1"
              >
                −
              </button>
            </div>
          </div>
          <div className="text-sm font-semibold truncate" style={{ color: 'var(--skipo-text-primary, #f8fafc)' }}>
            {label}
          </div>
        </>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 rounded-full border-2"
        style={{
          backgroundColor: 'var(--skipo-status-online, #10b981)',
          borderColor: 'var(--skipo-bg-panel, #0f172a)',
        }}
      />
    </div>
  );
};
