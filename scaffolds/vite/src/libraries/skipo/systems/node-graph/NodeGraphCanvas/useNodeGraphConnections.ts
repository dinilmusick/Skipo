'use client';
import type React from 'react';
import { useCallback } from 'react';
import type { GraphNode, GraphEdge, Socket } from '../types.js';
import type { NodeDefinition } from '../domain/BaseNode.js';
import { ConnectionRuleStore } from '../rules/ConnectionRuleStore.js';

interface UseConnectionsProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  availableNodeTypes?: NodeDefinition[];
  connecting: any;
  setConnecting: (val: any) => void;
  pickerState: any;
  setPickerState: (val: any) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onNodesChange?: (nodes: GraphNode[]) => void;
  onEdgesChange?: (edges: GraphEdge[]) => void;
}

export function useNodeGraphConnections({
  nodes, edges, availableNodeTypes, connecting, setConnecting, pickerState, setPickerState, containerRef,
  onNodesChange, onEdgesChange
}: UseConnectionsProps) {

  const handleSocketMouseDown = (e: React.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const node = nodes.find(n => n.id === nodeId);
    const socket = (type === 'input' ? node?.inputs : node?.outputs)?.find(s => s.id === socketId);
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setConnecting({ nodeId, socketId, type, dataType: socket?.dataType, startX: x, startY: y, endX: x, endY: y });
  };

  const handleSocketMouseUp = (e: React.MouseEvent, targetNodeId: string, targetSocketId: string, targetType: 'input' | 'output') => {
    e.stopPropagation();
    if (!connecting || connecting.nodeId === targetNodeId || connecting.type === targetType) {
      setConnecting(null);
      return;
    }
    const sourceNode = nodes.find(n => n.id === connecting.nodeId);
    const targetNode = nodes.find(n => n.id === targetNodeId);
    const sourceSocket = (connecting.type === 'output' ? sourceNode?.outputs : sourceNode?.inputs)?.find(s => s.id === connecting.socketId);
    const targetSocket = (targetType === 'input' ? targetNode?.inputs : targetNode?.outputs)?.find(s => s.id === targetSocketId);
    const canConnect = ConnectionRuleStore.canConnect(
      { handleCategory: 'DATA', dataType: sourceSocket?.dataType || 'ANY', direction: connecting.type === 'output' ? 'OUTPUT' : 'INPUT' },
      { handleCategory: 'DATA', dataType: targetSocket?.dataType || 'ANY', direction: targetType === 'input' ? 'INPUT' : 'OUTPUT' }
    );
    if (canConnect) {
      const isOut = connecting.type === 'output';
      const newEdge: GraphEdge = {
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: isOut ? connecting.nodeId : targetNodeId,
        sourceSocket: isOut ? connecting.socketId : targetSocketId,
        target: isOut ? targetNodeId : connecting.nodeId,
        targetSocket: isOut ? targetSocketId : connecting.socketId,
        locked: true
      };
      onEdgesChange?.([...edges, newEdge]);
    }
    setConnecting(null);
  };

  const handlePickerSelect = useCallback((selectedTypes: string[]) => {
    if (!pickerState || !onNodesChange) return;
    const { graphX, graphY, sourceHandle } = pickerState;
    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];
    selectedTypes.forEach((type, idx) => {
      const id = `node-${Date.now()}-${idx}`;
      const posX = graphX + idx * 200;
      const posY = graphY + idx * 40;
      const def = availableNodeTypes?.find(d => d.type === type) || ConnectionRuleStore.getNodeType(type);
      const isSourceOut = sourceHandle.direction === 'output';
      const inputs = def?.inputs?.map(i => ({ id: i.id, label: i.label || i.id, type: 'input' as const, dataType: i.dataType })) ?? [{ id: 'in-1', label: 'In', type: 'input' as const, dataType: sourceHandle.dataType || 'ANY' }];
      const outputs = def?.outputs?.map(o => ({ id: o.id, label: o.label || o.id, type: 'output' as const, dataType: o.dataType })) ?? [{ id: 'out-1', label: 'Out', type: 'output' as const, dataType: sourceHandle.dataType || 'ANY' }];
      newNodes.push({ id, type, label: def?.label || type, position: { x: posX, y: posY }, inputs, outputs });
      const targetSocket = isSourceOut ? inputs[0] : outputs[0];
      if (targetSocket) {
        newEdges.push({
          id: `edge-${Date.now()}-${idx}`,
          source: isSourceOut ? sourceHandle.nodeId : id,
          sourceSocket: isSourceOut ? sourceHandle.socketId : targetSocket.id,
          target: isSourceOut ? id : sourceHandle.nodeId,
          targetSocket: isSourceOut ? targetSocket.id : sourceHandle.socketId,
          locked: true
        });
      }
    });
    onNodesChange([...nodes, ...newNodes]);
    if (newEdges.length > 0) onEdgesChange?.([...edges, ...newEdges]);
    setPickerState(null);
  }, [pickerState, nodes, edges, availableNodeTypes, onNodesChange, onEdgesChange, setPickerState]);

  const handleSocketNudgeChange = (nodeId: string, socketId: string, nudge: { x: number; y: number }) => {
    if (!onNodesChange) return;
    const updatedNodes = nodes.map(n => {
      if (n.id !== nodeId) return n;
      const updateList = (list?: Socket[]) => list?.map(s => s.id === socketId ? { ...s, offset: nudge } : s);
      return {
        ...n,
        inputs: updateList(n.inputs),
        outputs: updateList(n.outputs)
      };
    });
    onNodesChange(updatedNodes);
  };

  return {
    handleSocketMouseDown,
    handleSocketMouseUp,
    handlePickerSelect,
    handleSocketNudgeChange
  };
}
