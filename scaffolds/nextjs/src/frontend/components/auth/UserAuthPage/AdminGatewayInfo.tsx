// ══════════════════════════════════════════════════════════════════════════════
// ADMIN GATEWAY INFO COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { BaseButton } from '../../../../libraries/skipo/ui/components/base/BaseButton';

interface AdminGatewayInfoProps {
  onSwitchToAdminPortal: () => void;
}

export const AdminGatewayInfo: React.FC<AdminGatewayInfoProps> = ({ onSwitchToAdminPortal }) => {
  return (
    <div className="mt-6 pt-4 border-t border-[var(--skipo-border-color)] flex items-center justify-between text-[11px] text-[var(--skipo-text-muted)]">
      <span>System Administrator?</span>
      <BaseButton
        variant="ghost"
        size="sm"
        onClick={onSwitchToAdminPortal}
        className="text-[var(--skipo-accent)] hover:underline font-bold flex items-center gap-1 cursor-pointer"
      >
        <span>Switch to Admin Portal</span>
        <ArrowRight size={11} />
      </BaseButton>
    </div>
  );
};
