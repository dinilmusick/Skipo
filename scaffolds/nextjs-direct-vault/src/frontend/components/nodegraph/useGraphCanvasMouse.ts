// ══════════════════════════════════════════════════════════════════════════════
// GRAPH CANVAS MOUSE & MARQUEE INTERACTION HOOK (Aspect 10 Compliance)
// Controls: Middle pan, Space+Drag, Marquee box selection, World coords tracking
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useNodeGraphStore } from '../../../frontend-state/nodeGraphStore';
import { MouseWorldCoords, MarqueeBox } from './types';

interface UseGraphCanvasMouseProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  mouseWorldRef: React.MutableRefObject<MouseWorldCoords>;
}

export function useGraphCanvasMouse({ containerRef, mouseWorldRef }: UseGraphCanvasMouseProps) {
  const { screenToFlowPosition } = useReactFlow();
  const { nodes, selectNodes } = useNodeGraphStore();
  const [marqueeBox, setMarqueeBox] = useState<MarqueeBox | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    mouseWorldRef.current = flowPos;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only trigger marquee selection on primary button (0) on canvas background
    const isInteractive = (e.target as HTMLElement).closest('.react-flow__node') ||
                          (e.target as HTMLElement).closest('button') ||
                          (e.target as HTMLElement).closest('input');

    if (e.button === 0 && !isInteractive && (e.shiftKey || e.metaKey)) {
      const startX = e.clientX;
      const startY = e.clientY;
      const startFlow = screenToFlowPosition({ x: startX, y: startY });

      const onMouseMove = (ev: MouseEvent) => {
        const currentFlow = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        const minX = Math.min(startFlow.x, currentFlow.x);
        const maxX = Math.max(startFlow.x, currentFlow.x);
        const minY = Math.min(startFlow.y, currentFlow.y);
        const maxY = Math.max(startFlow.y, currentFlow.y);

        setMarqueeBox({ minX, minY, width: maxX - minX, height: maxY - minY });

        const matchedIds = nodes
          .filter((n) => n.position.x < maxX && n.position.x + 180 > minX &&
                         n.position.y < maxY && n.position.y + 80 > minY)
          .map((n) => n.id);

        selectNodes(matchedIds);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        setMarqueeBox(null);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };

  return {
    marqueeBox,
    handleMouseMove,
    handleMouseDown,
  };
}
