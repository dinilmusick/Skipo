/**
 * ASCII Architecture Flowchart: elements
 *
 *   ┌──────────────────────────────────┐
 *   │       Initialize elements        │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │           darkElements           │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │          lightElements           │
 *   └──────────────────────────────────┘
 *                    │
 *                    ▼
 *   ┌──────────────────────────────────┐
 *   │  Return State / Result Payload   │
 *   └──────────────────────────────────┘
 */

import type { UIElementThemeValue } from '../../types.js';

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════


// ════ ELEMENTS IMPLEMENTATION ═════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export const darkElements: Record<string, UIElementThemeValue> = {
  canvas: { cssVars: { '--color-base': '#0A0B10', '--skipo-bg': '#0A0B10' }, styles: { backgroundColor: '#0A0B10', color: '#E0F7FC', fontFamily: 'var(--skipo-font-body)' } },
  wallpaperOverlay: { cssVars: { '--wallpaper-overlay-color': '#0A0B10', '--wallpaper-overlay-opacity': '0.75' } },
  topToolbar: { cssVars: { '--color-surface-subtle': '#121520', '--color-border': '#00F0FF' }, styles: { height: '44px', borderBottom: '2px solid #00F0FF', backgroundColor: '#0A0B10' } },
  bottomStrip: { cssVars: { '--skipo-bottom-strip-bg': '#0A0B10' }, styles: { height: '30px', borderTop: '2px solid #00F0FF', fontFamily: 'var(--skipo-font-mono)' } },
  headerBar: { cssVars: { '--color-surface-subtle': '#121520', '--color-border': '#00F0FF' }, styles: { fontFamily: 'var(--skipo-font-heading)' } },
  workspaceTabBar: { cssVars: { '--color-surface': '#121520', '--color-accent': '#00F0FF' } },
  card: { cssVars: { '--color-surface': '#121520', '--color-border': '#00F0FF' }, styles: { border: '2px solid #00F0FF', boxShadow: '4px 4px 0px #000000', fontFamily: 'var(--skipo-font-body)' } },
  buttonPrimary: {
    cssVars: { '--color-accent': '#00F0FF' },
    styles: { backgroundColor: '#00F0FF', color: '#0A0B10', border: '2px solid #000000' },
    effects: { glow: '0 0 15px rgba(0, 240, 255, 0.8)' }
  },
  buttonSecondary: { cssVars: { '--color-accent-secondary': '#FF0055', '--color-surface': '#121520' }, styles: { backgroundColor: '#121520', color: '#E0F7FC', border: '2px solid #00F0FF' } },
  buttonGhost: { styles: { backgroundColor: 'transparent', color: '#E0F7FC', border: 'none' } },
  inputField: { cssVars: { '--color-surface': '#121520', '--color-border': '#00F0FF' }, styles: { border: '2px solid #00F0FF', fontFamily: 'var(--skipo-font-mono)' } },
  selectDropdown: { cssVars: { '--color-surface': '#121520', '--color-text': '#E0F7FC' } },
  badge: { cssVars: { '--color-accent': '#00F0FF' }, styles: { border: '1px solid #00F0FF', fontFamily: 'var(--skipo-font-mono)' } },
  kanbanBoard: { cssVars: { '--color-base': '#0A0B10' } },
  kanbanColumn: { cssVars: { '--color-surface': '#121520', '--color-border': '#00F0FF' }, styles: { border: '2px solid #00F0FF', boxShadow: '4px 4px 0px #000000' } },
  kanbanColumnOverlay: { cssVars: { '--column-overlay-color': '#0A0B10', '--column-overlay-opacity': '0.80' } },
  documentCard: { cssVars: { '--color-surface': '#121520', '--color-border': '#00F0FF' }, styles: { border: '2px solid #00F0FF', boxShadow: '3px 3px 0px #000000' } },
  graphCanvas: { cssVars: { '--color-base': '#0A0B10' } },
  graphNodeRoot: {
    cssVars: { '--color-accent': '#00F0FF' },
    styles: { border: '2px solid #00F0FF' },
    effects: { glow: '0 0 20px rgba(0, 240, 255, 0.9)' }
  },
  graphNodeLeaf: { cssVars: { '--color-surface': '#121520', '--color-border': '#00F0FF' }, styles: { border: '2px solid #00F0FF' } },
  graphEdge: { styles: { stroke: '#00F0FF', strokeWidth: '2px' } },
  codeEditor: { cssVars: { '--color-surface': '#121520' }, styles: { fontFamily: 'var(--skipo-font-code)' } },
  aiChatPanel: { cssVars: { '--color-surface': '#121520', '--color-border': '#00F0FF' }, styles: { border: '2px solid #00F0FF', boxShadow: '6px 6px 0px #000000' } }
};

