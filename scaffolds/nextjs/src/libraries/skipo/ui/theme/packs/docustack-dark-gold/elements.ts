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
  canvas: { cssVars: { '--color-base': 'var(--skipo-surface-background, #121214)', '--skipo-bg': 'var(--skipo-surface-background, #121214)' }, styles: { backgroundColor: 'var(--skipo-surface-background, #121214)', color: 'var(--skipo-text-primary, #ffffff)', fontFamily: 'var(--skipo-font-body)' } },
  wallpaperOverlay: { cssVars: { '--wallpaper-overlay-color': 'var(--skipo-surface-background, #121214)', '--wallpaper-overlay-opacity': '0.70' }, effects: { transition: 'opacity 0.2s ease-in-out' } },
  topToolbar: { cssVars: { '--color-surface-subtle': '#26262E', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { height: '44px', borderBottom: '2px solid #000000' } },
  bottomStrip: { cssVars: { '--skipo-bottom-strip-bg': 'var(--skipo-surface-background, #121214)' }, styles: { height: '30px', borderTop: '2px solid #000000', fontFamily: 'var(--skipo-font-mono)' } },
  headerBar: { cssVars: { '--color-surface-subtle': '#26262E', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { fontFamily: 'var(--skipo-font-heading)' } },
  workspaceTabBar: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-accent': 'var(--skipo-accent, #d4af37)' } },
  card: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { border: '2px solid #000000', boxShadow: '4px 4px 0px #000000', fontFamily: 'var(--skipo-font-body)' } },
  buttonPrimary: { cssVars: { '--color-accent': 'var(--skipo-accent, #d4af37)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { backgroundColor: 'var(--skipo-accent, #d4af37)', color: 'var(--skipo-surface-background, #121214)', border: '2px solid #000000' }, effects: { transformHover: 'translate(-1px, -1px)', glow: '0 0 10px rgba(212, 175, 55, 0.4)' } },
  buttonSecondary: { cssVars: { '--color-accent-secondary': 'var(--skipo-accent, #d4af37)', '--color-surface': 'var(--skipo-surface, #1e1e24)' }, styles: { backgroundColor: 'var(--skipo-surface, #1e1e24)', color: 'var(--skipo-text-primary, #ffffff)', border: '2px solid #000000' } },
  buttonGhost: { styles: { backgroundColor: 'transparent', color: 'var(--skipo-text-primary, #ffffff)', border: 'none' } },
  inputField: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { border: '2px solid #000000', fontFamily: 'var(--skipo-font-mono)' } },
  selectDropdown: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-text': 'var(--skipo-text-primary, #ffffff)' } },
  badge: { cssVars: { '--color-accent': 'var(--skipo-accent, #d4af37)' }, styles: { border: '1px solid #000000', fontFamily: 'var(--skipo-font-mono)' } },
  kanbanBoard: { cssVars: { '--color-base': 'var(--skipo-surface-background, #121214)' } },
  kanbanColumn: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { border: '2px solid #000000', boxShadow: '4px 4px 0px #000000' } },
  kanbanColumnOverlay: { cssVars: { '--column-overlay-color': 'var(--skipo-surface-background, #121214)', '--column-overlay-opacity': '0.80' } },
  documentCard: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { border: '2px solid #000000', boxShadow: '3px 3px 0px #000000' } },
  graphCanvas: { cssVars: { '--color-base': 'var(--skipo-surface-background, #121214)' } },
  graphNodeRoot: { cssVars: { '--color-accent': 'var(--skipo-accent, #d4af37)' }, styles: { border: '2px solid #000000' }, effects: { glow: '0 0 16px rgba(212, 175, 55, 0.6)' } },
  graphNodeLeaf: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { border: '2px solid #000000' } },
  graphEdge: { styles: { stroke: 'var(--skipo-accent, #d4af37)', strokeWidth: '2px' } },
  codeEditor: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)' }, styles: { fontFamily: 'var(--skipo-font-code)' } },
  aiChatPanel: { cssVars: { '--color-surface': 'var(--skipo-surface, #1e1e24)', '--color-border': 'var(--skipo-surface-background, #121214)' }, styles: { border: '2px solid #000000', boxShadow: '6px 6px 0px #000000' } }
};

