'use client';
import { useState, useCallback } from 'react';
import type { GraphNode, GraphEdge, ViewportState, NodeGraphConfig } from './types.js';
import { zoomAtPoint, clampZoom } from './Viewport.js';

export function useNodeGraph(initialNodes: GraphNode[] = [], initialEdges: GraphEdge[] = []) {
  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  const [edges, setEdges] = useState<GraphEdge[]>(initialEdges);
  const [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());

  const addNode = useCallback((node: GraphNode) => {
    setNodes(prev => [...prev, node]);
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeIds(prev => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  const addEdge = useCallback((edge: GraphEdge) => {
    setEdges(prev => [...prev, edge]);
  }, []);

  const removeEdge = useCallback((edgeId: string) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
  }, []);

  const moveNode = useCallback((nodeId: string, x: number, y: number) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, position: { x, y } } : n));
  }, []);

  const updateViewport = useCallback((updates: Partial<ViewportState>) => {
    setViewport(prev => ({ ...prev, ...updates }));
  }, []);

  const handleZoom = useCallback((clientX: number, clientY: number, deltaY: number, config?: NodeGraphConfig) => {
    const zoomDelta = deltaY * -0.001;
    setViewport(prev => zoomAtPoint(clientX, clientY, zoomDelta, prev, config));
  }, []);

  const toJSON = useCallback(() => {
    return { nodes, edges, viewport };
  }, [nodes, edges, viewport]);

  const fromJSON = useCallback((data: { nodes: GraphNode[], edges: GraphEdge[], viewport: ViewportState }) => {
    setNodes(data.nodes || []);
    setEdges(data.edges || []);
    setViewport(data.viewport || { panX: 0, panY: 0, zoom: 1 });
    setSelectedNodeIds(new Set());
  }, []);

  return {
    nodes,
    edges,
    viewport,
    selectedNodeIds,
    setNodes,
    setEdges,
    setSelectedNodeIds,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    moveNode,
    updateViewport,
    handleZoom,
    toJSON,
    fromJSON,
  };
}
