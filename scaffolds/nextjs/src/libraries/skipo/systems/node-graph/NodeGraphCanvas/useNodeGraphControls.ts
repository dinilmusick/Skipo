'use client';
import type React from 'react';
import { useRef, useState, useEffect, useCallback } from 'react';
import type { GraphNode, GraphEdge, NodeGraphConfig, ViewportState } from '../types.js';
import { isNodeInCenterDeadZone, getCenterPanForNode } from '../Viewport.js';
import { getNodesInSelection } from '../BoxSelection.js';

interface UseControlsProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: ViewportState;
  config?: NodeGraphConfig;
  selectedNodeIds: Set<string>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  lastMousePos: React.MutableRefObject<{ screenX: number; screenY: number }>;
  onNodesChange?: (nodes: GraphNode[]) => void;
  onEdgesChange?: (edges: GraphEdge[]) => void;
  onViewportChange?: (viewport: ViewportState) => void;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  setBoxSelection: any;
  boxSelection: { startX: number; startY: number; endX: number; endY: number } | null;
  setSpawnMenuState: (state: { x: number; y: number; graphX: number; graphY: number } | null) => void;
  setContextMenu: (state: { x: number; y: number; graphX: number; graphY: number } | null) => void;
  setPickerState: (state: any) => void;
  setConnecting: any;
  connecting: any;
}

