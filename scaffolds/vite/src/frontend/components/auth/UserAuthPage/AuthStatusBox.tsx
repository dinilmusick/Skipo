// ══════════════════════════════════════════════════════════════════════════════
// AUTH STATUS BOX COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface AuthStatusBoxProps {
  authMode: 'login' | 'register';
  error: string | null;
}

export const AuthStatusBox: React.FC<AuthStatusBoxProps> = ({ authMode, error }) => {
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
        <div className="mb-4 p-3 border-2 border-red-500/80 bg-red-950/40 text-red-300 text-xs flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-400" />
          <div className="leading-snug">{error}</div>
        </div>
      )}
    </>
  );
};