export const lightElements: Record<string, UIElementThemeValue> = {
  canvas: { cssVars: { '--color-base': '#EBF4F7', '--skipo-bg': '#EBF4F7' }, styles: { backgroundColor: '#EBF4F7', color: '#0B1920', fontFamily: 'var(--skipo-font-body)' } },
  wallpaperOverlay: { cssVars: { '--wallpaper-overlay-color': '#EBF4F7', '--wallpaper-overlay-opacity': '0.65' } },
  topToolbar: { cssVars: { '--color-surface-subtle': '#D4E5ED', '--color-border': '#008C99' }, styles: { height: '44px', borderBottom: '2px solid #008C99', backgroundColor: '#D4E5ED' } },
  bottomStrip: { cssVars: { '--skipo-bottom-strip-bg': '#C2D9E4' }, styles: { height: '30px', borderTop: '2px solid #008C99', fontFamily: 'var(--skipo-font-mono)' } },
  headerBar: { cssVars: { '--color-surface-subtle': '#D4E5ED', '--color-border': '#008C99' }, styles: { fontFamily: 'var(--skipo-font-heading)' } },
  workspaceTabBar: { cssVars: { '--color-surface': '#D4E5ED', '--color-accent': '#008C99' } },
  card: { cssVars: { '--color-surface': '#D4E5ED', '--color-border': '#008C99' }, styles: { border: '2px solid #008C99', boxShadow: '4px 4px 0px #A0B4BE', fontFamily: 'var(--skipo-font-body)' } },
  buttonPrimary: {
    cssVars: { '--color-accent': '#008C99' },
    styles: { backgroundColor: '#008C99', color: '#FFFFFF', border: '2px solid #008C99' },
    effects: { glow: '0 0 12px rgba(0, 140, 153, 0.5)' }
  },
  buttonSecondary: { cssVars: { '--color-accent-secondary': '#D6004C', '--color-surface': '#D4E5ED' }, styles: { backgroundColor: '#D4E5ED', color: '#0B1920', border: '2px solid #008C99' } },
  buttonGhost: { styles: { backgroundColor: 'transparent', color: '#0B1920', border: 'none' } },
  inputField: { cssVars: { '--color-surface': '#D4E5ED', '--color-border': '#008C99' }, styles: { border: '2px solid #008C99', fontFamily: 'var(--skipo-font-mono)' } },
  selectDropdown: { cssVars: { '--color-surface': '#D4E5ED', '--color-text': '#0B1920' } },
  badge: { cssVars: { '--color-accent': '#008C99' }, styles: { border: '1px solid #008C99', fontFamily: 'var(--skipo-font-mono)' } },
  kanbanBoard: { cssVars: { '--color-base': '#EBF4F7' } },
  kanbanColumn: { cssVars: { '--color-surface': '#D4E5ED', '--color-border': '#008C99' }, styles: { border: '2px solid #008C99', boxShadow: '4px 4px 0px #A0B4BE' } },
  kanbanColumnOverlay: { cssVars: { '--column-overlay-color': '#EBF4F7', '--column-overlay-opacity': '0.75' } },
  documentCard: { cssVars: { '--color-surface': '#D4E5ED', '--color-border': '#008C99' }, styles: { border: '2px solid #008C99', boxShadow: '3px 3px 0px #A0B4BE' } },
  graphCanvas: { cssVars: { '--color-base': '#EBF4F7' } },
  graphNodeRoot: {
    cssVars: { '--color-accent': '#008C99' },
    styles: { border: '2px solid #008C99' },
    effects: { glow: '0 0 16px rgba(0, 140, 153, 0.6)' }
  },
  graphNodeLeaf: { cssVars: { '--color-surface': '#D4E5ED', '--color-border': '#008C99' }, styles: { border: '2px solid #008C99' } },
  graphEdge: { styles: { stroke: '#008C99', strokeWidth: '2px' } },
  codeEditor: { cssVars: { '--color-surface': '#D4E5ED' }, styles: { fontFamily: 'var(--skipo-font-code)' } },
  aiChatPanel: { cssVars: { '--color-surface': '#D4E5ED', '--color-border': '#008C99' }, styles: { border: '2px solid #008C99', boxShadow: '6px 6px 0px #A0B4BE' } }
};