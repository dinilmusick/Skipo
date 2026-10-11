// ══════════════════════════════════════════════════════════════════════════════
// NODE GRAPH FLOATING TOOLBAR CONTROLS (Aspect 10 Compliance)
// Features: Zoom, Fit, Center, Undo/Redo, Add, Delete with BottomStrip inspection
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  RotateCw,
  Plus,
  Trash2,
  Crosshair,
  HelpCircle,
} from 'lucide-react';
import { useNodeGraphStore } from '../../../frontend-state/nodeGraphStore';
import { BaseButton } from '../ui';

interface NodeGraphControlsProps {
  onCenterOrigin?: () => void;
}

export const NodeGraphControls: React.FC<NodeGraphControlsProps> = ({ onCenterOrigin }) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { undo, redo, addNode, deleteSelection, selectedNodeIds } = useNodeGraphStore();
  const [showHelp, setShowHelp] = useState(false);

  const handleAddNode = () => {
    addNode('PROCESSOR', `Task Node ${Date.now().toString().slice(-4)}`);
  };

  return (
    <div className="absolute top-4 left-4 z-40 flex flex-col gap-2">
      <div
        className="flex items-center gap-1 p-1.5 rounded-lg shadow-lg backdrop-blur-md"
        style={{
          backgroundColor: 'var(--skipo-bg-panel, rgba(15, 23, 42, 0.85))',
          border: '1px solid var(--skipo-border-subtle, #334155)',
        }}
      >
        <BaseButton
          variant="secondary"
          size="sm"
          onClick={() => zoomIn({ duration: 200 })}
          data-skipo-label="Zoom In"
          data-skipo-desc="Increase viewport scale by 15% (Wheel up)"
          className="p-1.5"
        >
          <ZoomIn size={14} />
        </BaseButton>

        <BaseButton
          variant="secondary"
          size="sm"
          onClick={() => zoomOut({ duration: 200 })}
          data-skipo-label="Zoom Out"
          data-skipo-desc="Decrease viewport scale by 15% (Wheel down)"
          className="p-1.5"
        >
          <ZoomOut size={14} />
        </BaseButton>

        <BaseButton
          variant="secondary"
          size="sm"
          onClick={() => fitView({ duration: 300, padding: 0.2 })}
          data-skipo-label="Fit View"
          data-skipo-desc="Frame all existing nodes within viewport"
          className="p-1.5"
        >
          <Maximize2 size={14} />
        </BaseButton>

        {onCenterOrigin && (
          <BaseButton
            variant="secondary"
            size="sm"
            onClick={onCenterOrigin}
            data-skipo-label="Center Origin"
            data-skipo-desc="Pan to root origin coordinates (Shortcut: 0)"
            className="p-1.5"
          >
            <Crosshair size={14} />
          </BaseButton>
        )}

        <div className="w-[1px] h-4 mx-1" style={{ backgroundColor: 'var(--skipo-border-subtle, #334155)' }} />

        <BaseButton
          variant="secondary"
          size="sm"
          onClick={undo}
          data-skipo-label="Undo"
          data-skipo-desc="Revert last graph topology change (Cmd+Z)"
          className="p-1.5"
        >
          <RotateCcw size={14} />
        </BaseButton>

        <BaseButton
          variant="secondary"
          size="sm"
          onClick={redo}
          data-skipo-label="Redo"
          data-skipo-desc="Replay previously reverted topology change (Cmd+Y)"
          className="p-1.5"
        >
          <RotateCw size={14} />
        </BaseButton>

        <div className="w-[1px] h-4 mx-1" style={{ backgroundColor: 'var(--skipo-border-subtle, #334155)' }} />

        <BaseButton
          variant="primary"
          size="sm"
          onClick={handleAddNode}
          data-skipo-label="Add Node"
          data-skipo-desc="Spawn a new worker node onto the canvas"
          className="p-1.5"
        >
          <Plus size={14} />
        </BaseButton>

        <BaseButton
          variant="danger"
          size="sm"
          disabled={selectedNodeIds.length === 0}
          onClick={deleteSelection}
          data-skipo-label="Delete Node"
          data-skipo-desc="Remove selected nodes and edges (Del / Backspace)"
          className="p-1.5"
        >
          <Trash2 size={14} />
        </BaseButton>

        <BaseButton
          variant="secondary"
          size="sm"
          onClick={() => setShowHelp(!showHelp)}
          data-skipo-label="Hotkeys Matrix"
          data-skipo-desc="Display keyboard and mouse interaction shortcuts"
          className="p-1.5"
        >
          <HelpCircle size={14} />
        </BaseButton>
      </div>

      {showHelp && (
        <div
          className="p-3 rounded-lg shadow-xl text-xs font-mono space-y-1 w-64 backdrop-blur-md select-none"
          style={{
            backgroundColor: 'var(--skipo-bg-panel, rgba(15, 23, 42, 0.95))',
            border: '1px solid var(--skipo-border-subtle, #334155)',
            color: 'var(--skipo-text-muted, #94a3b8)',
          }}
        >
          <div className="font-bold text-white mb-2 pb-1 border-b border-slate-700">CANVAS SHORTCUTS</div>
          <div className="flex justify-between"><span>Pan:</span><span className="text-sky-400">Middle Click / Space+Drag</span></div>
          <div className="flex justify-between"><span>Zoom:</span><span className="text-sky-400">Mouse Wheel</span></div>
          <div className="flex justify-between"><span>Box Select:</span><span className="text-sky-400">Shift + Drag</span></div>
          <div className="flex justify-between"><span>Undo / Redo:</span><span className="text-sky-400">Cmd+Z / Cmd+Y</span></div>
          <div className="flex justify-between"><span>Copy / Paste:</span><span className="text-sky-400">Cmd+C / Cmd+V</span></div>
          <div className="flex justify-between"><span>Select All:</span><span className="text-sky-400">Cmd+A</span></div>
          <div className="flex justify-between"><span>Delete:</span><span className="text-sky-400">Del / Backspace</span></div>
          <div className="flex justify-between"><span>Center Origin:</span><span className="text-sky-400">0</span></div>
        </div>
      )}
    </div>
  );
};
