/**
 * ASCII Architecture Flowchart: docustackPacks
 *
 *   ┌──────────────────────────────────┐
 *   │    Initialize docustackPacks     │
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
 *   │           darkElements           │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │  Return State / Result Payload   │
 *   └──────────────────────────────────┘
 */

import type { ModularThemePack } from './types.js';

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

const darkTokens = {
  bg: { canvas: 'var(--skipo-surface-background, #121214)', surface: 'var(--skipo-surface, #1e1e24)', surfaceHover: '#26262E', blur: 'blur(16px)' },
  text: { primary: 'var(--skipo-text-primary, #ffffff)', muted: '#A0A0B0', inverse: 'var(--skipo-surface-background, #121214)' },
  accent: { primary: 'var(--skipo-accent, #d4af37)', fg: 'var(--skipo-surface-background, #121214)', glow: '0 0 16px rgba(212, 175, 55, 0.45)', hover: 'var(--skipo-accent, #d4af37)' },
  border: { color: 'var(--skipo-surface-background, #121214)', input: 'var(--skipo-accent, #d4af37)', style: '2px solid #000000' },
  radius: { base: '0px', sm: '0px', lg: '0px' },
  shadow: {
    card: '4px 4px 0px #000000', cardHover: '6px 6px 0px #000000',
    btn: '2px 2px 0px #000000', btnHover: '3px 3px 0px #000000', btnActive: '1px 1px 0px #000000'
  },
  font: { sans: "'Courier Prime', monospace", mono: "'JetBrains Mono', monospace" },
  status: {
    success: 'var(--skipo-success, #2a9d8f)', successFg: 'var(--skipo-surface-background, #121214)', warning: 'var(--skipo-warning, #f59e0b)', warningFg: 'var(--skipo-surface-background, #121214)',
    danger: 'var(--skipo-error, #e76f51)', dangerFg: 'var(--skipo-text-primary, #ffffff)', info: 'var(--skipo-accent, #d4af37)', infoFg: 'var(--skipo-text-primary, #ffffff)'
  },
  shell: {
    topToolbarHeight: '44px', topToolbarBg: 'rgba(18, 18, 20, 0.95)',
    bottomStripHeight: '30px', bottomStripBg: 'rgba(18, 18, 20, 0.95)',
    inspectionTextTranslucent: 'rgba(243, 237, 224, 0.85)'
  }
};

const lightTokens = {
  bg: { canvas: '#F8F6F0', surface: '#EDE8DC', surfaceHover: '#E4DEC0', blur: 'blur(16px)' },
  text: { primary: '#18181A', muted: '#6E6B65', inverse: '#F8F6F0' },
  accent: { primary: '#B58900', fg: 'var(--skipo-text-primary, #ffffff)', glow: '0 0 14px rgba(181, 137, 0, 0.35)', hover: '#997400' },
  border: { color: '#2A2518', input: '#B58900', style: '2px solid #2A2518' },
  radius: { base: '0px', sm: '0px', lg: '0px' },
  shadow: {
    card: '4px 4px 0px #2A2518', cardHover: '6px 6px 0px #2A2518',
    btn: '2px 2px 0px #2A2518', btnHover: '3px 3px 0px #2A2518', btnActive: '1px 1px 0px #2A2518'
  },
  font: { sans: "'Courier Prime', monospace", mono: "'JetBrains Mono', monospace" },
  status: {
    success: '#059669', successFg: 'var(--skipo-text-primary, #ffffff)', warning: 'var(--skipo-warning, #f59e0b)', warningFg: 'var(--skipo-text-primary, #ffffff)',
    danger: 'var(--skipo-error, #e76f51)', dangerFg: 'var(--skipo-text-primary, #ffffff)', info: 'var(--skipo-accent, #d4af37)', infoFg: 'var(--skipo-text-primary, #ffffff)'
  },
  shell: {
    topToolbarHeight: '44px', topToolbarBg: '#EDE8DC',
    bottomStripHeight: '30px', bottomStripBg: '#E4DEC0',
    inspectionTextTranslucent: 'rgba(24, 24, 26, 0.85)'
  }
};

