/**
 * ASCII Architecture Flowchart: tokenMapper
 *
 *   ┌──────────────────────────────────┐
 *   │      Initialize tokenMapper      │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │    mapSemanticTokensToCssVars    │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │  Return State / Result Payload   │
 *   └──────────────────────────────────┘
 */

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════


// ════ TOKENMAPPER IMPLEMENTATION ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export function mapSemanticTokensToCssVars(tokens: any): Record<string, string> {
  if (!tokens) return {};
  return {
    '--skipo-font': tokens.font?.sans || '',
    '--skipo-font-mono': tokens.font?.mono || '',
    '--skipo-bg': tokens.bg?.canvas || '',
    '--skipo-surface-background': tokens.bg?.canvas || '',
    '--color-base': tokens.bg?.canvas || '',
    '--skipo-surface': tokens.bg?.surface || '',
    '--color-surface': tokens.bg?.surface || '',
    '--skipo-surface-hover': tokens.bg?.surfaceHover || tokens.bg?.surface || '',
    '--skipo-matte-bg': tokens.bg?.surface || '',
    '--skipo-matte-bg-hover': tokens.bg?.surfaceHover || tokens.bg?.surface || '',
    '--skipo-matte-blur': tokens.bg?.blur || 'blur(16px)',
    '--skipo-text': tokens.text?.primary || '',
    '--skipo-text-primary': tokens.text?.primary || '',
    '--skipo-text-muted': tokens.text?.muted || '',
    '--skipo-text-inverse': tokens.text?.inverse || '',
    '--skipo-accent': tokens.accent?.primary || '',
    '--color-accent': tokens.accent?.primary || '',
    '--skipo-accent-fg': tokens.accent?.fg || '',
    '--skipo-accent-hover': tokens.accent?.hover || tokens.accent?.primary || '',
    '--skipo-accent-glow': tokens.accent?.glow || 'none',
    '--skipo-border-color': tokens.border?.color || '',
    '--color-border': tokens.border?.color || '',
    '--skipo-border': tokens.border?.style || `2px solid ${tokens.border?.color || 'currentColor'}`,
    '--skipo-border-input': tokens.border?.input ? `2px solid ${tokens.border.input}` : (tokens.border?.style || ''),
    '--skipo-radius': tokens.radius?.base || '0px',
    '--skipo-radius-sm': tokens.radius?.sm || '0px',
    '--skipo-radius-lg': tokens.radius?.lg || '0px',
    '--skipo-shadow': tokens.shadow?.card || '',
    '--skipo-shadow-hover': tokens.shadow?.cardHover || tokens.shadow?.card || '',
    '--skipo-shadow-btn': tokens.shadow?.btn || tokens.shadow?.card || '',
    '--skipo-shadow-btn-hover': tokens.shadow?.btnHover || tokens.shadow?.card || '',
    '--skipo-shadow-btn-active': tokens.shadow?.btnActive || 'none',
    '--skipo-success': tokens.status?.success || '#10b981',
    '--skipo-success-fg': tokens.status?.successFg || '#000000',
    '--skipo-danger': tokens.status?.danger || '#ef4444',
    '--skipo-danger-fg': tokens.status?.dangerFg || '#ffffff',
    '--skipo-warning': tokens.status?.warning || '#f59e0b',
    '--skipo-warning-fg': tokens.status?.warningFg || '#000000',
    '--skipo-info': tokens.status?.info || '#3b82f6',
    '--skipo-info-fg': tokens.status?.infoFg || '#ffffff',
    '--skipo-top-toolbar-bg': tokens.shell?.topToolbarBg || tokens.bg?.surface || '',
    '--skipo-bottom-strip-bg': tokens.shell?.bottomStripBg || tokens.bg?.surface || '',
    '--skipo-inspection-text-color': tokens.shell?.inspectionTextTranslucent || tokens.text?.muted || ''
  };
}