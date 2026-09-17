'use client';

import React, { useState } from 'react';
import { CheckCircle2, Zap, Copy, Check, FileCode, X } from 'lucide-react';
import { BrutalistButton, BrutalistCard } from '../BrutalistUi';
import { IconOnlyButton } from '../IconOnlyButton';
import { DatabaseConnectionEntry } from '@/lib/control-plane-types';

interface AdminVercelEnvModalProps {
  db: DatabaseConnectionEntry;
  onClose: () => void;
}

export default function AdminVercelEnvModal({ db, onClose }: AdminVercelEnvModalProps) {
  const [copiedKeyName, setCopiedKeyName] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const getEnvConfigKeys = () => {
    switch (db.engine) {
      case 'neon':
        return [
          { key: 'SYSTEM_DATABASE_URL_1', val: db.neon?.connectionString || db.postgres?.connectionString || '', desc: 'Standard Primary System Postgres connection string.' },
          { key: 'NEON_DATABASE_URL', val: db.neon?.connectionString || db.postgres?.connectionString || '', desc: 'Fallback connection string for Neon serverless pool.' },
        ];
      case 'supabase':
        return [
          { key: 'SUPABASE_URL', val: db.supabase?.url || '', desc: 'Supabase project base URL.' },
          { key: 'SUPABASE_SERVICE_ROLE_KEY', val: db.supabase?.serviceRoleKey || '', desc: 'Supabase server-only service role secret key.' },
        ];
      case 'postgres':
        return [
          { key: 'SYSTEM_DATABASE_URL_1', val: db.postgres?.connectionString || '', desc: 'PostgreSQL connection URI.' },
        ];
      case 'firebase':
        return [
          { key: 'FIREBASE_PROJECT_ID', val: db.firebase?.projectId || '', desc: 'Google Cloud / Firebase project identifier.' },
        ];
      case 'sqlite':
        return [{ key: 'SQLITE_DB_PATH', val: db.sqlite?.dbPath || './data/runtime.db', desc: 'Local filesystem SQLite storage path.' }];
      default:
        return [];
    }
  };

  const keys = getEnvConfigKeys();
  const envText = keys.map((k) => `${k.key}="${k.val}"`).join('\n');

  return (
    <div
      id="admin-env-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 font-mono select-none"
    >
      <BrutalistCard variant="surface" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 space-y-4 border-[#D4AF37]">
        <div className="flex items-center justify-between border-b border-[#D4AF37]/30 pb-2">
          <div className="flex items-center gap-2">
            <FileCode size={18} className="text-[#D4AF37]" />
            <span className="font-black text-sm uppercase text-[#F3EDE0]">
              VERCEL & SYSTEM .ENV BLUEPRINT: [{db.name}]
            </span>
          </div>
          <IconOnlyButton icon={<X size={16} />} tooltip="Close" onClick={onClose} />
        </div>

        <div className={`p-3 border flex items-start gap-3 ${db.isFromEnv ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' : 'bg-amber-950/40 border-amber-500/50 text-amber-200'}`}>
          {db.isFromEnv ? <CheckCircle2 size={18} className="shrink-0 text-emerald-400 mt-0.5" /> : <Zap size={18} className="shrink-0 text-amber-400 mt-0.5" />}
          <div>
            <div className="font-black uppercase tracking-wider text-[11px]">
              {db.isFromEnv ? 'PERSISTENT ACROSS REDEPLOYMENTS' : 'RUNTIME ONLY (NEEDS SYSTEM .ENV CONFIG)'}
            </div>
            <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
              {db.isFromEnv
                ? `Auto-detected from environment variable [${db.envVarKey || 'SYSTEM_DATABASE_URL_1'}]. Active on all invocations.`
                : 'Held in runtime memory. Add to your .env or Vercel Environment Variables to make permanent.'}
            </p>
          </div>
        </div>

        <div className="p-3 bg-[#0F0E13] border border-[#D4AF37]/30 space-y-2 text-xs text-[#F3EDE0]/80">
          <div className="text-[10px] font-black uppercase text-[#D4AF37]">HOW TO ADD TO DEPLOYMENT:</div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] opacity-90">
            <li>Open your <strong>Vercel Dashboard</strong> → <strong>Settings</strong> → <strong>Environment Variables</strong>.</li>
            <li>Add each Key & Value from the table below.</li>
            <li>On next build, the app will auto-detect this with the <strong>🟢 .ENV PERSISTENT</strong> badge!</li>
          </ol>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-[#D4AF37]">ENVIRONMENT VARIABLES</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(envText);
                setCopiedAll(true);
                setTimeout(() => setCopiedAll(false), 2500);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase bg-[#D4AF37] text-black hover:bg-[#c5a059] transition-colors cursor-pointer"
            >
              {copiedAll ? <Check size={12} strokeWidth={3} /> : <Copy size={12} />}
              <span>{copiedAll ? 'COPIED ALL!' : 'COPY ALL (.ENV)'}</span>
            </button>
          </div>

          <div className="space-y-2">
            {keys.map(({ key, val, desc }) => (
              <div key={key} className="p-2.5 bg-[#0B0A0E] border border-[#D4AF37]/40 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-[#D4AF37] font-mono uppercase tracking-wider">{key}</span>
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
                    <span>{copiedKeyName === key ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-1.5 bg-[#141318] border border-neutral-800 text-[10px] text-[#F3EDE0] font-mono break-all select-all">
                  {val || '<EMPTY / NOT CONFIGURED>'}
                </div>
                <p className="text-[9px] text-[#F3EDE0]/60 italic">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1 pt-1">
          <span className="text-[10px] font-black uppercase text-[#D4AF37] opacity-80">RAW .ENV FORMAT</span>
          <pre className="p-3 bg-[#0B0A0E] border border-[#D4AF37]/40 text-[11px] text-[#00E599] font-mono overflow-x-auto whitespace-pre-wrap select-all">
            {envText}
          </pre>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#D4AF37]/30">
          <span className="text-[10px] text-[#D4AF37]/70">
            Role: <strong className="uppercase text-[#F3EDE0]">{db.role.replace('_', ' ')}</strong>
          </span>
          <BrutalistButton type="button" variant="surface" size="sm" onClick={onClose}>
            CLOSE BLUEPRINT
          </BrutalistButton>
        </div>
      </BrutalistCard>
    </div>
  );
}