export const lightElements: Record<string, UIElementThemeValue> = {
  canvas: { cssVars: { '--color-base': '#F8F6F0', '--skipo-bg': '#F8F6F0' }, styles: { backgroundColor: '#F8F6F0', color: '#18181A', fontFamily: 'var(--skipo-font-body)' } },
  wallpaperOverlay: { cssVars: { '--wallpaper-overlay-color': '#F8F6F0', '--wallpaper-overlay-opacity': '0.65' }, effects: { transition: 'opacity 0.2s ease-in-out' } },
  topToolbar: { cssVars: { '--color-surface-subtle': '#E4DEC0', '--color-border': '#2A2518' }, styles: { height: '44px', borderBottom: '2px solid #2A2518' } },
  bottomStrip: { cssVars: { '--skipo-bottom-strip-bg': '#EDE8DC' }, styles: { height: '30px', borderTop: '2px solid #2A2518', fontFamily: 'var(--skipo-font-mono)' } },
  headerBar: { cssVars: { '--color-surface-subtle': '#E4DEC0', '--color-border': '#2A2518' }, styles: { fontFamily: 'var(--skipo-font-heading)' } },
  workspaceTabBar: { cssVars: { '--color-surface': '#EDE8DC', '--color-accent': '#B58900' } },
  card: { cssVars: { '--color-surface': '#EDE8DC', '--color-border': '#2A2518' }, styles: { border: '2px solid #2A2518', boxShadow: '4px 4px 0px #2A2518', fontFamily: 'var(--skipo-font-body)' } },
  buttonPrimary: { cssVars: { '--color-accent': '#B58900', '--color-border': '#2A2518' }, styles: { backgroundColor: '#B58900', color: 'var(--skipo-text-primary, #ffffff)', border: '2px solid #2A2518' }, effects: { transformHover: 'translate(-1px, -1px)', glow: '0 0 10px rgba(181, 137, 0, 0.4)' } },
  buttonSecondary: { cssVars: { '--color-accent-secondary': '#997400', '--color-surface': '#EDE8DC' }, styles: { backgroundColor: '#EDE8DC', color: '#18181A', border: '2px solid #2A2518' } },
  buttonGhost: { styles: { backgroundColor: 'transparent', color: '#18181A', border: 'none' } },
  inputField: { cssVars: { '--color-surface': '#EDE8DC', '--color-border': '#2A2518' }, styles: { border: '2px solid #2A2518', fontFamily: 'var(--skipo-font-mono)' } },
  selectDropdown: { cssVars: { '--color-surface': '#EDE8DC', '--color-text': '#18181A' } },
  badge: { cssVars: { '--color-accent': '#B58900' }, styles: { border: '1px solid #2A2518', fontFamily: 'var(--skipo-font-mono)' } },
  kanbanBoard: { cssVars: { '--color-base': '#F8F6F0' } },
  kanbanColumn: { cssVars: { '--color-surface': '#EDE8DC', '--color-border': '#2A2518' }, styles: { border: '2px solid #2A2518', boxShadow: '4px 4px 0px #2A2518' } },
  kanbanColumnOverlay: { cssVars: { '--column-overlay-color': '#F8F6F0', '--column-overlay-opacity': '0.75' } },
  documentCard: { cssVars: { '--color-surface': '#EDE8DC', '--color-border': '#2A2518' }, styles: { border: '2px solid #2A2518', boxShadow: '3px 3px 0px #2A2518' } },
  graphCanvas: { cssVars: { '--color-base': '#F8F6F0' } },
  graphNodeRoot: { cssVars: { '--color-accent': '#B58900' }, styles: { border: '2px solid #2A2518' }, effects: { glow: '0 0 14px rgba(181, 137, 0, 0.5)' } },
  graphNodeLeaf: { cssVars: { '--color-surface': '#EDE8DC', '--color-border': '#2A2518' }, styles: { border: '2px solid #2A2518' } },
  graphEdge: { styles: { stroke: '#997400', strokeWidth: '2px' } },
  codeEditor: { cssVars: { '--color-surface': '#EDE8DC' }, styles: { fontFamily: 'var(--skipo-font-code)' } },
  aiChatPanel: { cssVars: { '--color-surface': '#EDE8DC', '--color-border': '#2A2518' }, styles: { border: '2px solid #2A2518', boxShadow: '6px 6px 0px #2A2518' } }
};