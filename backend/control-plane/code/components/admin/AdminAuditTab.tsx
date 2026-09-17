'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Copy, Check, Download, Search, Filter } from 'lucide-react';
import { IconOnlyButton } from '../IconOnlyButton';
import { BrutalistInput } from '../BrutalistUi';
import { AdminAuditLog } from '@/lib/audit-logger';
import AdminAuditTable from './AdminAuditTable';

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
      const res = await fetch('/api/admin/audit', { headers: { Authorization: `Bearer ${userToken}` } });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
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
    if (actionFilter === 'AUTH') return log.action.includes('AUTH') || log.action.includes('LOGIN') || log.action.includes('REGISTER');
    if (actionFilter === 'CLUSTER') return log.action.includes('CLUSTER') || log.action.includes('DATABASE') || log.action.includes('SYNC');
    if (actionFilter === 'SECURITY') return log.action.includes('FAIL') || log.action.includes('DENIED') || log.action.includes('WARNING') || log.action.includes('ERROR');
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
    const content = format === 'json' ? JSON.stringify(filteredLogs, null, 2) : filteredLogs.map((l) => `[${new Date(l.timestamp).toISOString()}] [${l.action}] [Actor: ${l.actor_user_id || 'system'}] - ${l.details || l.action}`).join('\n');
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
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-2 border-[#D4AF37] bg-[#1A1813]">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-[#D4AF37]" />
          <h2 className="text-xs font-black uppercase text-[#F3EDE0] tracking-wider">SECURITY AUDIT LOGS</h2>
          <span className="text-[10px] px-1.5 py-0.5 bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 font-bold">{filteredLogs.length} Events</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => handleCopyAll('text')} disabled={filteredLogs.length === 0} className="flex items-center gap-1 text-[10px] px-2 py-1 border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors">
            {copiedAllType === 'text' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />} <span>Copy TXT</span>
          </button>
          <button type="button" onClick={() => handleCopyAll('json')} disabled={filteredLogs.length === 0} className="flex items-center gap-1 text-[10px] px-2 py-1 border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors">
            {copiedAllType === 'json' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />} <span>Copy JSON</span>
          </button>
          <button type="button" onClick={handleDownloadLogs} disabled={filteredLogs.length === 0} className="flex items-center gap-1 text-[10px] px-2 py-1 bg-[#D4AF37] text-black hover:bg-[#c5a059] transition-colors">
            <Download size={11} /> <span>Download</span>
          </button>
          <IconOnlyButton icon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />} tooltip="Refresh Audit Logs" disabled={loading} onClick={fetchAuditLogs} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-2 p-2 border-2 border-neutral-800 bg-[#121116]">
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-2.5 top-2.5 text-neutral-500" />
          <BrutalistInput value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search audit logs by action, IP, or user..." className="pl-8 text-xs py-1" />
        </div>
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <Filter size={14} className="text-neutral-500 shrink-0" />
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="p-1.5 bg-[#17161D] border border-neutral-700 text-xs text-[#F3EDE0] font-mono focus:outline-none w-full sm:w-36">
            <option value="ALL">All Actions</option>
            <option value="AUTH">Auth / Login</option>
            <option value="CLUSTER">Cluster / DB</option>
            <option value="SECURITY">Security Alert</option>
          </select>
        </div>
      </div>

      {error && <div className="p-2 border-2 border-red-500 bg-red-950/60 text-red-300 text-xs">{error}</div>}

      <AdminAuditTable logs={filteredLogs} loading={loading} copiedId={copiedId} onCopyEntry={handleCopyEntry} />
    </div>
  );
}
