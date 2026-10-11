// ══════════════════════════════════════════════════════════════════════════════
// GRAPH KEYBOARD SHORTCUTS MATRIX HOOK (Aspect 10 & React Flow Standards)
// Controls: Delete, Undo (Cmd+Z), Redo (Cmd+Y), Copy (Cmd+C), Paste (Cmd+V), Select All (Cmd+A), Center (0)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { useNodeGraphStore } from '../../../frontend-state/nodeGraphStore';
import { MouseWorldCoords } from './types';

interface UseGraphHotkeysProps {
  mouseWorldRef: React.RefObject<MouseWorldCoords>;
  onCenterOrigin?: () => void;
}

export function useGraphHotkeys({ mouseWorldRef, onCenterOrigin }: UseGraphHotkeysProps) {
  const {
    deleteSelection,
    undo,
    redo,
    copySelection,
    pasteClipboard,
    selectAll,
    clearSelection,
  } = useNodeGraphStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const keyLower = e.key.toLowerCase();

      // '0' Key: Center Viewport to Origin
      if (e.key === '0' && !isCmdOrCtrl && !e.altKey) {
        e.preventDefault();
        onCenterOrigin?.();
        return;
      }

      // Undo: Cmd/Ctrl + Z
      if (isCmdOrCtrl && keyLower === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Cmd/Ctrl + Y or Cmd/Ctrl + Shift + Z
      if ((isCmdOrCtrl && keyLower === 'y') || (isCmdOrCtrl && e.shiftKey && keyLower === 'z')) {
        e.preventDefault();
        redo();
        return;
      }

      // Delete / Backspace: Remove selected nodes and edges
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
        return;
      }

      // Select All: Cmd/Ctrl + A
      if (isCmdOrCtrl && keyLower === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }

      // Escape: Deselect All
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
        return;
      }

      // Copy: Cmd/Ctrl + C
      if (isCmdOrCtrl && keyLower === 'c') {
        e.preventDefault();
        copySelection();
        return;
      }

      // Paste: Cmd/Ctrl + V
      if (isCmdOrCtrl && keyLower === 'v') {
        e.preventDefault();
        const cursor = mouseWorldRef.current || undefined;
        pasteClipboard(cursor);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelection, undo, redo, copySelection, pasteClipboard, selectAll, clearSelection, mouseWorldRef, onCenterOrigin]);
}
