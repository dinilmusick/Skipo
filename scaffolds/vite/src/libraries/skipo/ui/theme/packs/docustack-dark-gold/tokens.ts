/**
 * ASCII Architecture Flowchart: tokens
 *
 *   ┌──────────────────────────────────┐
 *   │        Initialize tokens         │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │            darkTokens            │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │           lightTokens            │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │  Return State / Result Payload   │
 *   └──────────────────────────────────┘
 */

import type { SkipoSemanticTokens } from '../../types.js';

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════


// ════ TOKENS IMPLEMENTATION ═══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export const darkTokens: SkipoSemanticTokens = {
  bg: { canvas: '#121214', surface: '#1e1e24', surfaceHover: '#282832', blur: 'blur(16px)' },
  text: { primary: '#ffffff', muted: '#A0A0B0', inverse: '#121214' },
  accent: { primary: '#d4af37', fg: '#000000', glow: '0 0 16px rgba(212, 175, 55, 0.45)', hover: '#c59f2e' },
  border: { color: '#363640', input: '#d4af37', style: '2px solid #363640' },
  radius: { base: '0px', sm: '0px', lg: '0px' },
  shadow: {
    card: '4px 4px 0px #000000', cardHover: '6px 6px 0px #000000',
    btn: '2px 2px 0px #000000', btnHover: '3px 3px 0px #000000', btnActive: '1px 1px 0px #000000'
  },
  font: { sans: "'Courier Prime', monospace", mono: "'JetBrains Mono', monospace" },
  status: {
    success: '#10b981', successFg: '#000000', warning: '#f59e0b', warningFg: '#000000',
    danger: '#ef4444', dangerFg: '#ffffff', info: '#3b82f6', infoFg: '#ffffff'
  },
  shell: {
    topToolbarHeight: '44px', topToolbarBg: 'rgba(18, 18, 20, 0.95)',
    bottomStripHeight: '30px', bottomStripBg: 'rgba(18, 18, 20, 0.95)',
    inspectionTextTranslucent: 'rgba(243, 237, 224, 0.85)'
  }
};

export const lightTokens: SkipoSemanticTokens = {
  bg: { canvas: '#FAF7F0', surface: '#EFE9DC', surfaceHover: '#E4DCCB', blur: 'blur(16px)' },
  text: { primary: '#1A1815', muted: '#6E675C', inverse: '#FAF7F0' },
  accent: { primary: '#B8860B', fg: '#ffffff', glow: '0 0 14px rgba(184, 134, 11, 0.35)', hover: '#996F08' },
  border: { color: '#2C271E', input: '#B8860B', style: '2px solid #2C271E' },
  radius: { base: '0px', sm: '0px', lg: '0px' },
  shadow: {
    card: '4px 4px 0px #2C271E', cardHover: '6px 6px 0px #2C271E',
    btn: '2px 2px 0px #2C271E', btnHover: '3px 3px 0px #2C271E', btnActive: '1px 1px 0px #2C271E'
  },
  font: { sans: "'Courier Prime', monospace", mono: "'JetBrains Mono', monospace" },
  status: {
    success: '#059669', successFg: '#ffffff', warning: '#f59e0b', warningFg: '#000000',
    danger: '#dc2626', dangerFg: '#ffffff', info: '#2563eb', infoFg: '#ffffff'
  },
  shell: {
    topToolbarHeight: '44px', topToolbarBg: '#EFE9DC',
    bottomStripHeight: '30px', bottomStripBg: '#E4DCCB',
    inspectionTextTranslucent: 'rgba(26, 24, 21, 0.85)'
  }
};