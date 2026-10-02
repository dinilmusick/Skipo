// ══════════════════════════════════════════════════════════════════════════════
// AUTH STATUS BOX COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface AuthStatusBoxProps {
  authMode: 'login' | 'register';
  error: string | null;
}

export const AuthStatusBox: React.FC<AuthStatusBoxProps> = ({ authMode, error }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!error) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(error);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  return (
    <>
      <div className="mb-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-[var(--skipo-text)]">
          {authMode === 'login' ? 'WORKSPACE SIGN IN' : 'NEW DEVELOPER ACCOUNT'}
        </h2>
        <p className="text-xs text-[var(--skipo-text-muted)] mt-1">
          {authMode === 'login'
            ? 'Sign in to access your deployment topologies, apps, and SRKL credential vault.'
            : 'Create an account to manage deployments and sync multi-cloud credentials.'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 border-2 border-red-500/80 bg-red-950/40 text-red-300 text-xs flex flex-col gap-1.5 relative">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-bold text-red-400">
              <AlertCircle size={14} className="shrink-0" />
              <span>Authentication Error</span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              title="Copy Error"
              aria-label="Copy Error"
              className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-800/80 hover:bg-red-700 text-white transition-colors"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="leading-snug break-words font-mono text-[11px]">{error}</div>
        </div>
      )}
    </>
  );
};
