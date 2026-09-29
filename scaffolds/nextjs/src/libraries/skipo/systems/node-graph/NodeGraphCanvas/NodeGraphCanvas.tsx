'use client';
import type React from 'react';
import { useRef, useState, useEffect } from 'react';
import type { Socket } from '../types.js';
import type { NodeGraphCanvasProps } from './types.js';
import { NodeCard } from '../NodeCard.js';
import { WireRenderer } from '../WireRenderer.js';
import { canvasToScreen } from '../Viewport.js';
import { ConnectionRuleStore } from '../rules/ConnectionRuleStore.js';
import { useNodeGraphPicker } from './useNodeGraphPicker.js';
import { useNodeGraphControls } from './useNodeGraphControls.js';
import { useNodeGraphConnections } from './useNodeGraphConnections.js';
import { NodeGraphOverlays } from './NodeGraphOverlays.js';

export function NodeGraphCanvas({
  nodes, edges, viewport, config, selectedNodeIds, availableNodeTypes,
  onNodesChange, onEdgesChange, onNodeDoubleClick, onViewportChange, onSelectionChange
}: NodeGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [boxSelection, setBoxSelection] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [connecting, setConnecting] = useState<{
    nodeId: string; socketId: string; type: 'input' | 'output'; dataType?: string; startX: number; startY: number; endX: number; endY: number;
  } | null>(null);

  // Initialize central rules store
  useEffect(() => {
    if (!ConnectionRuleStore.isInitialized()) ConnectionRuleStore.initializeDefaults();
  }, []);

  const {
    pickerState, setPickerState,
    contextMenu, setContextMenu,
    spawnMenuState, setSpawnMenuState,
    lastMousePos
  } = useNodeGraphPicker();

  const {
    isPanning, smoothPanTo, handleWheel,
    handleMouseDown, handleMouseMove, handleMouseUp, handleNodeMouseDown
  } = useNodeGraphControls({
    nodes, edges, viewport, config, selectedNodeIds, containerRef, lastMousePos,
    onNodesChange, onEdgesChange, onViewportChange, onSelectionChange,
    setBoxSelection, boxSelection, setSpawnMenuState, setContextMenu, setPickerState, setConnecting, connecting
  });

  const {
    handleSocketMouseDown, handleSocketMouseUp, handlePickerSelect, handleSocketNudgeChange
  } = useNodeGraphConnections({
    nodes, edges, availableNodeTypes, connecting, setConnecting, pickerState, setPickerState, containerRef,
    onNodesChange, onEdgesChange
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setContextMenu({ x, y, graphX: (x - viewport.panX) / viewport.zoom, graphY: (y - viewport.panY) / viewport.zoom });
  };

  const nodesData = nodes.reduce((acc, node) => {
    const p = canvasToScreen(node.position.x, node.position.y, viewport);
    acc[node.id] = {
      x: p.x,
      y: p.y,
      width: (node.width ?? 150) * viewport.zoom,
      height: (node.height ?? 100) * viewport.zoom,
      inputs: node.inputs || [],
      outputs: node.outputs || [],
      zoom: viewport.zoom
    };
    return acc;
  }, {} as Record<string, any>);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', backgroundColor: 'var(--skipo-surface-dark, #181a1f)' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <WireRenderer
        edges={edges}
        nodesData={nodesData}
        connecting={connecting ? { startX: connecting.startX, startY: connecting.startY, endX: connecting.endX, endY: connecting.endY } : null}
      />
      
      <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` }}>
        {nodes.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            selected={selectedNodeIds.has(node.id)}
            onMouseDown={handleNodeMouseDown}
            onDoubleClick={onNodeDoubleClick}
            onSocketMouseDown={handleSocketMouseDown}
            onSocketMouseUp={handleSocketMouseUp}
            onSocketNudgeChange={handleSocketNudgeChange}
          />
        ))}
      </div>

      <NodeGraphOverlays
        boxSelection={boxSelection}
        pickerState={pickerState}
        setPickerState={setPickerState}
        availableNodeTypes={availableNodeTypes}
        handlePickerSelect={handlePickerSelect}
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        selectedNodeIds={selectedNodeIds}
        nodes={nodes}
        onNodesChange={onNodesChange}
        edges={edges}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        setSpawnMenuState={setSpawnMenuState}
        spawnMenuState={spawnMenuState}
      />
    </div>
  );
}
