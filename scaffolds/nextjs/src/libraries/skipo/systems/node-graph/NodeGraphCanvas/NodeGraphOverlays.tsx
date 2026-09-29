'use client';
import type React from 'react';
import type { GraphNode, GraphEdge } from '../types.js';
import type { NodeDefinition } from '../domain/BaseNode.js';
import { CompatibleNodePicker } from '../ui/widgets/CompatibleNodePicker.js';
import { CanvasContextMenu } from '../ui/widgets/CanvasContextMenu.js';
import { NodeSearchPalette } from '../ui/widgets/NodeSearchPalette.js';
import { ConnectionRuleStore } from '../rules/ConnectionRuleStore.js';

interface NodeGraphOverlaysProps {
  boxSelection: { startX: number; startY: number; endX: number; endY: number } | null;
  pickerState: any;
  setPickerState: (state: any) => void;
  availableNodeTypes?: NodeDefinition[];
  handlePickerSelect: (selectedTypes: string[]) => void;
  contextMenu: { x: number; y: number; graphX: number; graphY: number } | null;
  setContextMenu: (state: any) => void;
  selectedNodeIds: Set<string>;
  nodes: GraphNode[];
  onNodesChange?: (nodes: GraphNode[]) => void;
  edges: GraphEdge[];
  onEdgesChange?: (edges: GraphEdge[]) => void;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  setSpawnMenuState: (state: any) => void;
  spawnMenuState: { x: number; y: number; graphX: number; graphY: number } | null;
}

export function NodeGraphOverlays({
  boxSelection, pickerState, setPickerState, availableNodeTypes, handlePickerSelect,
  contextMenu, setContextMenu, selectedNodeIds, nodes, onNodesChange, edges, onEdgesChange,
  onSelectionChange, setSpawnMenuState, spawnMenuState
}: NodeGraphOverlaysProps) {
  return (
    <>
      {boxSelection && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(boxSelection.startX, boxSelection.endX),
            top: Math.min(boxSelection.startY, boxSelection.endY),
            width: Math.abs(boxSelection.endX - boxSelection.startX),
            height: Math.abs(boxSelection.endY - boxSelection.startY),
            backgroundColor: 'rgba(97, 175, 239, 0.18)',
            border: '1px solid var(--skipo-accent, #61afef)',
            pointerEvents: 'none'
          }}
        />
      )}

      {pickerState && (
        <CompatibleNodePicker
          x={pickerState.x}
          y={pickerState.y}
          sourceHandle={pickerState.sourceHandle}
          availableNodeTypes={availableNodeTypes}
          onSelect={handlePickerSelect}
          onClose={() => setPickerState(null)}
        />
      )}

      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          availableNodeTypes={availableNodeTypes}
          hasSelection={selectedNodeIds.size > 0}
          onSpawnNode={(type) => {
            const def = availableNodeTypes?.find(d => d.type === type) || ConnectionRuleStore.getNodeType(type);
            const id = `node-${Date.now()}`;
            const inputs = def?.inputs?.map(i => ({ id: i.id, label: i.label || i.id, type: 'input' as const, dataType: i.dataType })) ?? [{ id: 'in-1', label: 'In', type: 'input' as const }];
            const outputs = def?.outputs?.map(o => ({ id: o.id, label: o.label || o.id, type: 'output' as const, dataType: o.dataType })) ?? [{ id: 'out-1', label: 'Out', type: 'output' as const }];
            onNodesChange?.([...nodes, { id, type, label: def?.label || type, position: { x: contextMenu.graphX, y: contextMenu.graphY }, inputs, outputs }]);
            setContextMenu(null);
          }}
          onOpenSpawnMenu={() => {
            setSpawnMenuState({
              x: contextMenu.x,
              y: contextMenu.y,
              graphX: contextMenu.graphX,
              graphY: contextMenu.graphY
            });
            setContextMenu(null);
          }}
          onSelectAll={() => {
            onSelectionChange?.(new Set(nodes.map(n => n.id)));
            setContextMenu(null);
          }}
          onDeleteSelected={() => {
            onNodesChange?.(nodes.filter(n => !selectedNodeIds.has(n.id)));
            onEdgesChange?.(edges.filter(ed => !selectedNodeIds.has(ed.source) && !selectedNodeIds.has(ed.target)));
            onSelectionChange?.(new Set());
            setContextMenu(null);
          }}
          onClearSelection={() => {
            onSelectionChange?.(new Set());
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {spawnMenuState && (
        <NodeSearchPalette
          x={spawnMenuState.x}
          y={spawnMenuState.y}
          availableNodeTypes={availableNodeTypes}
          onSpawnNode={(type) => {
            const def = availableNodeTypes?.find(d => d.type === type) || ConnectionRuleStore.getNodeType(type);
            const id = `node-${Date.now()}`;
            const inputs = def?.inputs?.map(i => ({ id: i.id, label: i.label || i.id, type: 'input' as const, dataType: i.dataType })) ?? [{ id: 'in-1', label: 'In', type: 'input' as const }];
            const outputs = def?.outputs?.map(o => ({ id: o.id, label: o.label || o.id, type: 'output' as const, dataType: o.dataType })) ?? [{ id: 'out-1', label: 'Out', type: 'output' as const }];
            onNodesChange?.([...nodes, { id, type, label: def?.label || type, position: { x: spawnMenuState.graphX, y: spawnMenuState.graphY }, inputs, outputs }]);
            setSpawnMenuState(null);
          }}
          onClose={() => setSpawnMenuState(null)}
        />
      )}
    </>
  );
}
