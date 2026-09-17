'use client';

import React, { useState } from 'react';
import { Database, Plus, RefreshCw, Zap } from 'lucide-react';
import { IconOnlyButton } from '../IconOnlyButton';
import { DatabaseConnectionEntry, AdminDatabaseClusterConfig } from '@/lib/control-plane-types';
import AdminDatabaseItemCard from './AdminDatabaseItemCard';
import AdminVercelEnvModal from './AdminVercelEnvModal';
import AdminAddDatabaseForm from './AdminAddDatabaseForm';

interface AdminDatabaseClusterTabProps {
  cluster: AdminDatabaseClusterConfig;
  userToken: string | null;
  onRefresh: () => Promise<void>;
}

export default function AdminDatabaseClusterTab({ cluster, userToken, onRefresh }: AdminDatabaseClusterTabProps) {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEnvDb, setSelectedEnvDb] = useState<DatabaseConnectionEntry | null>(null);

  const [formerPrimaryId, setFormerPrimaryId] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('docustack_former_primary_id') : null;
  });
  const [primarySwitchTime] = useState<number>(() => {
    return typeof window !== 'undefined' ? parseInt(localStorage.getItem('docustack_primary_switch_time') || '0', 10) : 0;
  });
  const [lastSyncCompletedTime, setLastSyncCompletedTime] = useState<number>(() => {
    return typeof window !== 'undefined' ? parseInt(localStorage.getItem('docustack_last_sync_time') || '0', 10) : 0;
  });

  const sendClusterAction = async (action: string, payload: Record<string, any> = {}) => {
    if (!userToken) return null;
    const res = await fetch('/api/admin/backend', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  };

  const handleTestEntry = async (entry: DatabaseConnectionEntry) => {
    setTestingId(entry.id);
    setStatusMsg(null);
    try {
      const data = await sendClusterAction('test_entry', { entry });
      if (!data?.success) throw new Error(data?.error || data?.message || 'Connection failed');
      setStatusMsg({ type: 'success', text: `[${entry.name}] Verified: ${data.message} (${data.latencyMs}ms)` });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `[${entry.name}] Error: ${err.message}` });
    } finally {
      setTestingId(null);
    }
  };

  const handleSetPrimary = async (entry: DatabaseConnectionEntry) => {
    if (!confirm(`Switch primary database to [${entry.name}]? All reads/writes will route here.`)) return;
    try {
      const currentPrimary = cluster.databases.find((d) => d.role === 'primary');
      if (currentPrimary) {
        setFormerPrimaryId(currentPrimary.id);
        localStorage.setItem('docustack_former_primary_id', currentPrimary.id);
        localStorage.setItem('docustack_primary_switch_time', Date.now().toString());
      }
      const data = await sendClusterAction('set_primary', { id: entry.id });
      if (!data?.success) throw new Error(data?.error || 'Failed to switch primary');
      setStatusMsg({ type: 'success', text: `Primary switched to [${entry.name}].` });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleToggleEnable = async (entry: DatabaseConnectionEntry) => {
    try {
      const data = await sendClusterAction('update_entry', { id: entry.id, entry: { ...entry, enabled: !entry.enabled } });
      if (!data?.success) throw new Error(data?.error || 'Failed to toggle');
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete database [${name}] from cluster?`)) return;
    try {
      const data = await sendClusterAction('delete_entry', { id });
      if (!data?.success) throw new Error(data?.error || 'Failed to delete');
      setStatusMsg({ type: 'success', text: `Deleted [${name}] from cluster.` });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    try {
      const data = await sendClusterAction('test_all_cluster');
      setStatusMsg({ type: 'success', text: data?.message || 'Cluster health verified.' });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setTestingAll(false);
    }
  };

  const handleSyncRedundancy = async () => {
    setSyncing(true);
    try {
      const data = await sendClusterAction('sync_redundancy');
      setStatusMsg({ type: 'success', text: data?.message || 'Cluster sync complete.' });
      const now = Date.now();
      setLastSyncCompletedTime(now);
      localStorage.setItem('docustack_last_sync_time', now.toString());
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleAddDatabase = async (newEntry: Partial<DatabaseConnectionEntry>) => {
    try {
      const data = await sendClusterAction('add_entry', { entry: newEntry });
      if (!data?.success) throw new Error(data?.error || 'Failed to add database');
      setShowAddForm(false);
      setStatusMsg({ type: 'success', text: `Registered [${newEntry.name}] in cluster.` });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-4 font-mono select-none">
      {/* Cluster Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-2 border-[#D4AF37] bg-[#1A1813]">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-[#D4AF37]" />
          <div>
            <h2 className="text-xs font-black uppercase text-[#F3EDE0] tracking-wider">ACCOUNTS & DATABASE CLUSTER</h2>
            <div className="text-[10px] text-[#D4AF37] opacity-80">
              {cluster.databases.length} Connections • {cluster.databases.filter((d) => d.enabled).length} Active Clones
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <IconOnlyButton icon={<RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />} tooltip={syncing ? 'Syncing...' : 'Sync All Clones'} variant="accent" disabled={syncing} onClick={handleSyncRedundancy} />
          <IconOnlyButton icon={<Zap size={16} className={testingAll ? 'animate-spin' : ''} />} tooltip={testingAll ? 'Testing...' : 'Test All Connections'} disabled={testingAll} onClick={handleTestAll} />
          <button type="button" onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase bg-[#D4AF37] text-black hover:bg-[#c5a059] transition-colors cursor-pointer">
            <Plus size={14} /> <span>{showAddForm ? 'CLOSE' : 'REGISTER REPLICA'}</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-2.5 text-xs font-bold border-2 ${statusMsg.type === 'success' ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' : 'bg-red-950/60 border-red-500 text-red-300'}`}>
          {statusMsg.text}
        </div>
      )}

      {showAddForm && <AdminAddDatabaseForm onAdd={handleAddDatabase} onCancel={() => setShowAddForm(false)} userToken={userToken} />}

      {/* Database Pool List */}
      <div className="space-y-3">
        {cluster.databases.map((db) => {
          const isLocked = db.id === formerPrimaryId && lastSyncCompletedTime < primarySwitchTime;
          return (
            <AdminDatabaseItemCard
              key={db.id}
              db={db}
              isTesting={testingId === db.id}
              isLockedFormerPrimary={isLocked}
              onTest={handleTestEntry}
              onSetPrimary={handleSetPrimary}
              onToggleEnable={handleToggleEnable}
              onDelete={handleDelete}
              onOpenEnvModal={setSelectedEnvDb}
              onBlockedDelete={(d) => setStatusMsg({ type: 'error', text: `Deletion blocked: [${d.name}] was former primary. Sync cluster first.` })}
            />
          );
        })}
      </div>

      {selectedEnvDb && <AdminVercelEnvModal db={selectedEnvDb} onClose={() => setSelectedEnvDb(null)} />}
    </div>
  );
}
