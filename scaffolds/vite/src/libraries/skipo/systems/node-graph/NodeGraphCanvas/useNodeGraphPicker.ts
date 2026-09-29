'use client';
import { useState, useRef } from 'react';

export function useNodeGraphPicker() {
  const [pickerState, setPickerState] = useState<{
    x: number; y: number; graphX: number; graphY: number;
    sourceHandle: { nodeId: string; socketId: string; direction: 'input' | 'output'; dataType?: string };
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; graphX: number; graphY: number } | null>(null);
  const [spawnMenuState, setSpawnMenuState] = useState<{ x: number; y: number; graphX: number; graphY: number } | null>(null);
  const lastMousePos = useRef<{ screenX: number; screenY: number }>({ screenX: 0, screenY: 0 });

  return {
    pickerState, setPickerState,
    contextMenu, setContextMenu,
    spawnMenuState, setSpawnMenuState,
    lastMousePos
  };
}