const darkElements = {
  canvas: { cssVars: { '--color-base': 'var(--skipo-surface-background, #121214)', '--skipo-bg': 'var(--skipo-surface-background, #121214)' }, styles: { backgroundColor: 'var(--skipo-surface-background, #121214)', color: 'var(--skipo-text-primary, #ffffff)' } },
  wallpaperOverlay: { cssVars: { '--wallpaper-overlay-color': 'var(--skipo-surface-background, #121214)', '--wallpaper-overlay-opacity': '0.70' }, effects: { transition: 'opacity 0.2s ease-in-out' } },
  topToolbar: { cssVars: { '--color-surface-subtle': '#26262E', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { height: '44px', borderBottom: '2px solid #000000' } },
  bottomStrip: { cssVars: { '--skipo-bottom-strip-bg': 'var(--skipo-surface-background, #121214)' }, styles: { height: '30px', borderTop: '2px solid #000000' } },
  headerBar: { cssVars: { '--color-surface-subtle': '#26262E', '--color-border': 'var(--skipo-surface-background, #121214)' } },
  workspaceTabBar: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-accent': 'var(--skipo-accent, #d4af37)' } },
  card: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { border: '2px solid #000000', boxShadow: '4px 4px 0px #000000' } },
  buttonPrimary: { cssVars: { '--color-accent': 'var(--skipo-accent, #d4af37)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { backgroundColor: 'var(--skipo-accent, #d4af37)', color: 'var(--skipo-surface-background, #121214)', border: '2px solid #000000' }, effects: { transformHover: 'translate(-1px, -1px)', glow: '0 0 10px rgba(212, 175, 55, 0.4)' } },
  buttonSecondary: { cssVars: { '--color-accent-secondary': 'var(--skipo-accent, #d4af37)', '--color-surface': 'var(--skipo-surface, #1e1e24)' }, styles: { backgroundColor: 'var(--skipo-surface, #1e1e24)', color: 'var(--skipo-text-primary, #ffffff)', border: '2px solid #000000' } },
  buttonGhost: { styles: { backgroundColor: 'transparent', color: 'var(--skipo-text-primary, #ffffff)', border: 'none' } },
  inputField: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { border: '2px solid #000000' } },
  selectDropdown: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-text': 'var(--skipo-text-primary, #ffffff)' } },
  badge: { cssVars: { '--color-accent': 'var(--skipo-accent, #d4af37)' }, styles: { border: '1px solid #000000' } },
  kanbanBoard: { cssVars: { '--color-base': 'var(--skipo-surface-background, #121214)' } },
  kanbanColumn: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { border: '2px solid #000000', boxShadow: '4px 4px 0px #000000' } },
  kanbanColumnOverlay: { cssVars: { '--column-overlay-color': 'var(--skipo-surface-background, #121214)', '--column-overlay-opacity': '0.80' } },
  documentCard: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { border: '2px solid #000000', boxShadow: '3px 3px 0px #000000' } },
  graphCanvas: { cssVars: { '--color-base': 'var(--skipo-surface-background, #121214)' } },
  graphNodeRoot: { cssVars: { '--color-accent': 'var(--skipo-accent, #d4af37)' }, styles: { border: '2px solid #000000' }, effects: { glow: '0 0 16px rgba(212, 175, 55, 0.6)' } },
  graphNodeLeaf: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { border: '2px solid #000000' } },
  graphEdge: { styles: { stroke: 'var(--skipo-accent, #d4af37)', strokeWidth: '2px' } },
  codeEditor: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)' }, styles: { fontFamily: "'JetBrains Mono', monospace" } },
  aiChatPanel: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { border: '2px solid #000000', boxShadow: '6px 6px 0px #000000' } }
};