export function useNodeGraphControls({
  nodes, edges, viewport, config, selectedNodeIds, containerRef, lastMousePos,
  onNodesChange, onEdgesChange, onViewportChange, onSelectionChange,
  setBoxSelection, boxSelection, setSpawnMenuState, setContextMenu, setPickerState, setConnecting, connecting
}: UseControlsProps) {
  const [isPanning, setIsPanning] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const nodeMouseDownPos = useRef<{ x: number; y: number; nodeId: string } | null>(null);
  const hasDraggedNode = useRef(false);
  const animFrameRef = useRef<number | null>(null);

  const smoothPanTo = useCallback((targetX: number, targetY: number) => {
    if (!onViewportChange) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const startX = viewport.panX;
    const startY = viewport.panY;
    const startTime = performance.now();
    const duration = 220;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      onViewportChange({
        ...viewport,
        panX: Math.round(startX + (targetX - startX) * ease),
        panY: Math.round(startY + (targetY - startY) * ease)
      });
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        animFrameRef.current = null;
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, [viewport, onViewportChange]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (!isInput) {
          e.preventDefault();
          const rect = containerRef.current?.getBoundingClientRect();
          const screenX = lastMousePos.current.screenX || (rect ? rect.width / 2 : 250);
          const screenY = lastMousePos.current.screenY || (rect ? rect.height / 2 : 200);
          const graphX = (screenX - viewport.panX) / viewport.zoom;
          const graphY = (screenY - viewport.panY) / viewport.zoom;
          setContextMenu(null);
          setPickerState(null);
          setSpawnMenuState({ x: screenX, y: screenY, graphX, graphY });
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        onSelectionChange?.(new Set(nodes.map(n => n.id)));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.size > 0 && onNodesChange) {
          const remainingNodes = nodes.filter(n => !selectedNodeIds.has(n.id));
          onNodesChange(remainingNodes);
          onEdgesChange?.(edges.filter(ed => !selectedNodeIds.has(ed.source) && !selectedNodeIds.has(ed.target)));
          onSelectionChange?.(new Set());
        }
      } else if (e.key === 'Escape') {
        setContextMenu(null);
        setPickerState(null);
        setSpawnMenuState(null);
        setConnecting(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, selectedNodeIds, viewport, onNodesChange, onEdgesChange, onSelectionChange, containerRef, lastMousePos]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!onViewportChange) return;
    const zoomDelta = e.deltaY * -0.001;
    const minZoom = config?.minZoom ?? 0.25;
    const maxZoom = config?.maxZoom ?? 2.5;
    const newZoom = Math.max(minZoom, Math.min(maxZoom, viewport.zoom + zoomDelta));
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const graphX = (mouseX - viewport.panX) / viewport.zoom;
    const graphY = (mouseY - viewport.panY) / viewport.zoom;
    onViewportChange({ zoom: newZoom, panX: mouseX - graphX * newZoom, panY: mouseY - graphY * newZoom });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setContextMenu(null);
    setSpawnMenuState(null);
    if (e.button === 1) {
      setIsPanning(true);
      return;
    }
    if (e.button === 0 && e.target === containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setBoxSelection({ startX: x, startY: y, endX: x, endY: y });
      onSelectionChange?.(new Set());
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      lastMousePos.current = { screenX: e.clientX - r.left, screenY: e.clientY - r.top };
    }
    if (isPanning && onViewportChange) {
      onViewportChange({ ...viewport, panX: viewport.panX + e.movementX, panY: viewport.panY + e.movementY });
      return;
    }
    if (boxSelection && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setBoxSelection(prev => prev ? { ...prev, endX: e.clientX - rect.left, endY: e.clientY - rect.top } : null);
      return;
    }
    if (dragNodeId && onNodesChange) {
      if (nodeMouseDownPos.current) {
        const dist = Math.hypot(e.clientX - nodeMouseDownPos.current.x, e.clientY - nodeMouseDownPos.current.y);
        if (dist > 4) {
          hasDraggedNode.current = true;
        }
      }
      const dx = e.movementX / viewport.zoom;
      const dy = e.movementY / viewport.zoom;
      onNodesChange(nodes.map(n => n.id === dragNodeId ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n));
      return;
    }
    if (connecting && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setConnecting((prev: any) => prev ? { ...prev, endX: e.clientX - rect.left, endY: e.clientY - rect.top } : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);

    if (nodeMouseDownPos.current && !hasDraggedNode.current) {
      const clickedId = nodeMouseDownPos.current.nodeId;
      const clickedNode = nodes.find(n => n.id === clickedId);
      if (clickedNode && containerRef.current && onViewportChange) {
        const rect = containerRef.current.getBoundingClientRect();
        if (!isNodeInCenterDeadZone(clickedNode, viewport, rect.width, rect.height)) {
          const targetPan = getCenterPanForNode(clickedNode, viewport, rect.width, rect.height);
          smoothPanTo(targetPan.panX, targetPan.panY);
        }
      }
    }

    nodeMouseDownPos.current = null;
    hasDraggedNode.current = false;
    setDragNodeId(null);
    if (boxSelection) {
      const selected = getNodesInSelection(boxSelection.startX, boxSelection.startY, boxSelection.endX, boxSelection.endY, nodes, viewport);
      onSelectionChange?.(new Set(selected));
      setBoxSelection(null);
    }
    if (connecting && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const dropY = e.clientY - rect.top;
      const graphX = (dropX - viewport.panX) / viewport.zoom;
      const graphY = (dropY - viewport.panY) / viewport.zoom;
      setPickerState({
        x: dropX, y: dropY, graphX, graphY,
        sourceHandle: { nodeId: connecting.nodeId, socketId: connecting.socketId, direction: connecting.type, dataType: connecting.dataType }
      });
      setConnecting(null);
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.button === 0) {
      nodeMouseDownPos.current = { x: e.clientX, y: e.clientY, nodeId };
      hasDraggedNode.current = false;
      setDragNodeId(nodeId);
      if (e.metaKey || e.ctrlKey) {
        const next = new Set(selectedNodeIds);
        if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
        onSelectionChange?.(next);
      } else if (!selectedNodeIds.has(nodeId)) {
        onSelectionChange?.(new Set([nodeId]));
      }
    }
  };

  return {
    isPanning, dragNodeId, smoothPanTo, handleWheel,
    handleMouseDown, handleMouseMove, handleMouseUp, handleNodeMouseDown
  };
}
