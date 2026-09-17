'use client';

import React from 'react';
import { Terminal, Shield, Clock, Copy, Check, ShieldAlert } from 'lucide-react';
import { AdminAuditLog } from '@/lib/audit-logger';

interface AdminAuditTableProps {
  logs: AdminAuditLog[];
  loading: boolean;
  copiedId: string | null;
  onCopyEntry: (log: AdminAuditLog) => void;
}

export default function AdminAuditTable({ logs, loading, copiedId, onCopyEntry }: AdminAuditTableProps) {
  if (loading) {
    return (
      <div className="p-8 border-2 border-neutral-800 bg-[#0E0D10] text-center text-xs text-[#D4AF37] animate-pulse">
        Fetching security audit event telemetry...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-8 border-2 border-neutral-800 bg-[#0E0D10] text-center space-y-1">
        <ShieldAlert size={24} className="mx-auto text-neutral-600 mb-2" />
        <div className="text-xs font-black uppercase text-[#F3EDE0]/60">NO AUDIT EVENTS FOUND</div>
        <div className="text-[10px] text-neutral-500">Audit telemetry will appear here as administrative actions occur.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const isSecurityAlert =
          log.action.includes('FAIL') ||
          log.action.includes('DENIED') ||
          log.action.includes('WARNING') ||
          log.action.includes('ERROR');

        return (
          <div
            key={log.id}
            className={`p-2.5 border transition-all text-xs ${
              isSecurityAlert ? 'border-red-500/50 bg-red-950/20 text-red-200' : 'border-neutral-800 bg-[#0E0D10] text-[#F3EDE0]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase ${isSecurityAlert ? 'bg-red-500 text-black' : 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'}`}>
                  {log.action}
                </span>
                <span className="text-[10px] text-neutral-400 flex items-center gap-1 font-mono">
                  <Clock size={11} /> {new Date(log.timestamp).toLocaleString()}
                </span>
                {log.actor_user_id && (
                  <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                    <Shield size={11} className="text-[#D4AF37]" /> Actor: {log.actor_user_id}
                  </span>
                )}
                {log.ip_address && (
                  <span className="text-[10px] text-neutral-500 font-mono">IP: {log.ip_address}</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => onCopyEntry(log)}
                className="text-neutral-500 hover:text-[#D4AF37] p-1 transition-colors shrink-0"
                title="Copy log entry"
              >
                {copiedId === log.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>

            {log.details && (
              <div className="mt-1.5 text-[11px] font-mono text-neutral-300 break-all bg-black/40 p-1.5 border border-neutral-900">
                {log.details}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
