'use client';

import React from 'react';
import {
  HardDrive,
  Database,
  Zap,
  Layers,
  Flame,
  Server,
  Cpu,
  Trash2,
  CheckCircle2,
  FileCode,
  Activity,
} from 'lucide-react';
import { IconOnlyButton } from '../IconOnlyButton';
import { DatabaseConnectionEntry } from '@/lib/control-plane-types';

interface AdminDatabaseItemCardProps {
  db: DatabaseConnectionEntry;
  isTesting: boolean;
  isLockedFormerPrimary: boolean;
  onTest: (db: DatabaseConnectionEntry) => void;
  onSetPrimary: (db: DatabaseConnectionEntry) => void;
  onToggleEnable: (db: DatabaseConnectionEntry) => void;
  onDelete: (dbId: string, dbName: string) => void;
  onOpenEnvModal: (db: DatabaseConnectionEntry) => void;
  onBlockedDelete: (db: DatabaseConnectionEntry) => void;
}

export function getEngineIcon(engine: string) {
  switch (engine) {
    case 'sqlite': return <HardDrive size={16} className="text-[#D4AF37]" />;
    case 'postgres': return <Database size={16} className="text-blue-400" />;
    case 'supabase': return <Zap size={16} className="text-emerald-400" />;
    case 'neon': return <Layers size={16} className="text-green-400" />;
    case 'firebase': return <Flame size={16} className="text-amber-400" />;
    case 'remote_auth': return <Server size={16} className="text-purple-400" />;
    default: return <Cpu size={16} className="text-[#D4AF37]" />;
  }
}

export default function AdminDatabaseItemCard({
  db,
  isTesting,
  isLockedFormerPrimary,
  onTest,
  onSetPrimary,
  onToggleEnable,
  onDelete,
  onOpenEnvModal,
  onBlockedDelete,
}: AdminDatabaseItemCardProps) {
  const isPrimary = db.role === 'primary';

  return (
    <div
      id={`db-card-${db.id}`}
      className={`p-3 border-2 transition-all select-none ${
        isPrimary
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
                  isPrimary
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
                  onClick={() => onOpenEnvModal(db)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/50 cursor-pointer hover:bg-emerald-500/30 transition-colors shadow-[1px_1px_0px_#10b981]"
                  title={`Bound to Vercel / System .env (${db.envVarKey || 'Environment Variables'}). Click to view snippet.`}
                >
                  <FileCode size={10} className="text-emerald-400" />
                  <span>.ENV PERSISTENT</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenEnvModal(db)}
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
          {!isPrimary && (
            <IconOnlyButton
              icon={<Trash2 size={14} className={isLockedFormerPrimary ? 'text-neutral-500' : 'text-red-400'} />}
              tooltip={isLockedFormerPrimary ? 'Accidental Deletion Blocked (Sync Required)' : 'Delete Database Connection'}
              className={isLockedFormerPrimary ? 'opacity-60 border-dashed border-red-500/50 hover:border-red-500' : ''}
              onClick={() => {
                if (isLockedFormerPrimary) {
                  onBlockedDelete(db);
                } else {
                  onDelete(db.id, db.name);
                }
              }}
            />
          )}
          <IconOnlyButton
            icon={<CheckCircle2 size={14} className={db.enabled ? 'text-[#D4AF37]' : 'text-neutral-600'} />}
            tooltip={db.enabled ? 'Disable Redundancy Mirror' : 'Enable Redundancy Mirror'}
            active={db.enabled}
            onClick={() => onToggleEnable(db)}
          />
          <IconOnlyButton
            icon={<FileCode size={14} className={db.isFromEnv ? 'text-emerald-400' : 'text-amber-400'} />}
            tooltip={db.isFromEnv ? 'View Vercel .env Variables (Active)' : 'Get Vercel .env Variables to Make Permanent'}
            onClick={() => onOpenEnvModal(db)}
          />
          <IconOnlyButton
            icon={<Activity size={14} className={isTesting ? 'animate-spin' : ''} />}
            tooltip={`Test ${db.name} Connection`}
            disabled={isTesting}
            onClick={() => onTest(db)}
          />
          {!isPrimary && (
            <IconOnlyButton
              icon={<Zap size={14} />}
              tooltip="Set As Primary Database"
              onClick={() => onSetPrimary(db)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
