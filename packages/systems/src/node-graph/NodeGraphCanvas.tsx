'use client';
import type React from 'react';
import { useRef, useState } from 'react';
import type { GraphNode, GraphEdge, NodeGraphConfig, ViewportState } from './types.js';
import { NodeCard } from './NodeCard.js';
import { WireRenderer } from './WireRenderer.js';
import { canvasToScreen } from './Viewport.js';
import { getNodesInSelection } from './BoxSelection.js';

interface NodeGraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: ViewportState;
  config?: NodeGraphConfig;
  selectedNodeIds: Set<string>;
  onNodesChange?: (nodes: GraphNode[]) => void;
  onEdgesChange?: (edges: GraphEdge[]) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onViewportChange?: (viewport: ViewportState) => void;
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

export function NodeGraphCanvas({
  nodes,
  edges,
  viewport,
  config,
  selectedNodeIds,
  onNodesChange,
  onEdgesChange: _onEdgesChange,
  onNodeDoubleClick,
  onViewportChange,
  onSelectionChange
}: NodeGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  
  const [boxSelection, setBoxSelection] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const [connecting, setConnecting] = useState<{ nodeId: string, socketId: string, type: 'input'|'output', startX: number, startY: number, endX: number, endY: number } | null>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!onViewportChange) return;
    
    // simplistic zoom logic inline to avoid prop drilling complex dependencies,
    // though ideally it uses the math from Viewport.ts
    const zoomDelta = e.deltaY * -0.001;
    const currentZoom = viewport.zoom;
    let newZoom = currentZoom + zoomDelta;
    const minZoom = config?.minZoom ?? 0.25;
    const maxZoom = config?.maxZoom ?? 2.5;
    newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const graphX = (mouseX - viewport.panX) / currentZoom;
    const graphY = (mouseY - viewport.panY) / currentZoom;

    const panX = mouseX - graphX * newZoom;
    const panY = mouseY - graphY * newZoom;
    
    onViewportChange({ zoom: newZoom, panX, panY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt+Left click
      setIsPanning(true);
      return;
    }
    if (e.button === 0 && e.shiftKey) { // Shift+Left click for marquee selection
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setBoxSelection({
          startX: e.clientX - rect.left,
          startY: e.clientY - rect.top,
          endX: e.clientX - rect.left,
          endY: e.clientY - rect.top,
        });
      }
      return;
    }
    
    // Click on empty space
    if (e.target === containerRef.current) {
      onSelectionChange?.(new Set());
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && onViewportChange) {
      onViewportChange({
        ...viewport,
        panX: viewport.panX + e.movementX,
        panY: viewport.panY + e.movementY,
      });
      return;
    }

    if (boxSelection) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setBoxSelection(prev => prev ? { ...prev, endX: e.clientX - rect.left, endY: e.clientY - rect.top } : null);
      }
      return;
    }

    if (dragNodeId && onNodesChange) {
      const dx = e.movementX / viewport.zoom;
      const dy = e.movementY / viewport.zoom;
      const newNodes = nodes.map(n => n.id === dragNodeId ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n);
      onNodesChange(newNodes);
      return;
    }

    if (connecting) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setConnecting(prev => prev ? { ...prev, endX: e.clientX - rect.left, endY: e.clientY - rect.top } : null);
      }
    }
  };

  const handleMouseUp = (_e: React.MouseEvent) => {
    setIsPanning(false);
    setDragNodeId(null);
    
    if (boxSelection) {
      const selected = getNodesInSelection(
        boxSelection.startX, boxSelection.startY, boxSelection.endX, boxSelection.endY,
        nodes, viewport
      );
      onSelectionChange?.(new Set(selected));
      setBoxSelection(null);
    }

    if (connecting) {
      // Connect logic handled in socket mouse up or dropped on empty space
      setConnecting(null);
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.button === 0) {
      setDragNodeId(nodeId);
      if (!selectedNodeIds.has(nodeId)) {
        onSelectionChange?.(new Set([nodeId]));
      }
    }
  };

  const handleSocketMouseDown = (e: React.MouseEvent, nodeId: string, socketId: string, type: 'input'|'output') => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setConnecting({ nodeId, socketId, type, startX: x, startY: y, endX: x, endY: y });
    }
  };

  // Node data for WireRenderer
  const nodesData = nodes.reduce((acc, node) => {
    const screenPos = canvasToScreen(node.position.x, node.position.y, viewport);
    acc[node.id] = {
      x: screenPos.x,
      y: screenPos.y,
      width: (node.width ?? 150) * viewport.zoom,
      height: (node.height ?? 100) * viewport.zoom,
      inputs: node.inputs || [],
      outputs: node.outputs || []
    };
    return acc;
  }, {} as Record<string, any>);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', backgroundColor: '#1e1e1e' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <WireRenderer 
        edges={edges} 
        nodesData={nodesData} 
        connecting={connecting ? {
          startX: connecting.startX, startY: connecting.startY,
          endX: connecting.endX, endY: connecting.endY
        } : null}
      />
      
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        transformOrigin: '0 0',
        transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`
      }}>
        {nodes.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            selected={selectedNodeIds.has(node.id)}
            onMouseDown={handleNodeMouseDown}
            onDoubleClick={onNodeDoubleClick}
            onSocketMouseDown={handleSocketMouseDown}
          />
        ))}
      </div>

      {boxSelection && (
        <div style={{
          position: 'absolute',
          left: Math.min(boxSelection.startX, boxSelection.endX),
          top: Math.min(boxSelection.startY, boxSelection.endY),
          width: Math.abs(boxSelection.endX - boxSelection.startX),
          height: Math.abs(boxSelection.endY - boxSelection.startY),
          backgroundColor: 'rgba(97, 175, 239, 0.2)',
          border: '1px solid #61afef',
          pointerEvents: 'none'
        }} />
      )}
    </div>
  );
}