const lightElements = {
  canvas: { cssVars: { '--color-base': '#F8F6F0', '--skipo-bg': '#F8F6F0' }, styles: { backgroundColor: '#F8F6F0', color: '#18181A' } },
  wallpaperOverlay: { cssVars: { '--wallpaper-overlay-color': '#F8F6F0', '--wallpaper-overlay-opacity': '0.65' }, effects: { transition: 'opacity 0.2s ease-in-out' } },
  topToolbar: { cssVars: { '--color-surface-subtle': '#E4DEC0', '--color-border': '#2A2518' }, styles: { height: '44px', borderBottom: '2px solid #2A2518' } },
  bottomStrip: { cssVars: { '--skipo-bottom-strip-bg': '#EDE8DC' }, styles: { height: '30px', borderTop: '2px solid #2A2518' } },
  headerBar: { cssVars: { '--color-surface-subtle': '#E4DEC0', '--color-border': '#2A2518' } },
  workspaceTabBar: { cssVars: { '--color-surface': '#EDE8DC', '--color-accent': '#B58900' } },
  card: { cssVars: { '--color-surface': '#EDE8DC', '--color-border': '#2A2518' }, styles: { border: '2px solid #2A2518', boxShadow: '4px 4px 0px #2A2518' } },
  buttonPrimary: { cssVars: { '--color-accent': '#B58900', '--color-border': '#2A2518' }, styles: { backgroundColor: '#B58900', color: 'var(--skipo-text-primary, #ffffff)', border: '2px solid #2A2518' }, effects: { transformHover: 'translate(-1px, -1px)', glow: '0 0 10px rgba(181, 137, 0, 0.4)' } },
  buttonSecondary: { cssVars: { '--color-accent-secondary': '#997400', '--color-surface': '#EDE8DC' }, styles: { backgroundColor: '#EDE8DC', color: '#18181A', border: '2px solid #2A2518' } },
  buttonGhost: { styles: { backgroundColor: 'transparent', color: '#18181A', border: 'none' } },
  inputField: { cssVars: { '--color-surface': '#EDE8DC', '--color-border': '#2A2518' }, styles: { border: '2px solid #2A2518' } },
  selectDropdown: { cssVars: { '--color-surface': '#EDE8DC', '--color-text': '#18181A' } },
  badge: { cssVars: { '--color-accent': '#B58900' }, styles: { border: '1px solid #2A2518' } },
  kanbanBoard: { cssVars: { '--color-base': '#F8F6F0' } },
  kanbanColumn: { cssVars: { '--color-surface': '#EDE8DC', '--color-border': '#2A2518' }, styles: { border: '2px solid #2A2518', boxShadow: '4px 4px 0px #2A2518' } },
  kanbanColumnOverlay: { cssVars: { '--column-overlay-color': '#F8F6F0', '--column-overlay-opacity': '0.75' } },
  documentCard: { cssVars: { '--color-surface': '#EDE8DC', '--color-border': '#2A2518' }, styles: { border: '2px solid #2A2518', boxShadow: '3px 3px 0px #2A2518' } },
  graphCanvas: { cssVars: { '--color-base': '#F8F6F0' } },
  graphNodeRoot: { cssVars: { '--color-accent': '#B58900' }, styles: { border: '2px solid #2A2518' }, effects: { glow: '0 0 14px rgba(181, 137, 0, 0.5)' } },
  graphNodeLeaf: { cssVars: { '--color-surface': '#EDE8DC', '--color-border': '#2A2518' }, styles: { border: '2px solid #2A2518' } },
  graphEdge: { styles: { stroke: '#997400', strokeWidth: '2px' } },
  codeEditor: { cssVars: { '--color-surface': '#EDE8DC' }, styles: { fontFamily: "'JetBrains Mono', monospace" } },
  aiChatPanel: { cssVars: { '--color-surface': '#EDE8DC', '--color-border': '#2A2518' }, styles: { border: '2px solid #2A2518', boxShadow: '6px 6px 0px #2A2518' } }
};


// ════ DOCUSTACKPACKS IMPLEMENTATION ═══════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export const DOCUSTACK_DARK_GOLD_PACK: ModularThemePack = {
  metadata: {
    id: 'docustack-dark-gold',
    name: 'DocuStack Vault (Dark & Gold)',
    version: '1.0.0',
    mode: 'dark',
    author: 'DocuStack Team',
    description: 'Canonical 2.5D Neo-Brutalist Dark Vault theme with gold accents.'
  },
  variants: {
    dark: { mode: 'dark', tokens: darkTokens, elementStyles: darkElements },
    light: { mode: 'light', tokens: lightTokens, elementStyles: lightElements }
  },
  tokens: darkTokens,
  elementStyles: darkElements
};