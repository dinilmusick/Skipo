// ══════════════════════════════════════════════════════════════════════════════
// SKIPO CANONICAL NODE CARD COMPONENT (Aspect 10 Compliance)
// Features: Handles, status badges, Neo-Brutalist border, BottomStrip hover tags
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CustomNodeData } from './types';

export const NodeCard: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as CustomNodeData;
  const label = nodeData?.label || 'Node';
  const type = nodeData?.type || 'PROCESSOR';
  const status = nodeData?.status || 'READY';

  const statusColors: Record<string, string> = {
    READY: 'var(--skipo-status-online, #10b981)',
    ACTIVE: 'var(--skipo-accent-contrast, #38bdf8)',
    ERROR: 'var(--skipo-status-error, #ef4444)',
    STANDBY: 'var(--skipo-text-muted, #64748b)',
  };

  return (
    <div
      data-skipo-label={label}
      data-skipo-desc={`[${type}] Node: ${label} | State: ${status}`}
      className="rounded-lg p-3 min-w-[200px] select-none transition-all shadow-md"
      style={{
        backgroundColor: 'var(--skipo-bg-panel, #0f172a)',
        border: selected
          ? '2px solid var(--skipo-accent-contrast, #38bdf8)'
          : '1px solid var(--skipo-border-subtle, #334155)',
        boxShadow: selected ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none',
      }}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 rounded-full border-2"
        style={{
          backgroundColor: 'var(--skipo-accent-contrast, #38bdf8)',
          borderColor: 'var(--skipo-bg-panel, #0f172a)',
        }}
      />

      {/* Header */}
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
        </div>
      </div>

      {/* Content */}
      <div className="text-sm font-semibold truncate" style={{ color: 'var(--skipo-text-primary, #f8fafc)' }}>
        {label}
      </div>

      {/* Output Handle */}
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
