// ══════════════════════════════════════════════════════════════════════════════
// USER AUTH HEADER COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { Shield } from 'lucide-react';
import { BaseButton } from '../../../../libraries/skipo/ui/components/base/BaseButton';

interface UserAuthHeaderProps {
  onSwitchToAdminPortal: () => void;
}

export const UserAuthHeader: React.FC<UserAuthHeaderProps> = ({ onSwitchToAdminPortal }) => {
  return (
    <header className="border-b-2 border-[var(--skipo-border-color)] bg-[var(--skipo-surface)] px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-[var(--skipo-accent)] text-black font-black flex items-center justify-center border border-[var(--skipo-border-color)]">
          ▲
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black uppercase tracking-wider text-[var(--skipo-text)]">
              MyApp
            </span>
            <span className="text-[10px] text-[var(--skipo-text-muted)] font-bold">
              APPLICATION PLATFORM
            </span>
          </div>
        </div>
      </div>

      <BaseButton
        variant="ghost"
        size="sm"
        onClick={onSwitchToAdminPortal}
        className="px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-[var(--skipo-accent)] bg-[var(--skipo-accent)]/10 text-[var(--skipo-accent)] hover:bg-[var(--skipo-accent)] hover:text-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-[2px_2px_0px_var(--skipo-accent)]"
        title="Open System Administrator Control Plane"
      >
        <Shield size={13} />
        <span>ADMIN LOGIN</span>
      </BaseButton>
    </header>
  );
};
