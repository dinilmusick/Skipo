'use client';

import React, { useState } from 'react';
import { Database, Plus, X, Layers, Flame, Zap, Eye, EyeOff } from 'lucide-react';
import { BrutalistButton, BrutalistInput } from '../BrutalistUi';
import { IconOnlyButton } from '../IconOnlyButton';
import { AdminBackendEngine, DatabaseConnectionEntry, DatabaseRole, DatabaseTargetScope } from '@/lib/control-plane-types';

interface AdminAddDatabaseFormProps {
  onAdd: (newEntry: Partial<DatabaseConnectionEntry>) => void;
  onCancel: () => void;
  userToken: string | null;
}

export default function AdminAddDatabaseForm({ onAdd, onCancel, userToken }: AdminAddDatabaseFormProps) {
  const [newName, setNewName] = useState('');
  const [newEngine, setNewEngine] = useState<AdminBackendEngine>('neon');
  const [newRole, setNewRole] = useState<DatabaseRole>('redundant_clone');
  const [newTarget, setNewTarget] = useState<DatabaseTargetScope>('all');
  const [pgHost, setPgHost] = useState('localhost');
  const [pgPort, setPgPort] = useState(5432);
  const [pgDatabase, setPgDatabase] = useState('docustack_accounts_clone');
  const [pgUser, setPgUser] = useState('docustack_admin');
  const [pgPassword, setPgPassword] = useState('');
  const [pgSsl, setPgSsl] = useState(true);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseTableName, setSupabaseTableName] = useState('users');
  const [neonConnStr, setNeonConnStr] = useState('');
  const [neonTableName, setNeonTableName] = useState('ultrst-users');
  const [firebaseProjectId, setFirebaseProjectId] = useState('');
  const [firebaseApiKey, setFirebaseApiKey] = useState('');
  const [firebaseCollection, setFirebaseCollection] = useState('ultrst-users');
  const [showPassword, setShowPassword] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    let connStr = '';
    if (newEngine === 'postgres') {
      const auth = pgUser ? `${pgUser}${pgPassword ? `:${pgPassword}` : ''}@` : '';
      connStr = `postgresql://${auth}${pgHost}:${pgPort}/${pgDatabase}${pgSsl ? '?sslmode=require' : ''}`;
    } else if (newEngine === 'neon') {
      connStr = neonConnStr.trim();
    }

    const entry: Partial<DatabaseConnectionEntry> = {
      name: newName.trim(),
      engine: newEngine,
      role: newRole,
      target: newTarget,
      enabled: true,
      status: 'offline',
      isFromEnv: false,
      postgres: newEngine === 'postgres' ? { connectionString: connStr.trim(), ssl: true } : undefined,
      neon: newEngine === 'neon' ? { connectionString: neonConnStr.trim(), tableName: neonTableName.trim() || 'ultrst-users' } : undefined,
      supabase: newEngine === 'supabase' ? { url: supabaseUrl.trim(), serviceRoleKey: supabaseKey.trim(), tableName: supabaseTableName.trim() || 'users' } : undefined,
      firebase: newEngine === 'firebase' ? { projectId: firebaseProjectId.trim(), apiKey: firebaseApiKey.trim(), collectionName: firebaseCollection.trim() || 'ultrst-users' } : undefined,
    };

    onAdd(entry);
  };

  const handleAutoProvision = async () => {
    if (!neonConnStr.trim() || !userToken) return;
    setProvisioning(true);
    try {
      await fetch('/api/admin/backend', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'provision_table', engine: 'neon', connectionString: neonConnStr.trim(), tableName: neonTableName.trim() || 'ultrst-users' }),
      });
    } catch {}
    setProvisioning(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-2 border-[#D4AF37] bg-[#141318] space-y-4 select-none">
      <div className="flex items-center justify-between border-b border-[#D4AF37]/30 pb-2">
        <span className="text-xs font-black uppercase text-[#D4AF37] flex items-center gap-1.5">
          <Plus size={14} /> REGISTER DATABASE CONNECTION REPLICA
        </span>
        <IconOnlyButton icon={<X size={14} />} tooltip="Cancel" onClick={onCancel} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-black uppercase text-[#D4AF37] mb-1">Display Label</label>
          <input type="text" placeholder="e.g. EU Standby Pool" value={newName} onChange={(e) => setNewName(e.target.value)} required className="w-full px-2.5 py-1.5 bg-[#0F0E12] border-2 border-[#D4AF37]/60 text-xs text-[#F3EDE0] focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase text-[#D4AF37] mb-1">Engine Type</label>
          <select value={newEngine} onChange={(e) => setNewEngine(e.target.value as AdminBackendEngine)} className="w-full px-2.5 py-1.5 bg-[#0F0E12] border-2 border-[#D4AF37]/60 text-xs text-[#F3EDE0] focus:outline-none">
            <option value="neon">Neon Serverless Postgres</option>
            <option value="supabase">Supabase BaaS Engine</option>
            <option value="postgres">PostgreSQL Relational Storage</option>
            <option value="firebase">Firebase Cloud Firestore</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase text-[#D4AF37] mb-1">Redundancy Role</label>
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as DatabaseRole)} className="w-full px-2.5 py-1.5 bg-[#0F0E12] border-2 border-[#D4AF37]/60 text-xs text-[#F3EDE0] focus:outline-none">
            <option value="redundant_clone">Redundant Clone (Mirror)</option>
            <option value="primary">Primary Database (Writer)</option>
            <option value="failover_standby">Failover Standby Replica</option>
          </select>
        </div>
      </div>

      {newEngine === 'neon' && (
        <div className="p-3 bg-[#0E0D11] border border-[#00E599]/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-[#00E599] uppercase flex items-center gap-1"><Layers size={13} /> Neon Serverless URI</span>
            <button type="button" onClick={handleAutoProvision} disabled={provisioning} className="text-[9px] px-2 py-0.5 border border-[#00E599]/60 text-[#00E599] hover:bg-[#00E599]/20 transition-colors">
              {provisioning ? 'Provisioning...' : 'Auto-Provision Table'}
            </button>
          </div>
          <input type="text" placeholder="postgresql://user:pass@ep-xyz.neon.tech/dbname?sslmode=require" value={neonConnStr} onChange={(e) => setNeonConnStr(e.target.value)} required className="w-full p-1.5 bg-[#141318] border border-[#00E599]/50 text-xs text-[#F3EDE0] font-mono" />
        </div>
      )}

      {newEngine === 'supabase' && (
        <div className="p-3 bg-[#0E0D11] border border-[#D4AF37]/30 space-y-2">
          <input type="text" placeholder="https://xyz.supabase.co" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} required className="w-full p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0] font-mono" />
          <input type="password" placeholder="Service Role Key (sb_secret_...)" value={supabaseKey} onChange={(e) => setSupabaseKey(e.target.value)} required className="w-full p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0] font-mono" />
        </div>
      )}

      {newEngine === 'postgres' && (
        <div className="p-3 bg-[#0E0D11] border border-[#D4AF37]/30 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input type="text" placeholder="Host" value={pgHost} onChange={(e) => setPgHost(e.target.value)} className="p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0]" />
          <input type="number" placeholder="Port" value={pgPort} onChange={(e) => setPgPort(Number(e.target.value))} className="p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0]" />
          <input type="text" placeholder="Database" value={pgDatabase} onChange={(e) => setPgDatabase(e.target.value)} className="p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0]" />
          <input type="password" placeholder="Password" value={pgPassword} onChange={(e) => setPgPassword(e.target.value)} className="p-1.5 bg-[#141318] border border-[#D4AF37]/50 text-xs text-[#F3EDE0]" />
        </div>
      )}

      {newEngine === 'firebase' && (
        <div className="p-3 bg-[#0E0D11] border border-[#FFCA28]/40 space-y-2">
          <input type="text" placeholder="Firebase Project ID" value={firebaseProjectId} onChange={(e) => setFirebaseProjectId(e.target.value)} required className="w-full p-1.5 bg-[#141318] border border-[#FFCA28]/50 text-xs text-[#F3EDE0] font-mono" />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <BrutalistButton type="button" variant="surface" size="sm" onClick={onCancel}>CANCEL</BrutalistButton>
        <BrutalistButton type="submit" variant="accent" size="sm">SAVE DATABASE ENTRY</BrutalistButton>
      </div>
    </form>
  );
}
