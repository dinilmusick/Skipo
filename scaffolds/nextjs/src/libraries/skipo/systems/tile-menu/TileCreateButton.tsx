/**
 * ASCII Architecture Flowchart: TileCreateButton
 *
 *   ┌──────────────────────────────────┐
 *   │   Initialize TileCreateButton    │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │         TileCreateButton         │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │  Return State / Result Payload   │
 *   └──────────────────────────────────┘
 */

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

'use client';


// ════ TILECREATEBUTTON IMPLEMENTATION ═════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export function TileCreateButton({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        border: '2px dashed rgba(255, 255, 255, 0.2)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        minHeight: '100px',
        color: 'rgba(255, 255, 255, 0.5)',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        e.currentTarget.style.color = 'var(--skipo-text-primary, #ffffff)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
      }}
    >
      <span style={{ fontSize: '32px' }}>+</span>
    </div>
  );
}