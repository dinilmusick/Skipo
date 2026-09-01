'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  RefreshCw,
  Terminal,
  Activity,
  Clock,
  Shield,
  Copy,
  Check,
  Download,
  Search,
  Filter,
  FileCode,
  FileText,
} from 'lucide-react';
import { IconOnlyButton } from '../IconOnlyButton';
import { BrutalistInput } from '../BrutalistUi';
import { AdminAuditLog } from '@/lib/audit-logger';

interface AdminAuditTabProps {
  userToken: string | null;
}

export default function AdminAuditTab({ userToken }: AdminAuditTabProps) {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAllType, setCopiedAllType] = useState<'text' | 'json' | null>(null);

  const fetchAuditLogs = async () => {
    if (!userToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/audit', {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Invalid response (Status ${res.status}).`);
      }
      if (!data.success) throw new Error(data.error || 'Failed to fetch audit logs');
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || 'Error loading audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [userToken]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchQuery.trim() ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.actor_user_id && log.actor_user_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (actionFilter === 'AUTH') {
      return log.action.includes('AUTH') || log.action.includes('LOGIN') || log.action.includes('REGISTER');
    }
    if (actionFilter === 'CLUSTER') {
      return log.action.includes('CLUSTER') || log.action.includes('DATABASE') || log.action.includes('SYNC');
    }
    if (actionFilter === 'SECURITY') {
      return log.action.includes('FAIL') || log.action.includes('DENIED') || log.action.includes('WARNING') || log.action.includes('ERROR');
    }
    return true;
  });

  const handleCopyEntry = (log: AdminAuditLog) => {
    const text = `[${new Date(log.timestamp).toISOString()}] [${log.action}] [Actor: ${log.actor_user_id || 'system'}] [IP: ${log.ip_address || 'unknown'}] - ${log.details || log.action}`;
    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = (format: 'text' | 'json') => {
    if (filteredLogs.length === 0) return;
    let content = '';
    if (format === 'json') {
      content = JSON.stringify(filteredLogs, null, 2);
    } else {
      content = filteredLogs
        .map(
          (l) =>
            `[${new Date(l.timestamp).toISOString()}] [${l.action}] [Actor: ${l.actor_user_id || 'system'}] [IP: ${l.ip_address || 'unknown'}] - ${l.details || l.action}`
        )
        .join('\n');
    }
    navigator.clipboard.writeText(content);
    setCopiedAllType(format);
    setTimeout(() => setCopiedAllType(null), 2000);
  };

  const handleDownloadLogs = () => {
    if (filteredLogs.length === 0) return;
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docustack_audit_logs_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 font-mono select-none">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-2 border-[#D4AF37] bg-[#1A1813]">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-[#D4AF37]" />
          <h2 className="text-xs font-black uppercase text-[#F3EDE0] tracking-wider">
            SECURITY & ADMIN AUDIT LOGS
          </h2>
          <span className="text-[10px] px-1.5 py-0.5 bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 font-bold">
            {filteredLogs.length} Events
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopyAll('text')}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1 text-[10px] px-2 py-1 border border-[#D4AF37] bg-[#16151B] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black font-black uppercase transition-all disabled:opacity-40 cursor-pointer"
            title="Copy all logs as plain text"
          >
            {copiedAllType === 'text' ? <Check size={12} className="text-emerald-400" /> : <FileText size={12} />}
            <span>{copiedAllType === 'text' ? 'Copied Text!' : 'Copy Text'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopyAll('json')}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1 text-[10px] px-2 py-1 border border-[#D4AF37] bg-[#16151B] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black font-black uppercase transition-all disabled:opacity-40 cursor-pointer"
            title="Copy all logs as JSON payload"
          >
            {copiedAllType === 'json' ? <Check size={12} className="text-emerald-400" /> : <FileCode size={12} />}
            <span>{copiedAllType === 'json' ? 'Copied JSON!' : 'Copy JSON'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadLogs}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1 text-[10px] px-2 py-1 border border-[#D4AF37]/60 bg-[#16151B] text-[#F3EDE0] hover:border-[#D4AF37] hover:text-[#D4AF37] font-bold uppercase transition-all disabled:opacity-40 cursor-pointer"
            title="Download audit logs as JSON file"
          >
            <Download size={12} />
            <span className="hidden sm:inline">Export</span>
          </button>

          <IconOnlyButton
            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            tooltip="Refresh Security Audit Logs"
            disabled={loading}
            onClick={fetchAuditLogs}
          />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2 p-2 border border-[#D4AF37]/40 bg-[#141318]">
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#D4AF37]/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action, details, actor user ID, IP address..."
            className="w-full bg-[#0E0D12] border border-[#D4AF37]/30 text-xs text-[#F3EDE0] pl-8 pr-3 py-1.5 focus:border-[#D4AF37] focus:outline-none placeholder-[#F3EDE0]/40"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[10px] text-[#D4AF37] uppercase font-bold mr-1 flex items-center gap-1">
            <Filter size={10} /> Filter:
          </span>
          {['ALL', 'AUTH', 'CLUSTER', 'SECURITY'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActionFilter(cat)}
              className={`text-[10px] px-2 py-1 uppercase font-bold border transition-colors cursor-pointer ${
                actionFilter === cat
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-[#18171F] text-[#F3EDE0]/70 border-[#D4AF37]/30 hover:border-[#D4AF37]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/15 border-2 border-red-500 text-red-400 text-xs font-bold">
          {error}
        </div>
      )}

      {/* Audit Log Entries List */}
      <div className="border-2 border-[#D4AF37]/50 bg-[#121115] overflow-hidden">
        <div className="max-h-[520px] overflow-y-auto p-2 space-y-1.5">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs opacity-60 font-bold uppercase">
              {searchQuery || actionFilter !== 'ALL' ? 'NO MATCHING AUDIT EVENTS FOUND.' : 'NO AUDIT EVENTS RECORDED YET.'}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="group p-2.5 bg-[#18171F] border border-[#D4AF37]/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-[#D4AF37] transition-all"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-black uppercase shrink-0 mt-0.5 ${
                      log.action.includes('FAIL') || log.action.includes('ERROR') || log.action.includes('DENIED')
                        ? 'bg-red-500 text-black'
                        : log.action.includes('SUCCESS') || log.action.includes('PROMOTION')
                        ? 'bg-emerald-500 text-black'
                        : 'bg-[#D4AF37] text-black'
                    }`}
                  >
                    {log.action}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-[#F3EDE0] break-words">{log.details || log.action}</div>
                    <div className="text-[10px] opacity-60 pt-0.5">
                      Actor: <span className="text-[#D4AF37] font-semibold">{log.actor_user_id}</span> • IP: <span className="font-mono">{log.ip_address || '127.0.0.1'}</span> {log.target_type ? `• Target: [${log.target_type}]` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#D4AF37]/10">
                  <div className="text-[10px] opacity-60 flex items-center gap-1 text-[#D4AF37]">
                    <Clock size={11} />
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyEntry(log)}
                    className="p-1 border border-[#D4AF37]/40 bg-[#0E0D12] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors cursor-pointer"
                    title={copiedId === log.id ? 'Copied to clipboard!' : 'Copy audit log entry'}
                  >
                    {copiedId === log.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
