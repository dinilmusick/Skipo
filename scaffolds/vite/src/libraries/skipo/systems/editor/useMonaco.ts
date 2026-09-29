/**
 * ASCII Architecture Flowchart: useMonaco
 *
 *   ┌──────────────────────────────────────┐
 *   │         Initialize useMonaco         │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │  Execute Component / Pipeline Logic  │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │    Return State / Result Payload     │
 *   └──────────────────────────────────────┘
 */

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

'use client';
import { useEffect, useState } from 'react';
import { skipoDarkTheme } from './themes.js';


// ════ USEMONACO IMPLEMENTATION ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export function useMonaco() {
  const [monaco, setMonaco] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    
    // Lazy load monaco
    import('monaco-editor').then(monacoModule => {
      if (!isMounted) return;
      
      // Register custom theme
      monacoModule.editor.defineTheme('skipo-dark', skipoDarkTheme as any);
      
      setMonaco(monacoModule);
    }).catch(err => {
      console.warn('Failed to load monaco-editor', err);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return monaco;
}