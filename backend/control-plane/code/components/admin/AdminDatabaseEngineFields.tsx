'use client';

import React, { useState } from 'react';
import { Cpu, Copy, Eye, EyeOff, Layers, Flame, Server } from 'lucide-react';
import { BrutalistInput } from '../BrutalistUi';
import { AdminBackendEngine } from '@/lib/control-plane-types';

interface AdminDatabaseEngineFieldsProps {
  engine: AdminBackendEngine;
  pgConn: string;
  setPgConn: (val: string) => void;
  pgHost: string;
  setPgHost: (val: string) => void;
  pgDb: string;
  setPgDb: (val: string) => void;
  sbUrl: string;
  setSbUrl: (val: string) => void;
  sbKey: string;
  setSbKey: (val: string) => void;
  sbAnonKey: string;
  setSbAnonKey: (val: string) => void;
  sbTableName: string;
  setSbTableName: (val: string) => void;
  sbConnStr: string;
  setSbConnStr: (val: string) => void;
  neonConnStr: string;
  setNeonConnStr: (val: string) => void;
  neonTableName: string;
  setNeonTableName: (val: string) => void;
  firebaseProjectId: string;
  setFirebaseProjectId: (val: string) => void;
  firebaseApiKey: string;
  setFirebaseApiKey: (val: string) => void;
  firebaseCollection: string;
  setFirebaseCollection: (val: string) => void;
  remoteUrl: string;
  setRemoteUrl: (val: string) => void;
  onAutoProvisionNeon: () => void;
  provisioningNeon: boolean;
}

export default function AdminDatabaseEngineFields(props: AdminDatabaseEngineFieldsProps) {
  const { engine } = props;
  const [showPassword, setShowPassword] = useState(false);
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [showFirebaseKey, setShowFirebaseKey] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  const handleCopySchema = () => {
    const target = (props.sbTableName || 'ultrst-users').trim();
    const isQuoted = target.includes('-') ? `"${target}"` : target;
    const sql = `-- Ultrst Universal Accounts Table\nCREATE TABLE IF NOT EXISTS public.${isQuoted} (\n  id TEXT PRIMARY KEY,\n  email TEXT UNIQUE NOT NULL,\n  username TEXT UNIQUE NOT NULL,\n  name TEXT NOT NULL,\n  role TEXT NOT NULL DEFAULT 'user',\n  password_hash TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  app_profiles JSONB NOT NULL DEFAULT '{}'::jsonb\n);\nALTER TABLE public.${isQuoted} ENABLE ROW LEVEL SECURITY;`;
    navigator.clipboard.writeText(sql);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  return (
    <div className="space-y-4 select-none">
      {engine === 'sqlite' && (
        <div className="p-3 border-2 border-amber-500/50 bg-[#16151B] text-amber-300 text-xs">
          ⚠️ SQLite Control Plane is deprecated in favor of serverless PostgreSQL (Neon / Supabase).
        </div>
      )}

      {engine === 'postgres' && (
        <div className="p-3 border-2 border-[#D4AF37]/50 bg-[#16151B] space-y-3">
          <div>
            <label className="font-black uppercase block mb-1 opacity-80 text-xs text-[#D4AF37]">Connection URI</label>
            <BrutalistInput value={props.pgConn} onChange={(e) => props.setPgConn(e.target.value)} placeholder="postgresql://user:pass@host:5432/db" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-black uppercase block mb-1 opacity-80 text-xs text-[#D4AF37]">Host</label>
              <BrutalistInput value={props.pgHost} onChange={(e) => props.setPgHost(e.target.value)} />
            </div>
            <div>
              <label className="font-black uppercase block mb-1 opacity-80 text-xs text-[#D4AF37]">Database</label>
              <BrutalistInput value={props.pgDb} onChange={(e) => props.setPgDb(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {engine === 'supabase' && (
        <div className="p-3 border-2 border-[#D4AF37]/50 bg-[#16151B] space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-[#D4AF37]/30 pb-2">
            <span className="font-black uppercase text-[#D4AF37] flex items-center gap-1.5"><Cpu size={14} /> Supabase Accounts</span>
            <button type="button" onClick={handleCopySchema} className="text-[10px] px-2 py-0.5 border border-[#D4AF37]/60 text-[#D4AF37]">
              {copiedSchema ? 'SQL Copied!' : 'Copy SQL Schema'}
            </button>
          </div>
          <BrutalistInput value={props.sbUrl} onChange={(e) => props.setSbUrl(e.target.value)} placeholder="https://xyz.supabase.co" />
          <div className="relative">
            <BrutalistInput type={showPassword ? 'text' : 'password'} value={props.sbKey} onChange={(e) => props.setSbKey(e.target.value)} placeholder="Service Role Key (sb_secret_...)" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 text-[#D4AF37]">
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      )}

      {engine === 'neon' && (
        <div className="p-3 border-2 border-[#00E599]/50 bg-[#16151B] space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-[#00E599]/30 pb-2">
            <span className="font-black uppercase text-[#00E599] flex items-center gap-1.5"><Layers size={14} /> Neon Postgres (HTTP)</span>
            <button type="button" onClick={props.onAutoProvisionNeon} disabled={props.provisioningNeon} className="text-[10px] px-2 py-0.5 border border-[#00E599]/60 text-[#00E599]">
              {props.provisioningNeon ? 'Provisioning...' : 'Auto-Provision Table'}
            </button>
          </div>
          <BrutalistInput value={props.neonConnStr} onChange={(e) => props.setNeonConnStr(e.target.value)} placeholder="postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require" />
        </div>
      )}

      {engine === 'firebase' && (
        <div className="p-3 border-2 border-[#FFCA28]/50 bg-[#16151B] space-y-3 text-xs">
          <span className="font-black uppercase text-[#FFCA28] flex items-center gap-1.5"><Flame size={14} /> Firebase Cloud Firestore</span>
          <BrutalistInput value={props.firebaseProjectId} onChange={(e) => props.setFirebaseProjectId(e.target.value)} placeholder="Firebase Project ID" />
        </div>
      )}

      {engine === 'remote_auth' && (
        <div className="p-3 border-2 border-[#D4AF37]/50 bg-[#16151B] space-y-2 text-xs">
          <span className="font-black uppercase text-[#D4AF37] flex items-center gap-1.5"><Server size={14} /> Remote Auth Endpoint</span>
          <BrutalistInput value={props.remoteUrl} onChange={(e) => props.setRemoteUrl(e.target.value)} placeholder="https://auth.internal/v1" />
        </div>
      )}
    </div>
  );
}
