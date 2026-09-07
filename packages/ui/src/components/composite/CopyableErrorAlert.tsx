'use client';
import React, { useState } from 'react';
import { BaseCard } from '../base/BaseCard.js';
import { BaseButton } from '../base/BaseButton.js';
import { BaseBadge } from '../base/BaseBadge.js';
import '../../styles/composite.css';

export interface CopyableErrorAlertProps {
  error: string | Error | null | undefined;
  title?: string;
  className?: string;
  onClear?: () => void;
}

export const CopyableErrorAlert: React.FC<CopyableErrorAlertProps> = ({
  error,
  title = 'System Error',
  className = '',
  onClear,
}) => {
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message || String(error);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(errorMessage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  return (
    <BaseCard
      variant="surface"
      depth="sm"
      className={`skipo-error-alert ${className}`}
      style={{
        border: '1px solid var(--skipo-danger, #ef4444)',
        background: 'rgba(239, 68, 68, 0.08)',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BaseBadge variant="neutral" style={{ background: 'var(--skipo-danger, #ef4444)', color: '#fff' }}>
            ERROR
          </BaseBadge>
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <BaseButton
            size="sm"
            variant={copied ? 'success' : 'secondary'}
            onClick={handleCopy}
            type="button"
          >
            {copied ? 'COPIED' : 'COPY'}
          </BaseButton>
          {onClear && (
            <BaseButton size="sm" variant="ghost" onClick={onClear} type="button">
              ✕
            </BaseButton>
          )}
        </div>
      </div>
      <div
        style={{
          fontSize: '12px',
          fontFamily: 'var(--skipo-font-mono, monospace)',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          maxHeight: '120px',
          overflowY: 'auto',
          color: 'var(--skipo-text)',
        }}
      >
        {errorMessage}
      </div>
    </BaseCard>
  );
};
CopyableErrorAlert.displayName = 'CopyableErrorAlert';
