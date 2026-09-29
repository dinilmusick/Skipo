/**
 * ASCII Architecture Flowchart: typography
 *
 *   ┌──────────────────────────────────┐
 *   │      Initialize typography       │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │          darkTypography          │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │         lightTypography          │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │  Return State / Result Payload   │
 *   └──────────────────────────────────┘
 */

import type { ThemeTypographyDefinition } from '../../schema/typography.schema.js';

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════


// ════ TYPOGRAPHY IMPLEMENTATION ═══════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export const darkTypography: ThemeTypographyDefinition = {
  globalFont: "'Courier Prime', monospace",
  globalMonoFont: "'JetBrains Mono', monospace",
  globalColor: 'var(--skipo-text-primary, #ffffff)',
  globalAccentColor: 'var(--skipo-accent, #d4af37)',
  headingFont: "'Courier Prime', monospace",
  bodyFont: "'Courier Prime', monospace",
  codeFont: "'JetBrains Mono', monospace",
  sections: {
    h1: { fontSize: '28px', fontWeight: '800', lineHeight: '1.2', color: 'var(--skipo-accent, #d4af37)', borderBottom: '2px solid rgba(212, 175, 55, 0.4)' },
    h2: { fontSize: '22px', fontWeight: '700', lineHeight: '1.3', color: 'var(--skipo-text-primary, #ffffff)', borderBottom: '1px solid rgba(212, 175, 55, 0.2)' },
    h3: { fontSize: '18px', fontWeight: '700', lineHeight: '1.4', color: 'var(--skipo-text-primary, #ffffff)' },
    h4: { fontSize: '16px', fontWeight: '600', lineHeight: '1.4', color: 'var(--skipo-accent, #d4af37)' },
    h5: { fontSize: '14px', fontWeight: '600', lineHeight: '1.4', color: 'var(--skipo-text-primary, #ffffff)' },
    h6: { fontSize: '13px', fontWeight: '600', lineHeight: '1.4', color: '#A0A0B0' },
    p: { fontSize: '15px', lineHeight: '1.6', color: 'var(--skipo-text-primary, #ffffff)' },
    blockquote: { fontStyle: 'italic', color: 'var(--skipo-accent, #d4af37)', bg: 'rgba(212, 175, 55, 0.08)', borderLeftColor: 'var(--skipo-accent, #d4af37)', borderLeftWidth: '4px' },
    ul: { markerColor: 'var(--skipo-accent, #d4af37)', spacing: '6px' },
    ol: { markerColor: 'var(--skipo-accent, #d4af37)', spacing: '6px' },
    inlineCode: { fontSize: '13px', color: 'var(--skipo-accent, #d4af37)', bg: 'rgba(212, 175, 55, 0.15)', border: '1px solid rgba(212, 175, 55, 0.3)', radius: '3px' },
    codeBlock: { fontSize: '13px', color: 'var(--skipo-text-primary, #ffffff)', bg: '#18181C', border: '1px solid #333333', radius: '4px' },
    table: { headerBg: 'var(--skipo-accent, #d4af37)', headerColor: 'var(--skipo-surface-background, #121214)', border: '1px solid #333333', cellBg: 'var(--skipo-surface, #1e1e24)' },
    link: { color: 'var(--skipo-accent, #d4af37)', textDecoration: 'none', hoverColor: 'var(--skipo-text-primary, #ffffff)', hoverUnderline: true },
    hr: { color: 'var(--skipo-accent, #d4af37)', borderStyle: 'solid', height: '2px' }
  }
};

export const lightTypography: ThemeTypographyDefinition = {
  globalFont: "'Courier Prime', monospace",
  globalMonoFont: "'JetBrains Mono', monospace",
  globalColor: '#18181A',
  globalAccentColor: '#B58900',
  headingFont: "'Courier Prime', monospace",
  bodyFont: "'Courier Prime', monospace",
  codeFont: "'JetBrains Mono', monospace",
  sections: {
    h1: { fontSize: '28px', fontWeight: '800', lineHeight: '1.2', color: '#B58900', borderBottom: '2px solid rgba(181, 137, 0, 0.35)' },
    h2: { fontSize: '22px', fontWeight: '700', lineHeight: '1.3', color: '#18181A', borderBottom: '1px solid rgba(181, 137, 0, 0.2)' },
    h3: { fontSize: '18px', fontWeight: '700', lineHeight: '1.4', color: '#18181A' },
    h4: { fontSize: '16px', fontWeight: '600', lineHeight: '1.4', color: '#B58900' },
    h5: { fontSize: '14px', fontWeight: '600', lineHeight: '1.4', color: '#18181A' },
    h6: { fontSize: '13px', fontWeight: '600', lineHeight: '1.4', color: '#6E6B65' },
    p: { fontSize: '15px', lineHeight: '1.6', color: '#18181A' },
    blockquote: { fontStyle: 'italic', color: '#8A6800', bg: 'rgba(181, 137, 0, 0.08)', borderLeftColor: '#B58900', borderLeftWidth: '4px' },
    ul: { markerColor: '#B58900', spacing: '6px' },
    ol: { markerColor: '#B58900', spacing: '6px' },
    inlineCode: { fontSize: '13px', color: '#8A6800', bg: 'rgba(181, 137, 0, 0.12)', border: '1px solid rgba(181, 137, 0, 0.25)', radius: '3px' },
    codeBlock: { fontSize: '13px', color: '#18181A', bg: '#EDE8DC', border: '1px solid #D4CEBF', radius: '4px' },
    table: { headerBg: '#B58900', headerColor: 'var(--skipo-text-primary, #ffffff)', border: '1px solid #D4CEBF', cellBg: '#F8F6F0' },
    link: { color: '#B58900', textDecoration: 'none', hoverColor: '#705300', hoverUnderline: true },
    hr: { color: '#B58900', borderStyle: 'solid', height: '2px' }
  }
};