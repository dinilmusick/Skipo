'use client';

import React, { useState } from 'react';
import { Database, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Cpu, HardDrive, Layers, Server, Eye, EyeOff, Copy, Zap, Flame } from 'lucide-react';
import { BrutalistInput } from '../BrutalistUi';
import { IconOnlyButton } from '../IconOnlyButton';
import { AdminBackendConfig, AdminBackendEngine } from '@/lib/control-plane-types';

interface AdminBackendTabProps {
  config: AdminBackendConfig;
  engine: AdminBackendEngine;
  onSaveConfig: (updated: AdminBackendConfig) => Promise<void>;
  onTestConnection: (cfg: AdminBackendConfig) => Promise<{ success: boolean; message: string; latencyMs?: number }>;
  userToken: string | null;
}

export default function AdminBackendTab({ config, engine, onSaveConfig, onTestConnection, userToken }: AdminBackendTabProps) {
  const [profileName, setProfileName] = useState(config.activeProfile || 'Primary Control Plane');
  const [sqlitePath, setSqlitePath] = useState(config.sqlite?.dbPath || './docustack_vault/control_plane/accounts.sqlite');
  const [walMode, setWalMode] = useState(config.sqlite?.walMode ?? true);
  const [pgConn, setPgConn] = useState(config.postgres?.connectionString || '');
  const [pgHost, setPgHost] = useState(config.postgres?.host || 'localhost');
  const [pgPort, setPgPort] = useState(config.postgres?.port || 5432);
  const [pgDb, setPgDb] = useState(config.postgres?.database || 'docustack_control_plane');
  const [pgSsl, setPgSsl] = useState(config.postgres?.ssl ?? true);
  const [sbUrl, setSbUrl] = useState(config.supabase?.url || '');
  const [sbKey, setSbKey] = useState(config.supabase?.serviceRoleKey || '');
  const [sbAnonKey, setSbAnonKey] = useState(config.supabase?.anonKey || '');
  const [sbConnStr, setSbConnStr] = useState(config.supabase?.connectionString || '');
  const [sbTableName, setSbTableName] = useState(config.supabase?.tableName || 'users');
  const [neonConnStr, setNeonConnStr] = useState(config.neon?.connectionString || '');
  const [neonTableName, setNeonTableName] = useState(config.neon?.tableName || 'ultrst-users');
  const [provisioningNeon, setProvisioningNeon] = useState(false);
  const [firebaseProjectId, setFirebaseProjectId] = useState(config.firebase?.projectId || '');
  const [firebaseApiKey, setFirebaseApiKey] = useState(config.firebase?.apiKey || '');
  const [firebaseCollection, setFirebaseCollection] = useState(config.firebase?.collectionName || 'ultrst-users');
  const [showFirebaseKey, setShowFirebaseKey] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState(config.remote_auth?.endpointUrl || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);
  
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  const getCurrentConfigState = (): AdminBackendConfig => ({
    engine,
    activeProfile: profileName,
    sqlite: { dbPath: sqlitePath, walMode },
    postgres: { connectionString: pgConn, host: pgHost, port: Number(pgPort), database: pgDb, ssl: pgSsl },
    supabase: {
      url: sbUrl,
      serviceRoleKey: sbKey,
      anonKey: sbAnonKey,
      connectionString: sbConnStr,
      tableName: sbTableName || 'users',
    },
    neon: {
      connectionString: neonConnStr,
      tableName: neonTableName || 'ultrst-users',
    },
    firebase: {
      projectId: firebaseProjectId,
      apiKey: firebaseApiKey,
      collectionName: firebaseCollection || 'ultrst-users',
    },
    remote_auth: { endpointUrl: remoteUrl },
    status: 'connected',
  });

  const handleAutoProvisionNeon = async () => {
    if (!neonConnStr.trim()) {
      setTestResult({ success: false, message: 'Neon Connection String is required for auto-provisioning.' });
      return;
    }
    setProvisioningNeon(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/backend', {
        method: 'POST',
        headers: { Authorization: userToken ? `Bearer ${userToken}` : '', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'provision_table',
          engine: 'neon',
          connectionString: neonConnStr.trim(),
          tableName: neonTableName.trim() || 'ultrst-users',
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Provisioning failed');
      setTestResult({ success: true, message: data.message || 'Table successfully provisioned in Neon!' });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setProvisioningNeon(false);
    }
  };

  const handleCopySchema = () => {
    const targetTable = (sbTableName || 'ultrst-users').trim();
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

-- Enable Row Level Security (Service Role Key bypasses RLS automatically)
ALTER TABLE public.${isQuoted} ENABLE ROW LEVEL SECURITY;`;
    navigator.clipboard.writeText(sql);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2500);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection(getCurrentConfigState());
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveConfig(getCurrentConfigState());
      await handleTest();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs select-none">

      {engine === 'sqlite' && (
        <div className="p-3 border-2 border-[#D4AF37]/50 bg-[#16151B] space-y-3">
          <div>
            <label className="font-black uppercase block mb-1 opacity-80">Accounts Storage Path</label>
            <BrutalistInput value={sqlitePath} onChange={(e) => setSqlitePath(e.target.value)} placeholder="./docustack_vault/control_plane/accounts.sqlite" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={walMode} onChange={(e) => setWalMode(e.target.checked)} className="w-4 h-4 accent-[#D4AF37]" />
            <span className="font-black uppercase">Enable WAL & Locks</span>
          </label>
        </div>
      )}

      {engine === 'postgres' && (
        <div className="p-3 border-2 border-[#D4AF37]/50 bg-[#16151B] space-y-3">
          <div>
            <label className="font-black uppercase block mb-1 opacity-80">Connection URI</label>
            <BrutalistInput value={pgConn} onChange={(e) => setPgConn(e.target.value)} placeholder="postgresql://user:pass@host:5432/docustack_control_plane" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-black uppercase block mb-1 opacity-80">Host</label>
              <BrutalistInput value={pgHost} onChange={(e) => setPgHost(e.target.value)} />
            </div>
            <div>
              <label className="font-black uppercase block mb-1 opacity-80">Database</label>
              <BrutalistInput value={pgDb} onChange={(e) => setPgDb(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {engine === 'supabase' && (
        <div className="p-3 border-2 border-[#D4AF37]/50 bg-[#16151B] space-y-3">
          <div className="flex items-center justify-between border-b border-[#D4AF37]/30 pb-2">
            <span className="text-[10px] font-black uppercase text-[#D4AF37] tracking-wider flex items-center gap-1.5">
              <Cpu size={14} /> Supabase User Accounts Database (PostgREST & Pooler)
            </span>
            <button
              type="button"
              onClick={handleCopySchema}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors"
              title="Copy SQL for Supabase SQL Editor"
            >
              <Copy size={11} />
              <span>{copiedSchema ? 'SQL Copied!' : 'Copy SQL Schema'}</span>
            </button>
          </div>

          <div>
            <label className="font-black uppercase block mb-1 opacity-80 text-[10px]">
              Supabase Project URL <span className="text-red-400">*</span>
            </label>
            <BrutalistInput
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              placeholder="https://abcdefghijklmnopqrst.supabase.co"
            />
          </div>

          <div>
            <label className="font-black uppercase block mb-1 opacity-80 text-[10px]">
              Secret API Key (Service Role) <span className="text-red-400">*</span>
              <span className="ml-1 text-[9px] text-[#D4AF37]/70 font-normal">
                (Allows admin control plane to manage user accounts & bypass RLS)
              </span>
            </label>
            <div className="relative flex items-center">
              <BrutalistInput
                type={showPassword ? "text" : "password"}
                value={sbKey}
                onChange={(e) => setSbKey(e.target.value)}
                placeholder="sb_secret_... or legacy eyJhbGci..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 p-1 text-[#D4AF37] hover:text-[#F3EDE0] focus:outline-none transition-colors cursor-pointer"
                title={showPassword ? "Hide key" : "Show key"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-black uppercase block mb-1 opacity-80 text-[10px]">
                Publishable Key / Anon Key
                <span className="ml-1 text-[9px] text-[#D4AF37]/70 font-normal">(Optional Client Key)</span>
              </label>
              <div className="relative flex items-center">
                <BrutalistInput
                  type={showAnonKey ? "text" : "password"}
                  value={sbAnonKey}
                  onChange={(e) => setSbAnonKey(e.target.value)}
                  placeholder="sb_publishable_... or legacy eyJhbGci..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAnonKey(!showAnonKey)}
                  className="absolute right-2 p-1 text-[#D4AF37] hover:text-[#F3EDE0] focus:outline-none transition-colors cursor-pointer"
                  title={showAnonKey ? "Hide key" : "Show key"}
                >
                  {showAnonKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="font-black uppercase block mb-1 opacity-80 text-[10px]">
                User Accounts Table Name
              </label>
              <BrutalistInput
                value={sbTableName}
                onChange={(e) => setSbTableName(e.target.value)}
                placeholder="users"
              />
            </div>
          </div>

          <div>
            <label className="font-black uppercase block mb-1 opacity-80 text-[10px]">
              PostgreSQL / Supavisor Connection String
              <span className="ml-1 text-[9px] text-[#D4AF37]/70 font-normal">(Optional - Port 6543 Pooler or Port 5432 Direct)</span>
            </label>
            <BrutalistInput
              value={sbConnStr}
              onChange={(e) => setSbConnStr(e.target.value)}
              placeholder="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
            />
          </div>
        </div>
      )}

      {engine === 'neon' && (
        <div className="p-3 border-2 border-[#00E599]/50 bg-[#16151B] space-y-3">
          <div className="flex items-center justify-between border-b border-[#00E599]/30 pb-2">
            <span className="text-[10px] font-black uppercase text-[#00E599] tracking-wider flex items-center gap-1.5">
              <Zap size={14} /> Neon Serverless Postgres (Direct HTTP & Connectionless)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoProvisionNeon}
                disabled={provisioningNeon}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 border border-[#00E599] bg-[#00E599]/10 text-[#00E599] hover:bg-[#00E599] hover:text-black font-black uppercase transition-colors cursor-pointer"
              >
                <Zap size={11} className={provisioningNeon ? 'animate-spin' : ''} />
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
                  setCopiedSchema(true);
                  setTimeout(() => setCopiedSchema(false), 2500);
                }}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors cursor-pointer"
              >
                <Copy size={11} />
                <span>{copiedSchema ? 'SQL Copied!' : 'Copy SQL Schema'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="font-black uppercase block mb-1 opacity-80 text-[10px] text-[#00E599]">
              Neon PostgreSQL Connection String <span className="text-red-400">*</span>
            </label>
            <BrutalistInput
              value={neonConnStr}
              onChange={(e) => setNeonConnStr(e.target.value)}
              placeholder="postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require"
              className="font-mono text-xs"
            />
            <span className="text-[9px] opacity-70 mt-1 block">
              Direct connectionless queries over HTTP without pooler timeout or socket exhaustion.
            </span>
          </div>

          <div>
            <label className="font-black uppercase block mb-1 opacity-80 text-[10px] text-[#00E599]">
              User Accounts Table Name
            </label>
            <BrutalistInput
              value={neonTableName}
              onChange={(e) => setNeonTableName(e.target.value)}
              placeholder="ultrst-users"
              className="font-mono text-xs"
            />
          </div>
        </div>
      )}

      {engine === 'firebase' && (
        <div className="p-3 border-2 border-[#FFCA28]/50 bg-[#16151B] space-y-3">
          <div className="flex items-center justify-between border-b border-[#FFCA28]/30 pb-2">
            <span className="text-[10px] font-black uppercase text-[#FFCA28] tracking-wider flex items-center gap-1.5">
              <Flame size={14} /> Firebase Cloud Firestore (NoSQL Document Store)
            </span>
          </div>

          <div>
            <label className="font-black uppercase block mb-1 opacity-80 text-[10px] text-[#FFCA28]">
              Firebase Project ID <span className="text-red-400">*</span>
            </label>
            <BrutalistInput
              value={firebaseProjectId}
              onChange={(e) => setFirebaseProjectId(e.target.value)}
              placeholder="e.g. docustack-prod-12345"
              className="font-mono text-xs"
            />
          </div>

          <div>
            <label className="font-black uppercase block mb-1 opacity-80 text-[10px] text-[#FFCA28]">
              Web API Key (Optional)
            </label>
            <div className="relative flex items-center">
              <BrutalistInput
                type={showFirebaseKey ? "text" : "password"}
                value={firebaseApiKey}
                onChange={(e) => setFirebaseApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowFirebaseKey(!showFirebaseKey)}
                className="absolute right-2 p-1 text-[#FFCA28] hover:text-[#F3EDE0] focus:outline-none transition-colors cursor-pointer"
                title={showFirebaseKey ? "Hide key" : "Show key"}
              >
                {showFirebaseKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="font-black uppercase block mb-1 opacity-80 text-[10px] text-[#FFCA28]">
              Accounts Firestore Collection Name
            </label>
            <BrutalistInput
              value={firebaseCollection}
              onChange={(e) => setFirebaseCollection(e.target.value)}
              placeholder="ultrst-users"
              className="font-mono text-xs"
            />
          </div>
        </div>
      )}

      {engine === 'remote_auth' && (
        <div className="p-3 border-2 border-[#D4AF37]/50 bg-[#16151B] space-y-3">
          <div>
            <label className="font-black uppercase block mb-1 opacity-80">Remote Auth Endpoint</label>
            <BrutalistInput value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)} placeholder="https://auth.internal/v1" />
          </div>
        </div>
      )}

      {testResult && (
        <div className={`p-3 border-2 font-black text-xs flex items-center justify-between ${
          testResult.success ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400' : 'bg-red-500/15 border-red-500 text-red-400'
        }`}>
          <div className="flex items-center gap-2">
            {testResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{testResult.message}</span>
          </div>
          {testResult.latencyMs !== undefined && <span>{testResult.latencyMs} ms</span>}
        </div>
      )}

      {/* Action Controls - Icon-Only Buttons with Hover Tooltips */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <IconOnlyButton
          icon={<RefreshCw size={18} className={testing ? 'animate-spin' : ''} />}
          tooltip={testing ? 'Testing Engine Connection...' : 'Test Backend Connection'}
          disabled={testing}
          variant="secondary"
          onClick={handleTest}
        />
        <IconOnlyButton
          icon={<Database size={18} />}
          tooltip={saving ? 'Connecting Storage Backend...' : 'Save & Connect Storage Engine'}
          disabled={saving}
          variant="accent"
          onClick={handleSave}
        />
      </div>
    </div>
  );
}
