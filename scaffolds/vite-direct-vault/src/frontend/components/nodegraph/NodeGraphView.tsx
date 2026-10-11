// ══════════════════════════════════════════════════════════════════════════════
// SKIPO CANONICAL NODE GRAPH VIEW (React Flow Canvas + Complete UX Controls)
// Pre-configured with mouse panning, wheel zoom, box selection & full hotkey matrix
// ══════════════════════════════════════════════════════════════════════════════

import React, { useRef, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useNodeGraphStore } from '../../../frontend-state/nodeGraphStore';
import { NodeCard } from './NodeCard';
import { NodeGraphControls } from './NodeGraphControls';
import { useGraphHotkeys } from './useGraphHotkeys';
import { useGraphCanvasMouse } from './useGraphCanvasMouse';
import { MouseWorldCoords } from './types';

const InnerNodeGraph: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseWorldRef = useRef<MouseWorldCoords>({ x: 0, y: 0 });
  const { setCenter } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
  } = useNodeGraphStore();

  const nodeTypes = useMemo(() => ({ customNode: NodeCard }), []);

  const handleCenterOrigin = useCallback(() => {
    setCenter(400, 200, { zoom: 1, duration: 300 });
  }, [setCenter]);

  useGraphHotkeys({
    mouseWorldRef,
    onCenterOrigin: handleCenterOrigin,
  });

  const { marqueeBox, handleMouseMove, handleMouseDown } = useGraphCanvasMouse({
    containerRef,
    mouseWorldRef,
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      style={{ backgroundColor: 'var(--skipo-bg-canvas, #020617)' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        panOnScroll={false}
        zoomOnScroll={true}
        panOnDrag={[1, 2]}
        panActivationKeyCode="Space"
        selectionOnDrag={true}
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
        snapToGrid={true}
        snapGrid={[16, 16]}
        fitView
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="var(--skipo-border-subtle, #334155)"
        />
        <NodeGraphControls onCenterOrigin={handleCenterOrigin} />
      </ReactFlow>

      {/* Marquee Visual Drag Box */}
      {marqueeBox && (
        <div
          className="absolute pointer-events-none border border-sky-400 bg-sky-500/10 z-50 rounded"
          style={{
            left: `${marqueeBox.minX}px`,
            top: `${marqueeBox.minY}px`,
            width: `${marqueeBox.width}px`,
            height: `${marqueeBox.height}px`,
          }}
        />
      )}
    </div>
  );
};

export const NodeGraphView: React.FC = () => {
  return (
    <ReactFlowProvider>
      <InnerNodeGraph />
    </ReactFlowProvider>
  );
};
