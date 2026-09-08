'use client';

export interface SolidifyWidgetProps {
  x: number;
  y: number;
  onSolidify: () => void;
}

export function SolidifyWidget({ x, y, onSolidify }: SolidifyWidgetProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        zIndex: 7,
        pointerEvents: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title="Solidify Connection"
        style={{
          backgroundColor: 'rgba(97, 175, 239, 0.9)',
          border: '1px solid #61afef',
          borderRadius: '10px',
          color: '#ffffff',
          fontSize: '10px',
          fontWeight: 600,
          cursor: 'pointer',
          padding: '2px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          textTransform: 'uppercase'
        }}
        onClick={onSolidify}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Solidify
      </button>
    </div>
  );
}
