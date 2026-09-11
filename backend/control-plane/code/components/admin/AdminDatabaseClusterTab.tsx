'use client';

import React, { useState } from 'react';
import {
  Database,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Copy,
  Zap,
  Activity,
  HardDrive,
  Cpu,
  Server,
  Layers,
  ShieldCheck,
  Clock,
  ArrowRight,
  Eye,
  EyeOff,
  Flame,
  FileCode,
  Key,
  Check,
  ExternalLink,
  X,
} from 'lucide-react';
import { BrutalistButton, BrutalistCard } from '../BrutalistUi';
import { IconOnlyButton } from '../IconOnlyButton';
import {
  DatabaseConnectionEntry,
  AdminDatabaseClusterConfig,
  AdminBackendEngine,
  DataEngineType,
  DatabaseRole,
  DatabaseTargetScope,
} from '@/lib/control-plane-types';

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

  // Vercel .env Deployment Blueprint Modal State
  const [selectedEnvDb, setSelectedEnvDb] = useState<DatabaseConnectionEntry | null>(null);
  const [copiedKeyName, setCopiedKeyName] = useState<string | null>(null);
  const [copiedAllSnippet, setCopiedAllSnippet] = useState(false);

  // Track primary switch states & last completed cluster sync to avoid accidental deletion of former primary DBs
  const [formerPrimaryId, setFormerPrimaryId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('docustack_former_primary_id');
    }
    return null;
  });

  const [primarySwitchTime, setPrimarySwitchTime] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('docustack_primary_switch_time');
      return stored ? parseInt(stored, 10) : 0;
    }
    return 0;
  });

  const [lastSyncCompletedTime, setLastSyncCompletedTime] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('docustack_last_sync_time');
      return stored ? parseInt(stored, 10) : 0;
    }
    return 0;
  });

  // New DB Form State
  const [newName, setNewName] = useState('');
  const [newEngine, setNewEngine] = useState<AdminBackendEngine>('neon');
  const [newRole, setNewRole] = useState<DatabaseRole>('redundant_clone');
  const [newTarget, setNewTarget] = useState<DatabaseTargetScope>('all');
  const [walMode, setWalMode] = useState(true);
  const [pgHost, setPgHost] = useState('localhost');
  const [pgPort, setPgPort] = useState(5432);
  const [pgDatabase, setPgDatabase] = useState('docustack_accounts_clone');
  const [pgUser, setPgUser] = useState('docustack_admin');
  const [pgPassword, setPgPassword] = useState('');
  const [pgSsl, setPgSsl] = useState(true);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseConnStr, setSupabaseConnStr] = useState('');
  const [supabaseTableName, setSupabaseTableName] = useState('users');
  const [neonConnStr, setNeonConnStr] = useState('');
  const [neonTableName, setNeonTableName] = useState('ultrst-users');
  const [provisioningNeon, setProvisioningNeon] = useState(false);
  const [firebaseProjectId, setFirebaseProjectId] = useState('');
  const [firebaseApiKey, setFirebaseApiKey] = useState('');
  const [firebaseCollection, setFirebaseCollection] = useState('ultrst-users');
  const [showFirebaseKey, setShowFirebaseKey] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteKey, setRemoteKey] = useState('');
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [showSupabaseAnonKey, setShowSupabaseAnonKey] = useState(false);
  const [copiedClusterSchema, setCopiedClusterSchema] = useState(false);

  const handleAutoProvisionNeon = async () => {
    if (!neonConnStr.trim()) {
      setStatusMsg({ type: 'error', text: 'Neon Connection String is required for auto-provisioning.' });
      return;
    }
    setProvisioningNeon(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/admin/backend', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'provision_table',
          engine: 'neon',
          connectionString: neonConnStr.trim(),
          tableName: neonTableName.trim() || 'ultrst-users',
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Provisioning failed');
      setStatusMsg({ type: 'success', text: data.message || 'Table provisioned successfully in Neon!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setProvisioningNeon(false);
    }
  };

  const handleTestEntry = async (entry: DatabaseConnectionEntry) => {
    if (!userToken) return;
    setTestingId(entry.id);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/admin/backend', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_entry', entry }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!data.success) throw new Error(data.error || data.message || 'Connection failed');
      setStatusMsg({ type: 'success', text: `[${entry.name}] Verified: ${data.message} (${data.latencyMs}ms)` });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `[${entry.name}] Error: ${err.message}` });
    } finally {
      setTestingId(null);
    }
  };

  const handleTestAll = async () => {
    if (!userToken) return;
    setTestingAll(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/admin/backend', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_cluster' }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!data.success) throw new Error(data.error || data.message || 'Cluster test failed');
      setStatusMsg({ type: 'success', text: data.message });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setTestingAll(false);
    }
  };

  const handleSyncRedundancy = async () => {
    if (!userToken) return;
    setSyncing(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/admin/backend', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_redundancy' }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!data.success) throw new Error(data.error || data.message || 'Redundancy sync failed');
      
      const now = Date.now();
      setLastSyncCompletedTime(now);
      localStorage.setItem('docustack_last_sync_time', String(now));

      setStatusMsg({ type: 'success', text: data.message });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleEnable = async (db: DatabaseConnectionEntry) => {
    if (!userToken) return;
    try {
      await fetch('/api/admin/backend', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_database', id: db.id, updates: { enabled: !db.enabled } }),
      });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleSetPrimary = async (db: DatabaseConnectionEntry) => {
    if (!userToken) return;
    try {
      // Find the current primary database prior to this switch
      const currentPrimary = cluster.databases.find((d) => d.role === 'primary');
      const currentPrimaryId = currentPrimary?.id || null;

      await fetch('/api/admin/backend', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_database', id: db.id, updates: { role: 'primary', enabled: true } }),
      });

      if (currentPrimaryId) {
        setFormerPrimaryId(currentPrimaryId);
        localStorage.setItem('docustack_former_primary_id', currentPrimaryId);
        const now = Date.now();
        setPrimarySwitchTime(now);
        localStorage.setItem('docustack_primary_switch_time', String(now));
      }

      setStatusMsg({
        type: 'success',
        text: `Database [${db.name}] elevated to Primary Storage. To delete the previous primary database, make sure you run a replica sync first.`,
      });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!userToken) return;

    // Accidental deletion check: Is this the former primary database, and has it been synced with the new primary since the switch?
    if (id === formerPrimaryId && lastSyncCompletedTime < primarySwitchTime) {
      setStatusMsg({
        type: 'error',
        text: `Accidental Deletion Blocked: Database [${name}] was the primary database before the recent switch. To prevent permanent accounts data loss, you must click "Sync & Replicate Clones Now" (the sync icon in the top right of this panel) to ensure all user objects are fully synchronized with the new primary database before this can be deleted.`,
      });
      return;
    }

    if (!confirm(`Are you absolutely sure you want to permanently delete database entry [${name}] from the accounts redundancy cluster? This action is irreversible.`)) return;

    try {
      const res = await fetch(`/api/admin/backend?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!data.success) throw new Error(data.error || 'Failed to delete database');
      
      setStatusMsg({ type: 'success', text: `Database [${name}] removed from redundancy cluster.` });
      
      // Clear former primary state if deleted
      if (id === formerPrimaryId) {
        setFormerPrimaryId(null);
        localStorage.removeItem('docustack_former_primary_id');
      }

      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleAddDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToken) return;
    try {
      const entryPayload: any = {
        name: newName.trim() || `${newEngine.toUpperCase()} Storage`,
        engine: newEngine,
        role: newRole,
        target: newTarget,
        enabled: true,
      };

      if (newEngine === 'postgres') {
        entryPayload.postgres = {
          host: pgHost.trim(),
          port: Number(pgPort),
          database: pgDatabase.trim(),
          user: pgUser.trim(),
          password: pgPassword,
          ssl: pgSsl,
        };
      } else if (newEngine === 'supabase') {
        entryPayload.supabase = {
          url: supabaseUrl.trim(),
          serviceRoleKey: supabaseKey.trim(),
          anonKey: supabaseAnonKey.trim(),
          connectionString: supabaseConnStr.trim(),
          tableName: supabaseTableName.trim() || 'users',
        };
      } else if (newEngine === 'neon') {
        entryPayload.neon = {
          connectionString: neonConnStr.trim(),
          tableName: neonTableName.trim() || 'ultrst-users',
        };
      } else if (newEngine === 'firebase') {
        entryPayload.firebase = {
          projectId: firebaseProjectId.trim(),
          apiKey: firebaseApiKey.trim(),
          collectionName: firebaseCollection.trim() || 'ultrst-users',
        };
      } else if (newEngine === 'remote_auth') {
        entryPayload.remote_auth = { endpointUrl: remoteUrl.trim(), apiKey: remoteKey.trim() };
      }

      const res = await fetch('/api/admin/backend', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_database', entry: entryPayload }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!data.success) throw new Error(data.error || 'Failed to add database');

      setStatusMsg({ type: 'success', text: `Database [${entryPayload.name}] successfully added!` });
      setShowAddForm(false);
      setNewName('');
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const getEngineIcon = (engine: AdminBackendEngine | DataEngineType | string) => {
    switch (engine) {
      case 'sqlite': return <HardDrive size={18} className="text-[#D4AF37]" />;
      case 'postgres': return <Database size={18} className="text-[#D4AF37]" />;
      case 'supabase': return <Cpu size={18} className="text-[#D4AF37]" />;
      case 'neon': return <Zap size={18} className="text-[#00E599]" />;
      case 'firebase': return <Flame size={18} className="text-[#FFCA28]" />;
      case 'remote_auth': return <Server size={18} className="text-[#D4AF37]" />;
      case 'turso': return <Zap size={18} className="text-[#D4AF37]" />;
      default: return <Database size={18} className="text-[#D4AF37]" />;
    }
  };

  const getVercelEnvSnippet = (db: DatabaseConnectionEntry): { envText: string; keys: Array<{ key: string; val: string; desc: string }> } => {
    const keys: Array<{ key: string; val: string; desc: string }> = [];

    if (db.engine === 'neon') {
      const isPrimary = db.role === 'primary';
      const keyName = isPrimary ? 'NEON_DATABASE_URL' : 'CLONE_NEON_DATABASE_URL';
      const conn = db.neon?.connectionString || '';
      keys.push({
        key: keyName,
        val: conn,
        desc: `${isPrimary ? 'Primary' : 'Redundant Clone'} Neon Serverless PostgreSQL Connection URI (e.g. postgresql://user:pass@ep-xyz.neon.tech/dbname?sslmode=require). Note: DATABASE_URL is also accepted as fallback.`
      });
    } else if (db.engine === 'supabase') {
      const isPrimary = db.role === 'primary';
      const urlKey = isPrimary ? 'SUPABASE_URL' : 'CLONE_SUPABASE_URL';
      const secKey = isPrimary ? 'SUPABASE_SERVICE_ROLE_KEY' : 'CLONE_SUPABASE_SERVICE_ROLE_KEY';
      keys.push({
        key: urlKey,
        val: db.supabase?.url || '',
        desc: `${isPrimary ? 'Primary' : 'Redundant Clone'} Supabase Project HTTPS URL (e.g. https://xyz.supabase.co)`
      });
      if (db.supabase?.serviceRoleKey) {
        keys.push({
          key: secKey,
          val: db.supabase.serviceRoleKey,
          desc: `${isPrimary ? 'Primary' : 'Redundant Clone'} Supabase Secret Service Role API Key (Bypasses RLS to manage accounts)`
        });
      }
    } else if (db.engine === 'postgres') {
      const isPrimary = db.role === 'primary';
      const keyName = isPrimary ? 'POSTGRES_DATABASE_URL' : 'CLONE_POSTGRES_DATABASE_URL';
      keys.push({
        key: keyName,
        val: db.postgres?.connectionString || '',
        desc: `${isPrimary ? 'Primary' : 'Redundant Clone'} PostgreSQL Connection URI (e.g. postgresql://user:pass@host:5432/dbname). Note: POSTGRES_URL is also accepted.`
      });
    } else if (db.engine === 'firebase') {
      const isPrimary = db.role === 'primary';
      const projKey = isPrimary ? 'FIREBASE_PROJECT_ID' : 'CLONE_FIREBASE_PROJECT_ID';
      const apiKeyKey = isPrimary ? 'FIREBASE_API_KEY' : 'CLONE_FIREBASE_API_KEY';
      keys.push({
        key: projKey,
        val: db.firebase?.projectId || '',
        desc: `${isPrimary ? 'Primary' : 'Redundant Clone'} Google Cloud / Firebase Project ID`
      });
      if (db.firebase?.apiKey) {
        keys.push({
          key: apiKeyKey,
          val: db.firebase.apiKey,
          desc: 'Firebase Web API Key'
        });
      }
    }

    const envText = keys.map((k) => `${k.key}=${k.val}`).join('\n');
    return { envText, keys };
  };

  return (
    <div className="space-y-4 font-mono select-none">
      {/* Cluster Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-2 border-[#D4AF37] bg-[#1A1813]">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-[#D4AF37]" />
          <div>
            <h2 className="text-xs font-black uppercase text-[#F3EDE0] tracking-wider">
              ACCOUNTS & WORKSPACE DATABASE CLUSTER
            </h2>
            <div className="text-[10px] text-[#D4AF37] opacity-80">
              {cluster.databases.length} Redundant Connections • {cluster.databases.filter(d => d.enabled).length} Active Clones
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <IconOnlyButton
            icon={<RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />}
            tooltip={syncing ? 'Synchronizing Cluster...' : 'Sync & Replicate All Clones'}
            variant="accent"
            disabled={syncing}
            onClick={handleSyncRedundancy}
          />

          <IconOnlyButton
            icon={<Activity size={16} className={testingAll ? 'animate-spin' : ''} />}
            tooltip="Test All Database Connections"
            disabled={testingAll}
            onClick={handleTestAll}
          />
          <IconOnlyButton
            icon={<Plus size={16} />}
            tooltip={showAddForm ? 'Close Add Form' : 'Add Redundant Database'}
            active={showAddForm}
            onClick={() => setShowAddForm(!showAddForm)}
          />
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3 border-2 text-xs font-bold ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
              : 'bg-red-500/15 border-red-500 text-red-400'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Add New Database Form (Drawer / Card) */}
      {showAddForm && (
        <form onSubmit={handleAddDatabase} className="p-4 border-2 border-[#D4AF37] bg-[#16151B] space-y-4 shadow-[4px_4px_0px_#D4AF37]">
          <div className="flex items-center justify-between border-b border-[#D4AF37]/40 pb-2">
            <h3 className="text-xs font-black uppercase text-[#F3EDE0] flex items-center gap-1.5">
              <Plus size={14} className="text-[#D4AF37]" /> ADD NEW DATABASE CONNECTION / REDUNDANCY CLONE
            </h3>
            <span className="text-[10px] text-[#D4AF37]">All Engines Supported</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase text-[#D4AF37] mb-1">Database Name / Label</label>
              <input
                type="text"
                required
                placeholder="e.g. Postgres Cloud Replica"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#0F0E12] border-2 border-[#D4AF37]/60 text-xs text-[#F3EDE0] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-[#D4AF37] mb-1">Storage Engine Type</label>
              <select
                value={newEngine}
                onChange={(e) => setNewEngine(e.target.value as AdminBackendEngine)}
                className="w-full px-2.5 py-1.5 bg-[#0F0E12] border-2 border-[#D4AF37]/60 text-xs text-[#F3EDE0] focus:border-[#D4AF37] focus:outline-none"
              >
                <option value="neon">Neon Serverless Postgres (Direct HTTP)</option>
                <option value="supabase">Supabase BaaS Engine</option>
                <option value="postgres">PostgreSQL Relational Storage</option>
                <option value="firebase">Firebase Cloud Firestore (Document BaaS)</option>
                <option value="remote_auth">Remote Auth Service Endpoint</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-[#D4AF37] mb-1">Redundancy Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as DatabaseRole)}
                className="w-full px-2.5 py-1.5 bg-[#0F0E12] border-2 border-[#D4AF37]/60 text-xs text-[#F3EDE0] focus:border-[#D4AF37] focus:outline-none"
              >
                <option value="redundant_clone">Redundant Clone (Auto-Replication)</option>
                <option value="primary">Primary Database (Active Writer)</option>
                <option value="failover_standby">Failover Standby Replica</option>
              </select>
            </div>
          </div>

          {newEngine === 'postgres' && (
            <div className="p-3 bg-[#0E0D11] border border-[#D4AF37]/30 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] text-[#D4AF37]">Host</label>
                <input type="text" value={pgHost} onChange={(e) => setPgHost(e.target.value)} className="w-full p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0]" />
              </div>
              <div>
                <label className="block text-[10px] text-[#D4AF37]">Port</label>
                <input type="number" value={pgPort} onChange={(e) => setPgPort(Number(e.target.value))} className="w-full p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0]" />
              </div>
              <div>
                <label className="block text-[10px] text-[#D4AF37]">Database</label>
                <input type="text" value={pgDatabase} onChange={(e) => setPgDatabase(e.target.value)} className="w-full p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0]" />
              </div>
              <div>
                <label className="block text-[10px] text-[#D4AF37]">User</label>
                <input type="text" value={pgUser} onChange={(e) => setPgUser(e.target.value)} className="w-full p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0]" />
              </div>
            </div>
          )}

          {newEngine === 'supabase' && (
            <div className="p-3 bg-[#0E0D11] border border-[#D4AF37]/30 space-y-3">
              <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-1.5">
                <span className="text-[10px] font-black uppercase text-[#D4AF37]">
                  Supabase User Accounts Database (PostgREST & Pooler)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const targetTable = (supabaseTableName || 'ultrst-users').trim();
                    const isQuoted = targetTable.includes('-') ? `"${targetTable}"` : targetTable;
                    const sql = `-- Ultrst Multi-App Universal User Accounts Table
CREATE TABLE IF NOT EXISTS public.${isQuoted} (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  avatar_glyph TEXT DEFAULT '👤',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  app_profiles JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.${isQuoted} ENABLE ROW LEVEL SECURITY;`;
                    navigator.clipboard.writeText(sql);
                    setCopiedClusterSchema(true);
                    setTimeout(() => setCopiedClusterSchema(false), 2500);
                  }}
                  className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors"
                >
                  <Copy size={10} />
                  <span>{copiedClusterSchema ? 'SQL Copied!' : 'Copy SQL Schema'}</span>
                </button>
              </div>

              <div>
                <label className="block text-[10px] text-[#D4AF37] font-bold">
                  Supabase Project URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="https://abcdefghijklmnopqrst.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#D4AF37] font-bold">
                  Secret API Key (Service Role) <span className="text-red-400">*</span>
                  <span className="text-[9px] text-[#D4AF37]/70 font-normal ml-1">(Bypasses RLS to manage accounts)</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showSupabaseKey ? "text" : "password"}
                    placeholder="sb_secret_... or legacy eyJhbGci..."
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    className="w-full p-1.5 pr-8 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                    className="absolute right-1.5 p-1 text-[#D4AF37] hover:text-[#F3EDE0] focus:outline-none transition-colors cursor-pointer"
                    title={showSupabaseKey ? "Hide key" : "Show key"}
                  >
                    {showSupabaseKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[#D4AF37]">Publishable / Anon Key (Optional)</label>
                  <div className="relative flex items-center">
                    <input
                      type={showSupabaseAnonKey ? "text" : "password"}
                      placeholder="sb_publishable_... or legacy eyJhbGci..."
                      value={supabaseAnonKey}
                      onChange={(e) => setSupabaseAnonKey(e.target.value)}
                      className="w-full p-1.5 pr-8 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSupabaseAnonKey(!showSupabaseAnonKey)}
                      className="absolute right-1.5 p-1 text-[#D4AF37] hover:text-[#F3EDE0] focus:outline-none transition-colors cursor-pointer"
                      title={showSupabaseAnonKey ? "Hide key" : "Show key"}
                    >
                      {showSupabaseAnonKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-[#D4AF37]">User Accounts Table Name</label>
                  <input
                    type="text"
                    placeholder="users"
                    value={supabaseTableName}
                    onChange={(e) => setSupabaseTableName(e.target.value)}
                    className="w-full p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-[#D4AF37]">Postgres / Supavisor Connection String (Optional)</label>
                <input
                  type="text"
                  placeholder="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
                  value={supabaseConnStr}
                  onChange={(e) => setSupabaseConnStr(e.target.value)}
                  className="w-full p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0] focus:outline-none"
                />
              </div>
            </div>
          )}

          {newEngine === 'neon' && (
            <div className="p-3 bg-[#0E0D11] border border-[#00E599]/40 space-y-3">
              <div className="flex items-center justify-between border-b border-[#00E599]/20 pb-1.5">
                <span className="text-[10px] font-black uppercase text-[#00E599] flex items-center gap-1.5">
                  <Zap size={14} /> Neon Serverless Postgres (HTTP Direct & Connectionless)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoProvisionNeon}
                    disabled={provisioningNeon}
                    className="flex items-center gap-1 text-[9px] px-2 py-0.5 border border-[#00E599] bg-[#00E599]/10 text-[#00E599] hover:bg-[#00E599] hover:text-black font-black uppercase transition-colors cursor-pointer"
                  >
                    <Zap size={10} className={provisioningNeon ? 'animate-spin' : ''} />
                    <span>{provisioningNeon ? 'PROVISIONING...' : '⚡ AUTO-PROVISION TABLE'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targetTable = (neonTableName || 'ultrst-users').trim();
                      const isQuoted = targetTable.includes('-') ? `"${targetTable}"` : targetTable;
                      const sql = `-- Ultrst Multi-App Universal User Accounts Table for Neon
CREATE TABLE IF NOT EXISTS public.${isQuoted} (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  avatar_glyph TEXT DEFAULT '👤',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  app_profiles JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.${isQuoted} ENABLE ROW LEVEL SECURITY;`;
                      navigator.clipboard.writeText(sql);
                      setCopiedClusterSchema(true);
                      setTimeout(() => setCopiedClusterSchema(false), 2500);
                    }}
                    className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors"
                  >
                    <Copy size={10} />
                    <span>{copiedClusterSchema ? 'SQL Copied!' : 'Copy SQL'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-[#00E599] font-bold">
                  Neon PostgreSQL Connection String <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require"
                  value={neonConnStr}
                  onChange={(e) => setNeonConnStr(e.target.value)}
                  className="w-full p-1.5 bg-[#141318] border border-[#00E599]/50 text-xs text-[#F3EDE0] focus:outline-none font-mono"
                />
                <span className="text-[9px] text-[#F3EDE0]/60 mt-0.5 block">
                  Direct connectionless SQL over HTTP. No pooled connection limits.
                </span>
              </div>

              <div>
                <label className="block text-[10px] text-[#00E599]">User Accounts Table Name</label>
                <input
                  type="text"
                  placeholder="ultrst-users"
                  value={neonTableName}
                  onChange={(e) => setNeonTableName(e.target.value)}
                  className="w-full p-1.5 bg-[#141318] border border-[#00E599]/50 text-xs text-[#F3EDE0] focus:outline-none font-mono"
                />
              </div>
            </div>
          )}

          {newEngine === 'firebase' && (
            <div className="p-3 bg-[#0E0D11] border border-[#FFCA28]/40 space-y-3">
              <div className="flex items-center justify-between border-b border-[#FFCA28]/20 pb-1.5">
                <span className="text-[10px] font-black uppercase text-[#FFCA28] flex items-center gap-1.5">
                  <Flame size={14} /> Firebase Cloud Firestore (NoSQL Document Store)
                </span>
              </div>

              <div>
                <label className="block text-[10px] text-[#FFCA28] font-bold">
                  Firebase Project ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. docustack-prod-12345"
                  value={firebaseProjectId}
                  onChange={(e) => setFirebaseProjectId(e.target.value)}
                  className="w-full p-1.5 bg-[#141318] border border-[#FFCA28]/50 text-xs text-[#F3EDE0] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#FFCA28] font-bold">
                  Web API Key (Optional / Required if unauthenticated REST rules apply)
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showFirebaseKey ? "text" : "password"}
                    placeholder="AIzaSy..."
                    value={firebaseApiKey}
                    onChange={(e) => setFirebaseApiKey(e.target.value)}
                    className="w-full p-1.5 pr-8 bg-[#141318] border border-[#FFCA28]/50 text-xs text-[#F3EDE0] focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFirebaseKey(!showFirebaseKey)}
                    className="absolute right-1.5 p-1 text-[#FFCA28] hover:text-[#F3EDE0] focus:outline-none transition-colors cursor-pointer"
                    title={showFirebaseKey ? "Hide key" : "Show key"}
                  >
                    {showFirebaseKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-[#FFCA28]">Accounts Firestore Collection Name</label>
                <input
                  type="text"
                  placeholder="ultrst-users"
                  value={firebaseCollection}
                  onChange={(e) => setFirebaseCollection(e.target.value)}
                  className="w-full p-1.5 bg-[#141318] border border-[#FFCA28]/50 text-xs text-[#F3EDE0] focus:outline-none font-mono"
                />
              </div>
            </div>
          )}

          {newEngine === 'remote_auth' && (
            <div className="p-3 bg-[#0E0D11] border border-[#D4AF37]/30 space-y-2">
              <label className="block text-[10px] text-[#D4AF37]">Endpoint URL</label>
              <input type="text" placeholder="https://auth.internal/v1" value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)} className="w-full p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0]" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <BrutalistButton type="button" variant="surface" size="sm" onClick={() => setShowAddForm(false)}>
              CANCEL
            </BrutalistButton>
            <BrutalistButton type="submit" variant="accent" size="sm">
              SAVE DATABASE ENTRY
            </BrutalistButton>
          </div>
        </form>
      )}

      {/* Database Pool List */}
      <div className="space-y-3">
        {cluster.databases.map((db) => (
          <div
            key={db.id}
            className={`p-3 border-2 transition-all ${
              db.role === 'primary'
                ? 'border-[#D4AF37] bg-[#17161D] shadow-[4px_4px_0px_#D4AF37]'
                : db.enabled
                ? 'border-[#D4AF37]/50 bg-[#121116]'
                : 'border-neutral-800 bg-[#0E0D10] opacity-60'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Left Column: Icon & Info */}
              <div className="flex items-start gap-3">
                <div className="p-2 border-2 border-[#D4AF37]/40 bg-[#1A1813] mt-0.5 shrink-0">
                  {getEngineIcon(db.engine)}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase text-[#F3EDE0]">{db.name}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        db.role === 'primary'
                          ? 'bg-[#D4AF37] text-black'
                          : 'bg-[#2A261D] text-[#D4AF37] border border-[#D4AF37]/50'
                      }`}
                    >
                      {db.role.replace('_', ' ')}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        db.status === 'connected' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {db.status} {db.latencyMs ? `(${db.latencyMs}ms)` : ''}
                    </span>

                    {/* .env Provenance Indicator / Badge */}
                    {db.isFromEnv ? (
                      <button
                        type="button"
                        onClick={() => setSelectedEnvDb(db)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/50 cursor-pointer hover:bg-emerald-500/30 transition-colors shadow-[1px_1px_0px_#10b981]"
                        title={`Bound to Vercel / System .env (${db.envVarKey || 'Environment Variables'}). Click to view snippet.`}
                      >
                        <FileCode size={10} className="text-emerald-400" />
                        <span>.ENV PERSISTENT</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedEnvDb(db)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/50 cursor-pointer hover:bg-amber-500 hover:text-black transition-colors shadow-[1px_1px_0px_#f59e0b]"
                        title="Running in runtime memory. Click to get Vercel .env snippet to make permanent across redeployments."
                      >
                        <Zap size={10} className="text-amber-400" />
                        <span>RUNTIME (GET .ENV)</span>
                      </button>
                    )}
                  </div>

                  <div className="text-[10px] text-[#F3EDE0]/70 font-mono">
                    {db.engine === 'sqlite' && `Path: ${db.sqlite?.dbPath} • WAL: ${db.sqlite?.walMode ? 'ON' : 'OFF'}`}
                    {db.engine === 'postgres' && `Host: ${db.postgres?.host || 'localhost'}:${db.postgres?.port || 5432} • DB: ${db.postgres?.database || 'accounts'} • SSL: ${db.postgres?.ssl ? 'ON' : 'OFF'}`}
                    {db.engine === 'supabase' && `URL: ${db.supabase?.url || 'https://supabase.co'} • Table: ${db.supabase?.tableName || 'users'} • Service Role: ${db.supabase?.serviceRoleKey ? 'Configured' : 'Missing'}`}
                    {db.engine === 'neon' && `Serverless Postgres • Table: ${db.neon?.tableName || 'ultrst-users'} • Conn: ${db.neon?.connectionString ? 'Configured' : 'Missing'}`}
                    {db.engine === 'firebase' && `Cloud Firestore • Project: ${db.firebase?.projectId || 'Not set'} • Collection: ${db.firebase?.collectionName || 'ultrst-users'}`}
                    {db.engine === 'remote_auth' && `Endpoint: ${db.remote_auth?.endpointUrl}`}
                  </div>

                  <div className="flex items-center gap-3 text-[9px] text-[#D4AF37] opacity-80 pt-0.5">
                    <span>Cloned Records: {db.recordsCloned ?? 0}</span>
                    <span>•</span>
                    <span>Last Synced: {db.lastSyncedAt ? new Date(db.lastSyncedAt).toLocaleTimeString() : 'Never'}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex flex-row-reverse items-center gap-2 shrink-0 self-end sm:self-center">
                {db.role !== 'primary' && (() => {
                  const isLockedFormerPrimary = db.id === formerPrimaryId && lastSyncCompletedTime < primarySwitchTime;
                  return (
                    <IconOnlyButton
                      icon={<Trash2 size={14} className={isLockedFormerPrimary ? "text-neutral-500" : "text-red-400"} />}
                      tooltip={isLockedFormerPrimary ? "Accidental Deletion Blocked (Sync Required)" : "Delete Database Connection"}
                      className={isLockedFormerPrimary ? "opacity-60 border-dashed border-red-500/50 hover:border-red-500" : ""}
                      onClick={() => {
                        if (isLockedFormerPrimary) {
                          setStatusMsg({
                            type: 'error',
                            text: `Accidental Deletion Blocked: Database [${db.name}] was the primary database before the recent switch. To prevent permanent accounts data loss, you must click "Sync & Replicate Clones Now" (the sync icon in the top right of this panel) to ensure all user objects are fully synchronized with the new primary database before this can be deleted.`,
                          });
                        } else {
                          handleDelete(db.id, db.name);
                        }
                      }}
                    />
                  );
                })()}
                <IconOnlyButton
                  icon={<CheckCircle2 size={14} className={db.enabled ? 'text-[#D4AF37]' : 'text-neutral-600'} />}
                  tooltip={db.enabled ? 'Disable Redundancy Mirror' : 'Enable Redundancy Mirror'}
                  active={db.enabled}
                  onClick={() => handleToggleEnable(db)}
                />
                <IconOnlyButton
                  icon={<FileCode size={14} className={db.isFromEnv ? "text-emerald-400" : "text-amber-400"} />}
                  tooltip={db.isFromEnv ? "View Vercel .env Variables (Active)" : "Get Vercel .env Variables to Make Permanent"}
                  onClick={() => setSelectedEnvDb(db)}
                />
                <IconOnlyButton
                  icon={<Activity size={14} className={testingId === db.id ? 'animate-spin' : ''} />}
                  tooltip={`Test ${db.name} Connection`}
                  disabled={testingId === db.id}
                  onClick={() => handleTestEntry(db)}
                />
                {db.role !== 'primary' && (
                  <IconOnlyButton
                    icon={<Zap size={14} />}
                    tooltip="Set As Primary Database"
                    onClick={() => handleSetPrimary(db)}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Vercel .env Deployment Blueprint Modal */}
      {selectedEnvDb && (() => {
        const { envText, keys } = getVercelEnvSnippet(selectedEnvDb);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in zoom-in-95">
            <BrutalistCard
              variant="surface"
              depth="lg"
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 border-2 border-[#D4AF37] bg-[#141319] shadow-[8px_8px_0px_#D4AF37] font-mono space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#D4AF37]/50">
                <div className="flex items-center gap-2">
                  <FileCode size={20} className="text-[#D4AF37]" />
                  <div>
                    <h3 className="text-sm font-black uppercase text-[#F3EDE0]">
                      VERCEL .ENV DEPLOYMENT BLUEPRINT
                    </h3>
                    <p className="text-[10px] text-[#D4AF37] opacity-80">
                      Configuration for [{selectedEnvDb.name}] ({selectedEnvDb.engine.toUpperCase()})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedEnvDb(null)}
                  className="p-1 border-2 border-[#D4AF37]/60 hover:bg-[#D4AF37] hover:text-black text-[#F3EDE0] text-xs font-black transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status Banner */}
              <div
                className={`p-3 border-2 text-xs flex items-start gap-2.5 ${
                  selectedEnvDb.isFromEnv
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500 text-amber-300'
                }`}
              >
                {selectedEnvDb.isFromEnv ? (
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <Zap size={18} className="shrink-0 text-amber-400 mt-0.5" />
                )}
                <div>
                  <div className="font-black uppercase tracking-wider text-[11px]">
                    {selectedEnvDb.isFromEnv ? 'PERSISTENT ACROSS VERCEL REDEPLOYMENTS' : 'RUNTIME ONLY (NEEDS VERCEL .ENV CONFIG)'}
                  </div>
                  <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                    {selectedEnvDb.isFromEnv
                      ? `This database was auto-detected from environment variable [${selectedEnvDb.envVarKey || 'DATABASE_URL'}]. It will automatically bind on every build and serverless invocation.`
                      : 'This database is currently held in runtime memory. To make it permanent and survive future Vercel git deployments, copy the environment variables below and add them to your Vercel Project Settings.'}
                  </p>
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="p-3 bg-[#0F0E13] border border-[#D4AF37]/30 space-y-2 text-xs text-[#F3EDE0]/80">
                <div className="text-[10px] font-black uppercase text-[#D4AF37]">
                  HOW TO ADD TO VERCEL IN 3 STEPS:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] opacity-90">
                  <li>Open your <strong>Vercel Project Dashboard</strong> → <strong>Settings</strong> → <strong>Environment Variables</strong>.</li>
                  <li>Click <strong>"Add New"</strong> and paste each Key & Value from the table below.</li>
                  <li>On your next deployment, DocuStack will auto-detect and boot this database with the <strong>🟢 .ENV PERSISTENT</strong> badge!</li>
                </ol>
              </div>

              {/* Key-Value Pair Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-[#D4AF37]">
                    ENVIRONMENT VARIABLES SOUGHT BY APP
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(envText);
                      setCopiedAllSnippet(true);
                      setTimeout(() => setCopiedAllSnippet(false), 2500);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase bg-[#D4AF37] text-black hover:bg-[#c5a059] transition-colors cursor-pointer shadow-[2px_2px_0px_#000]"
                  >
                    {copiedAllSnippet ? <Check size={12} strokeWidth={3} /> : <Copy size={12} />}
                    <span>{copiedAllSnippet ? 'COPIED ALL!' : 'COPY ALL (.ENV)'}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {keys.map(({ key, val, desc }) => (
                    <div key={key} className="p-2.5 bg-[#0B0A0E] border border-[#D4AF37]/40 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-[#D4AF37] font-mono uppercase tracking-wider">
                          {key}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(val);
                            setCopiedKeyName(key);
                            setTimeout(() => setCopiedKeyName(null), 2000);
                          }}
                          className="flex items-center gap-1 text-[9px] px-2 py-0.5 border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors cursor-pointer"
                        >
                          {copiedKeyName === key ? <Check size={10} /> : <Copy size={10} />}
                          <span>{copiedKeyName === key ? 'Copied Value' : 'Copy Value'}</span>
                        </button>
                      </div>

                      <div className="p-1.5 bg-[#141318] border border-neutral-800 text-[10px] text-[#F3EDE0] font-mono break-all select-all">
                        {val || '<EMPTY / NOT CONFIGURED>'}
                      </div>

                      <p className="text-[9px] text-[#F3EDE0]/60 italic">
                        {desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Full .env Code Block */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-black uppercase text-[#D4AF37] opacity-80">
                  RAW .ENV FORMAT
                </span>
                <pre className="p-3 bg-[#0B0A0E] border border-[#D4AF37]/40 text-[11px] text-[#00E599] font-mono overflow-x-auto whitespace-pre-wrap select-all">
                  {envText}
                </pre>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[#D4AF37]/30">
                <span className="text-[10px] text-[#D4AF37]/70">
                  Role: <strong className="uppercase text-[#F3EDE0]">{selectedEnvDb.role.replace('_', ' ')}</strong>
                </span>
                <BrutalistButton
                  type="button"
                  variant="surface"
                  size="sm"
                  onClick={() => setSelectedEnvDb(null)}
                >
                  CLOSE BLUEPRINT
                </BrutalistButton>
              </div>
            </BrutalistCard>
          </div>
        );
      })()}
    </div>
  );
}
