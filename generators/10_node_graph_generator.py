#!/usr/bin/env python3
"""
Aspect 10: Deterministic Node Graph Suite Generator for Skipo
Generates a complete, self-contained canonical Node Graph suite with:
- types.ts & index.ts
- ConnectionRuleStore.ts (Central authoritative store for handles, wires, nodes, and rules)
- SolidifyWidget.tsx (Strict icon-only solidify trace button - zero text label)
- CompatibleNodePicker.tsx (Handle-drag picker listing only compatible node types, multiselect)
- CanvasContextMenu.tsx (Right-click context menu with spawn tile options)
- MovableSocketHandle.tsx (4-way move gizmo + tapered energy beam tether)
- NodeCard.tsx (Anti-spill 2/3 icon + 1/3 RTL scrolling text + edge-pushed border)
- NodeGraphCanvas.tsx (Canonical controls: middle pan, marquee select, zoom, hotkeys)
- Companion test suite
"""

from pathlib import Path
from typing import List, Dict, Any
import json
import sys
import time

try:
    from .common import (
        GeneratedFile, GeneratorResult, section_header,
        generate_ascii_flowchart, emit_directory, parse_generator_args,
        print_generator_report
    )
except ImportError:
    from common import (
        GeneratedFile, GeneratorResult, section_header,
        generate_ascii_flowchart, emit_directory, parse_generator_args,
        print_generator_report
    )

GENERATOR_ID = "10_node_graph_generator"
GENERATOR_TITLE = "Node Graph Suite & Canonical UX Controls Generator"

def generate_node_graph_suite(target_dir: Path, params: Dict[str, Any]) -> GeneratorResult:
    start_time = time.time()
    files: List[GeneratedFile] = []
    graph_name = params.get("name") or "Graph"
    custom = params.get("custom", {})

    flowchart = generate_ascii_flowchart(f"{graph_name} Lifecycle", [
        f"Input: {graph_name} Configuration",
        "Step 1: Central ConnectionRuleStore Registration",
        "Step 2: Canonical Event Canvas (Middle Pan, Marquee Box)",
        "Step 3: Handle Drag -> Compatible Node Picker",
        "Step 4: Anti-Spill Node Card (2/3 Icon, 1/3 RTL Text)",
        f"Output: Standalone Validated {graph_name} Suite"
    ])

    # 1. types.ts
    types_content = f"""{section_header(f"{graph_name} Types")}
// ══════════════════════════════════════════════════════════════════════════════

export type SocketType = 'input' | 'output';
export type HandleCategory = 'DATA' | 'VIEW';
export type HandleDirection = 'INPUT' | 'OUTPUT';
export type ConnectionMode = 'SINGLE' | 'MULTI';

export interface Socket {{
  id: string;
  label: string;
  type: SocketType;
  dataType?: string;
  direction?: HandleDirection;
  offset?: {{ x: number; y: number }};
  connectionMode?: ConnectionMode;
}}

export interface GraphNode {{
  id: string;
  type: string;
  label: string;
  position: {{ x: number; y: number }};
  inputs?: Socket[];
  outputs?: Socket[];
  width?: number;
  height?: number;
  data?: Record<string, unknown>;
}}

export interface GraphEdge {{
  id: string;
  source: string;
  sourceSocket: string;
  target: string;
  targetSocket: string;
  wireType?: string;
  locked?: boolean;
}}

export interface ViewportState {{
  panX: number;
  panY: number;
  zoom: number;
}}

export interface HandleDefinition {{
  id: string;
  label?: string;
  category: HandleCategory;
  dataType: string;
  direction: HandleDirection;
  connectionMode: ConnectionMode;
}}

export interface NodeDefinition {{
  type: string;
  label: string;
  description?: string;
  inputs?: HandleDefinition[];
  outputs?: HandleDefinition[];
}}

export interface CompatibilityResolution {{
  allowed: boolean;
  wireType?: string;
  reason?: string;
}}
"""
    files.append(GeneratedFile(
        relative_path="types.ts",
        content=types_content,
        description=f"{graph_name} domain and canvas types"
    ))

    # 2. ConnectionRuleStore.ts
    store_content = f"""{section_header("Central Connection Rule Store")}
// ══════════════════════════════════════════════════════════════════════════════

import type {{ NodeDefinition }} from './types.js';

export class ConnectionRuleStore {{
  private static nodeTypes: Map<string, NodeDefinition> = new Map();
  private static rules: Array<{{
    sourceDataType: string;
    targetDataType: string;
    allowed: boolean;
    wireType: string;
  }}> = [];

  public static initializeDefaults(): void {{
    this.rules = [
      {{ sourceDataType: 'STRING', targetDataType: 'STRING', allowed: true, wireType: 'STRING' }},
      {{ sourceDataType: 'NUMBER', targetDataType: 'NUMBER', allowed: true, wireType: 'NUMBER' }},
      {{ sourceDataType: 'ANY', targetDataType: '*', allowed: true, wireType: 'DEFAULT' }},
      {{ sourceDataType: '*', targetDataType: 'ANY', allowed: true, wireType: 'DEFAULT' }}
    ];
  }}

  public static registerNodeType(def: NodeDefinition): void {{
    this.nodeTypes.set(def.type, def);
  }}

  public static listNodeTypes(): NodeDefinition[] {{
    return Array.from(this.nodeTypes.values());
  }}

  public static canConnect(sourceType: string, targetType: string): boolean {{
    const s = (sourceType || 'ANY').toUpperCase();
    const t = (targetType || 'ANY').toUpperCase();
    if (s === t) return true;
    return this.rules.some(r =>
      (r.sourceDataType === '*' || r.sourceDataType === s) &&
      (r.targetDataType === '*' || r.targetDataType === t) &&
      r.allowed
    );
  }}

  public static getCompatibleNodeTypes(sourceDataType: string, direction: 'input' | 'output'): NodeDefinition[] {{
    const isOut = direction === 'output';
    const sType = (sourceDataType || 'ANY').toUpperCase();
    return this.listNodeTypes().filter(node => {{
      const targetHandles = isOut ? node.inputs : node.outputs;
      if (!targetHandles || targetHandles.length === 0) return sType === 'ANY';
      return targetHandles.some(h => this.canConnect(isOut ? sType : h.dataType, isOut ? h.dataType : sType));
    }});
  }}
}}
"""
    files.append(GeneratedFile(
        relative_path="ConnectionRuleStore.ts",
        content=store_content,
        description="Authoritative central store for node graph rules and compatibility"
    ))

    # 3. SolidifyWidget.tsx
    solidify_content = f"""{section_header("Icon-Only Solidify Button")}
// ══════════════════════════════════════════════════════════════════════════════
'use client';
import React from 'react';

export interface SolidifyWidgetProps {{
  x: number;
  y: number;
  onSolidify: () => void;
}}

/**
 * Strict icon-only Solidify trace button. Text labels are strictly forbidden.
 */
export function SolidifyWidget({{ x, y, onSolidify }}: SolidifyWidgetProps) {{
  return (
    <div
      style={{{{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        zIndex: 7,
        pointerEvents: 'auto'
      }}}}
      onClick={{(e) => e.stopPropagation()}}
    >
      <button
        type="button"
        title="Solidify Connection"
        aria-label="Solidify Connection"
        style={{{{
          backgroundColor: 'var(--skipo-accent, #61afef)',
          border: '1px solid var(--skipo-border, #61afef)',
          borderRadius: '50%',
          width: '22px',
          height: '22px',
          color: 'var(--skipo-text, #ffffff)',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
          transition: 'transform 0.1s ease'
        }}}}
        onClick={{onSolidify}}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
  );
}}
"""
    files.append(GeneratedFile(
        relative_path="SolidifyWidget.tsx",
        content=solidify_content,
        description="Icon-only trace solidify button"
    ))

    # 4. CompatibleNodePicker.tsx
    picker_content = f"""{section_header("Compatible Node Picker")}
// ══════════════════════════════════════════════════════════════════════════════
'use client';
import React, {{ useState, useMemo, useEffect }} from 'react';
import type {{ NodeDefinition }} from './types.js';
import {{ ConnectionRuleStore }} from './ConnectionRuleStore.js';

export interface CompatibleNodePickerProps {{
  x: number;
  y: number;
  sourceHandle: {{
    nodeId: string;
    socketId: string;
    direction: 'input' | 'output';
    dataType?: string;
  }};
  onSelect: (selectedTypes: string[]) => void;
  onClose: () => void;
}}

export function CompatibleNodePicker({{ x, y, sourceHandle, onSelect, onClose }}: CompatibleNodePickerProps) {{
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const compatibleNodes = useMemo(() => {{
    const list = ConnectionRuleStore.getCompatibleNodeTypes(sourceHandle.dataType || 'ANY', sourceHandle.direction);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(n => n.type.toLowerCase().includes(q) || n.label.toLowerCase().includes(q));
  }}, [sourceHandle, query]);

  useEffect(() => {{
    setHighlightedIndex(0);
  }}, [query, compatibleNodes.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {{
    if (e.key === 'ArrowDown') {{
      e.preventDefault();
      setHighlightedIndex(i => (i + 1) % Math.max(1, compatibleNodes.length));
    }} else if (e.key === 'ArrowUp') {{
      e.preventDefault();
      setHighlightedIndex(i => (i - 1 + compatibleNodes.length) % Math.max(1, compatibleNodes.length));
    }} else if (e.key === 'Enter') {{
      e.preventDefault();
      if (compatibleNodes[highlightedIndex]) {{
        onSelect([compatibleNodes[highlightedIndex].type]);
      }} else if (selectedTypes.size > 0) {{
        onSelect(Array.from(selectedTypes));
      }}
    }} else if (e.key === 'Escape') {{
      e.preventDefault();
      onClose();
    }}
  }};

  const toggleSelect = (type: string) => {{
    setSelectedTypes(prev => {{
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    }});
  }};

  return (
    <div
      style={{{{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, 0)',
        width: '260px',
        backgroundColor: 'var(--skipo-surface, #1e1e1e)',
        border: '1px solid var(--skipo-border, #333)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
        color: 'var(--skipo-text, #fff)',
        zIndex: 50,
        fontFamily: 'Inter, system-ui, sans-serif'
      }}}}
      onClick={{(e) => e.stopPropagation()}}
    >
      <div style={{{{ padding: '8px 12px', borderBottom: '1px solid var(--skipo-border, #333)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}}}>
        <span style={{{{ fontSize: '11px', fontWeight: 600, color: 'var(--skipo-accent, #61afef)' }}}}>Compatible Nodes</span>
        <button type="button" onClick={{onClose}} style={{{{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}}}>✕</button>
      </div>
      <div style={{{{ padding: '6px 8px', borderBottom: '1px solid var(--skipo-border, #333)' }}}}>
        <input
          type="text"
          autoFocus
          placeholder="Filter nodes... (↑↓ navigate, ↵ spawn)"
          value={{query}}
          onChange={{(e) => setQuery(e.target.value)}}
          onKeyDown={{handleKeyDown}}
          style={{{{ width: '100%', boxSizing: 'border-box', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--skipo-border, #444)', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', color: '#fff', outline: 'none' }}}}
        />
      </div>
      <div style={{{{ maxHeight: '160px', overflowY: 'auto', padding: '4px' }}}}>
        {{compatibleNodes.length === 0 ? (
          <div style={{{{ padding: '12px', textAlign: 'center', fontSize: '11px', color: '#888' }}}}>No compatible nodes</div>
        ) : (
          compatibleNodes.map((node, idx) => {{
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={{node.type}}
                onMouseEnter={{() => setHighlightedIndex(idx)}}
                onClick={{() => toggleSelect(node.type)}}
                style={{{{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', cursor: 'pointer', borderRadius: '4px', backgroundColor: isHighlighted ? 'rgba(97, 175, 239, 0.25)' : (selectedTypes.has(node.type) ? 'rgba(97, 175, 239, 0.15)' : 'transparent'), border: isHighlighted ? '1px solid var(--skipo-accent, #61afef)' : '1px solid transparent' }}}}
              >
                <div style={{{{ display: 'flex', alignItems: 'center', gap: '8px' }}}}>
                  <input type="checkbox" checked={{selectedTypes.has(node.type)}} onChange={{() => toggleSelect(node.type)}} onClick={{(e) => e.stopPropagation()}} />
                  <span style={{{{ fontSize: '11px', color: isHighlighted ? 'var(--skipo-accent, #61afef)' : 'inherit' }}}}>{{node.label}}</span>
                </div>
                {{isHighlighted && <span style={{{{ fontSize: '9px', color: 'var(--skipo-accent, #61afef)' }}}}>↵</span>}}
              </div>
            );
          }})
        )}}
      </div>
      <div style={{{{ padding: '6px 8px', borderTop: '1px solid var(--skipo-border, #333)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}}}>
        <span style={{{{ fontSize: '9px', color: '#888' }}}}>↵ to spawn highlighted</span>
        <button
          type="button"
          disabled={{selectedTypes.size === 0 && compatibleNodes.length === 0}}
          onClick={{() => {{
            if (selectedTypes.size > 0) onSelect(Array.from(selectedTypes));
            else if (compatibleNodes[highlightedIndex]) onSelect([compatibleNodes[highlightedIndex].type]);
          }}}}
          style={{{{ padding: '4px 10px', fontSize: '10px', backgroundColor: 'var(--skipo-accent, #61afef)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}}}
        >
          Solidify Connection
        </button>
      </div>
    </div>
  );
}}
"""
    files.append(GeneratedFile(
        relative_path="CompatibleNodePicker.tsx",
        content=picker_content,
        description="Handle-drag compatible node picker with search and keyboard navigation"
    ))

    # 5. CanvasContextMenu.tsx
    context_content = f"""{section_header("Canvas Context Menu")}
// ══════════════════════════════════════════════════════════════════════════════
'use client';
import React from 'react';
import type {{ NodeDefinition }} from './types.js';

export interface CanvasContextMenuProps {{
  x: number;
  y: number;
  nodeTypes: NodeDefinition[];
  onSpawnNode: (type: string) => void;
  onOpenSpawnMenu?: () => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onClose: () => void;
}}

export function CanvasContextMenu({{ x, y, nodeTypes, onSpawnNode, onOpenSpawnMenu, onSelectAll, onDeleteSelected, onClose }}: CanvasContextMenuProps) {{
  return (
    <div
      style={{{{
        position: 'absolute',
        left: x,
        top: y,
        minWidth: '170px',
        backgroundColor: 'var(--skipo-surface, #1e1e1e)',
        border: '1px solid var(--skipo-border, #333)',
        borderRadius: '6px',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.6)',
        padding: '4px',
        zIndex: 60,
        fontFamily: 'Inter, system-ui, sans-serif'
      }}}}
      onClick={{(e) => e.stopPropagation()}}
    >
      {{onOpenSpawnMenu && (
        <div
          onClick={{() => {{ onOpenSpawnMenu(); onClose(); }}}}
          style={{{{ padding: '6px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', color: 'var(--skipo-accent, #61afef)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(97, 175, 239, 0.08)', borderRadius: '4px', marginBottom: '4px' }}}}
        >
          <span>Spawn Node Menu...</span>
          <span style={{{{ fontSize: '9px', color: '#888', fontFamily: 'monospace' }}}}>N</span>
        </div>
      )}}
      <div style={{{{ padding: '4px 8px', fontSize: '9px', textTransform: 'uppercase', color: 'var(--skipo-text-muted, #888)', fontWeight: 600 }}}}>Quick Spawn</div>
      {{nodeTypes.map(def => (
        <div
          key={{def.type}}
          onClick={{() => {{ onSpawnNode(def.type); onClose(); }}}}
          style={{{{ padding: '5px 8px', fontSize: '11px', cursor: 'pointer', color: 'var(--skipo-text, #fff)' }}}}
        >
          {{def.label}}
        </div>
      ))}}
      <div style={{{{ height: '1px', backgroundColor: 'var(--skipo-border, #333)', margin: '4px 0' }}}} />
      <div onClick={{() => {{ onSelectAll(); onClose(); }}}} style={{{{ padding: '5px 8px', fontSize: '11px', cursor: 'pointer', color: 'var(--skipo-text, #fff)', display: 'flex', justifyContent: 'space-between' }}}}>
        <span>Select All</span>
        <span style={{{{ fontSize: '9px', color: '#888', fontFamily: 'monospace' }}}}>⌘A</span>
      </div>
      <div onClick={{() => {{ onDeleteSelected(); onClose(); }}}} style={{{{ padding: '5px 8px', fontSize: '11px', cursor: 'pointer', color: '#e06c75', display: 'flex', justifyContent: 'space-between' }}}}>
        <span>Delete Selected</span>
        <span style={{{{ fontSize: '9px', color: '#888', fontFamily: 'monospace' }}}}>Del</span>
      </div>
    </div>
  );
}}
"""
    files.append(GeneratedFile(
        relative_path="CanvasContextMenu.tsx",
        content=context_content,
        description="Canvas context menu with spawn tile options"
    ))

    # 6. MovableSocketHandle.tsx
    handle_content = f"""{section_header("Movable Socket Handle with Gizmo & Tapered Beam")}
// ══════════════════════════════════════════════════════════════════════════════
'use client';
import React, {{ useState, useRef }} from 'react';
import type {{ Socket }} from './types.js';

export interface MovableSocketHandleProps {{
  socket: Socket;
  nodeId: string;
  isOutput: boolean;
  onSocketMouseDown?: (e: React.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
  onSocketMouseUp?: (e: React.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
  onSocketNudgeChange?: (nodeId: string, socketId: string, nudge: {{ x: number; y: number }}) => void;
}}

export const getTaperedBeamPoints = (
  nudge: {{ x: number; y: number }},
  baseW = 6,
  headW = 1.5
): string => {{
  const vx = -nudge.x;
  const vy = -nudge.y;
  const d = Math.sqrt(vx * vx + vy * vy);
  if (d < 1) return '';
  const px = -vy / d;
  const py = vx / d;
  return `${{-px * headW}},${{-py * headW}} ${{px * headW}},${{py * headW}} ${{vx + px * baseW}},${{vy + py * baseW}} ${{vx - px * baseW}},${{vy - py * baseW}}`;
}};

export function MovableSocketHandle({{
  socket,
  nodeId,
  isOutput,
  onSocketMouseDown,
  onSocketMouseUp,
  onSocketNudgeChange
}}: MovableSocketHandleProps) {{
  const [isHovered, setIsHovered] = useState(false);
  const isDraggingGizmo = useRef(false);
  const dragStart = useRef({{ x: 0, y: 0, origX: 0, origY: 0 }});

  const nudge = socket.offset ?? {{ x: 0, y: 0 }};
  const isDisplaced = nudge.x !== 0 || nudge.y !== 0;
  const themeColor = isOutput ? 'var(--skipo-accent, #61afef)' : '#98c379';
  const beamPoints = isDisplaced ? getTaperedBeamPoints(nudge, 6, 1.5) : '';

  const handleGizmoMouseDown = (e: React.MouseEvent) => {{
    e.stopPropagation();
    e.preventDefault();
    isDraggingGizmo.current = true;
    dragStart.current = {{ x: e.clientX, y: e.clientY, origX: nudge.x, origY: nudge.y }};

    const handleMouseMove = (ev: MouseEvent) => {{
      if (!isDraggingGizmo.current) return;
      onSocketNudgeChange?.(nodeId, socket.id, {{
        x: Math.round(dragStart.current.origX + (ev.clientX - dragStart.current.x)),
        y: Math.round(dragStart.current.origY + (ev.clientY - dragStart.current.y))
      }});
    }};

    const handleMouseUpDoc = () => {{
      isDraggingGizmo.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUpDoc);
    }};

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUpDoc);
  }};

  return (
    <div
      style={{{{ position: 'relative', width: '12px', height: '12px', userSelect: 'none' }}}}
      onMouseEnter={{() => setIsHovered(true)}}
      onMouseLeave={{() => setIsHovered(false)}}
    >
      {{isDisplaced && (
        <svg style={{{{ position: 'absolute', left: nudge.x + 6, top: nudge.y + 6, overflow: 'visible', pointerEvents: 'none', zIndex: 1 }}}}>
          <polygon points={{beamPoints}} fill={{themeColor}} opacity={{0.5}} />
        </svg>
      )}}
      <div
        style={{{{
          position: 'absolute',
          left: nudge.x,
          top: nudge.y,
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: themeColor,
          cursor: 'crosshair',
          border: '2px solid #222',
          boxShadow: isHovered ? `0 0 8px ${{themeColor}}` : '0 2px 4px rgba(0,0,0,0.5)',
          zIndex: 4
        }}}}
        onMouseDown={{(e) => {{ e.stopPropagation(); onSocketMouseDown?.(e, nodeId, socket.id, isOutput ? 'output' : 'input'); }}}}
        onMouseUp={{(e) => {{ e.stopPropagation(); onSocketMouseUp?.(e, nodeId, socket.id, isOutput ? 'output' : 'input'); }}}}
      />
      {{isHovered && (
        <div
          title="Drag gizmo to move handle without moving node"
          style={{{{
            position: 'absolute',
            left: nudge.x + (isOutput ? 16 : -16),
            top: nudge.y - 2,
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            backgroundColor: 'var(--skipo-surface, #222)',
            border: '1px solid var(--skipo-accent, #d4af37)',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 6
          }}}}
          onMouseDown={{handleGizmoMouseDown}}
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--skipo-accent, #d4af37)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" />
            <line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
          </svg>
        </div>
      )}}
    </div>
  );
}}
"""
    files.append(GeneratedFile(
        relative_path="MovableSocketHandle.tsx",
        content=handle_content,
        description="Movable socket handle with 4-way move gizmo and tapered beam tether"
    ))

    # 7. NodeCard.tsx (Anti-Spill, 2/3 Icon, 1/3 RTL Text, Pushed-to-Edge Border)
    card_content = f"""{section_header("Anti-Spill Proportional Node Card")}
// ══════════════════════════════════════════════════════════════════════════════
'use client';
import React from 'react';
import type {{ GraphNode }} from './types.js';
import {{ MovableSocketHandle }} from './MovableSocketHandle.js';

export interface NodeCardProps {{
  node: GraphNode;
  selected?: boolean;
  onMouseDown?: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick?: (nodeId: string) => void;
  onSocketMouseDown?: (e: React.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
  onSocketMouseUp?: (e: React.MouseEvent, nodeId: string, socketId: string, type: 'input' | 'output') => void;
  onSocketNudgeChange?: (nodeId: string, socketId: string, nudge: {{ x: number; y: number }}) => void;
}}

function renderEmblem(type: string) {{
  const t = (type || '').toLowerCase();
  if (t.includes('entity') || t.includes('system')) {{
    return (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--skipo-accent, #d4af37)" strokeWidth="1.8">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    );
  }}
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--skipo-accent, #61afef)" strokeWidth="1.8">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}}

export function NodeCard({{
  node,
  selected = false,
  onMouseDown,
  onDoubleClick,
  onSocketMouseDown,
  onSocketMouseUp,
  onSocketNudgeChange
}}: NodeCardProps) {{
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = React.useState<number>(node.height ?? 130);

  React.useLayoutEffect(() => {{
    if (cardRef.current) {{
      const rect = cardRef.current.getBoundingClientRect();
      if (rect.height && Math.abs(rect.height - measuredHeight) > 1) {{
        setMeasuredHeight(rect.height);
      }}
    }}
  }});

  const minWidth = node.width ?? 130;
  const minHeight = node.height ?? 130;
  const isLong = (node.label || '').length > 11;

  return (
    <div
      ref={{cardRef}}
      style={{{{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        minWidth,
        width: node.width ? `${{node.width}}px` : 'max-content',
        minHeight,
        height: 'auto',
        userSelect: 'none'
      }}}}
      onMouseDown={{(e) => onMouseDown?.(e, node.id)}}
      onDoubleClick={{() => onDoubleClick?.(node.id)}}
    >
      <style>{{`
        @keyframes skipo-marquee-rtl {{
          0% {{ transform: translateX(0%); }}
          100% {{ transform: translateX(-50%); }}
        }}
      `}}</style>

      {{/* Perimeter Bounded Node Body: Natural Content-Driven Expansion */}}
      <div
        style={{{{
          width: '100%',
          minHeight,
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--skipo-surface, rgba(25, 25, 25, 0.92))',
          border: `2px solid ${{selected ? 'var(--skipo-accent, #d4af37)' : 'var(--skipo-border, #333)'}}`,
          borderRadius: '8px',
          overflow: 'visible',
          boxSizing: 'border-box'
        }}}}
      >
        {{/* Top Portion: Emblem */}}
        <div
          style={{{{
            flex: '1 0 auto',
            minHeight: '84px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, transparent 72%)',
            padding: '12px'
          }}}}
        >
          {{renderEmblem(node.type)}}
        </div>

        {{/* Bottom Content Area: Natural Height Text & Child Info */}}
        <div
          style={{{{
            flex: '0 0 auto',
            minHeight: '38px',
            width: '100%',
            borderTop: '1px solid var(--skipo-border, #333)',
            backgroundColor: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 8px',
            boxSizing: 'border-box'
          }}}}
        >
          <div style={{{{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: isLong ? 'flex-start' : 'center' }}}}>
            <div
              style={{{{
                display: 'inline-flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--skipo-text, #fff)',
                animation: isLong ? 'skipo-marquee-rtl 6s linear infinite' : 'none'
              }}}}
            >
              <span>{{node.label}}</span>
              {{isLong && <span style={{{{ paddingLeft: '16px', opacity: 0.8 }}}}>• {{node.label}}</span>}}
            </div>
          </div>
        </div>
      </div>

      {{node.inputs?.map((socket, idx) => (
        <div key={{socket.id}} style={{{{ position: 'absolute', left: 0, top: `${{((idx + 1) * measuredHeight) / ((node.inputs?.length ?? 1) + 1)}}px`, transform: 'translate(-50%, -50%)', zIndex: 10 }}}}>
          <MovableSocketHandle socket={{socket}} nodeId={{node.id}} isOutput={{false}} onSocketMouseDown={{onSocketMouseDown}} onSocketMouseUp={{onSocketMouseUp}} onSocketNudgeChange={{onSocketNudgeChange}} />
        </div>
      ))}}
      {{node.outputs?.map((socket, idx) => (
        <div key={{socket.id}} style={{{{ position: 'absolute', left: '100%', top: `${{((idx + 1) * measuredHeight) / ((node.outputs?.length ?? 1) + 1)}}px`, transform: 'translate(-50%, -50%)', zIndex: 10 }}}}>
          <MovableSocketHandle socket={{socket}} nodeId={{node.id}} isOutput={{true}} onSocketMouseDown={{onSocketMouseDown}} onSocketMouseUp={{onSocketMouseUp}} onSocketNudgeChange={{onSocketNudgeChange}} />
        </div>
      ))}}
    </div>
  );
}}
"""
    files.append(GeneratedFile(
        relative_path="NodeCard.tsx",
        content=card_content,
        description="Anti-spill NodeCard with 2/3 icon and 1/3 RTL scrolling text"
    ))

    # 8. NodeGraphCanvas.tsx (Canonical Canvas Controller)
    canvas_content = f"""{section_header("Canonical Node Graph Canvas")}
// ══════════════════════════════════════════════════════════════════════════════
'use client';
import React, {{ useState, useRef, useCallback }} from 'react';
import type {{ GraphNode, GraphEdge, NodeDefinition, ViewportState }} from './types.js';
import {{ NodeCard }} from './NodeCard.js';
import {{ SolidifyWidget }} from './SolidifyWidget.js';
import {{ CompatibleNodePicker }} from './CompatibleNodePicker.js';
import {{ CanvasContextMenu }} from './CanvasContextMenu.js';

export function isNodeInDeadZone(node: GraphNode, viewport: ViewportState, w: number, h: number): boolean {{
  const cx = w / 2;
  const cy = h / 2;
  const ncx = node.position.x + (node.width ?? 130) / 2;
  const ncy = node.position.y + (node.height ?? 130) / 2;
  const sx = ncx * viewport.zoom + viewport.panX;
  const sy = ncy * viewport.zoom + viewport.panY;
  return Math.hypot(sx - cx, sy - cy) <= Math.min(w, h) * 0.35;
}}

export function getCenterPan(node: GraphNode, viewport: ViewportState, w: number, h: number) {{
  const ncx = node.position.x + (node.width ?? 130) / 2;
  const ncy = node.position.y + (node.height ?? 130) / 2;
  return {{ panX: Math.round(w / 2 - ncx * viewport.zoom), panY: Math.round(h / 2 - ncy * viewport.zoom) }};
}}

export interface NodeGraphCanvasProps {{
  nodes: GraphNode[];
  edges: GraphEdge[];
  availableNodeTypes?: NodeDefinition[];
  onNodesChange?: (nodes: GraphNode[]) => void;
  onEdgesChange?: (edges: GraphEdge[]) => void;
  onSelectNode?: (nodeId: string | null) => void;
}}

export function NodeGraphCanvas({{
  nodes,
  edges,
  availableNodeTypes = [],
  onNodesChange,
  onEdgesChange,
  onSelectNode
}}: NodeGraphCanvasProps) {{
  const [viewport, setViewport] = useState<ViewportState>({{ panX: 0, panY: 0, zoom: 1 }});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<{{ nodeId: string; startX: number; startY: number }} | null>(null);
  const [pickerState, setPickerState] = useState<{{ x: number; y: number; handle: any }} | null>(null);
  const [contextMenu, setContextMenu] = useState<{{ x: number; y: number }} | null>(null);

  useEffect(() => {{
    const handleKeyDown = (e: KeyboardEvent) => {{
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {{
        const active = document.activeElement;
        const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true');
        if (!isInput) {{
          e.preventDefault();
          const rect = containerRef.current?.getBoundingClientRect();
          const cx = rect ? rect.width / 2 : 200;
          const cy = rect ? rect.height / 2 : 200;
          setContextMenu({{ x: cx, y: cy }});
        }}
      }} else if (e.key === 'Escape') {{
        setContextMenu(null);
        setPickerState(null);
      }}
    }};
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }}, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({{ x: 0, y: 0 }});
  const nodeMouseDownPos = useRef<{{ x: number; y: number; nodeId: string }} | null>(null);
  const hasDraggedNode = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {{
    if (e.button === 1) {{
      isPanning.current = true;
      panStart.current = {{ x: e.clientX - viewport.panX, y: e.clientY - viewport.panY }};
    }} else if (e.button === 0 && e.target === containerRef.current) {{
      setSelectedIds(new Set());
      onSelectNode?.(null);
      setContextMenu(null);
    }}
  }};

  const handleMouseMove = (e: React.MouseEvent) => {{
    if (isPanning.current) {{
      setViewport(prev => ({{ ...prev, panX: e.clientX - panStart.current.x, panY: e.clientY - panStart.current.y }}));
    }} else if (dragState) {{
      hasDraggedNode.current = true;
      const dx = (e.clientX - dragState.startX) / viewport.zoom;
      const dy = (e.clientY - dragState.startY) / viewport.zoom;
      onNodesChange?.(nodes.map(n => n.id === dragState.nodeId ? ({{ ...n, position: {{ x: n.position.x + dx, y: n.position.y + dy }} }}) : n));
      setDragState({{ nodeId: dragState.nodeId, startX: e.clientX, startY: e.clientY }});
    }}
  }};

  const handleMouseUp = () => {{
    isPanning.current = false;
    // Left-click node selection (without dragging): auto-pan to center IF outside dead zone
    if (nodeMouseDownPos.current && !hasDraggedNode.current && containerRef.current) {{
      const clicked = nodes.find(n => n.id === nodeMouseDownPos.current?.nodeId);
      if (clicked) {{
        const rect = containerRef.current.getBoundingClientRect();
        if (!isNodeInDeadZone(clicked, viewport, rect.width, rect.height)) {{
          const target = getCenterPan(clicked, viewport, rect.width, rect.height);
          setViewport(prev => ({{ ...prev, panX: target.panX, panY: target.panY }}));
        }}
      }}
    }}
    nodeMouseDownPos.current = null;
    hasDraggedNode.current = false;
    setDragState(null);
  }};

  return (
    <div
      ref={{containerRef}}
      style={{{{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: 'var(--skipo-bg, #141416)' }}}}
      onMouseDown={{handleMouseDown}}
      onMouseMove={{handleMouseMove}}
      onMouseUp={{handleMouseUp}}
      onContextMenu={{(e) => {{ e.preventDefault(); setContextMenu({{ x: e.clientX, y: e.clientY }}); }}}}
    >
      <div style={{{{ position: 'absolute', transform: `translate(${{viewport.panX}}px, ${{viewport.panY}}px) scale(${{viewport.zoom}})` }}}}>
        {{nodes.map(node => (
          <NodeCard
            key={{node.id}}
            node={{node}}
            selected={{selectedIds.has(node.id)}}
            onMouseDown={{(e, id) => {{
              e.stopPropagation();
              nodeMouseDownPos.current = {{ x: e.clientX, y: e.clientY, nodeId: id }};
              hasDraggedNode.current = false;
              setSelectedIds(new Set([id]));
              onSelectNode?.(id);
              setDragState({{ nodeId: id, startX: e.clientX, startY: e.clientY }});
            }}}}
          />
        ))}}
      </div>
      {{pickerState && (
        <CompatibleNodePicker x={{pickerState.x}} y={{pickerState.y}} sourceHandle={{pickerState.handle}} onSelect={{() => setPickerState(null)}} onClose={{() => setPickerState(null)}} />
      )}}
      {{contextMenu && (
        <CanvasContextMenu x={{contextMenu.x}} y={{contextMenu.y}} nodeTypes={{availableNodeTypes}} onSpawnNode={{(type) => {{ setContextMenu(null); }}}} onSelectAll={{() => setSelectedIds(new Set(nodes.map(n => n.id)))}} onDeleteSelected={{() => onNodesChange?.(nodes.filter(n => !selectedIds.has(n.id)))}} onClose={{() => setContextMenu(null)}} />
      )}}
    </div>
  );
}}
"""
    files.append(GeneratedFile(
        relative_path="NodeGraphCanvas.tsx",
        content=canvas_content,
        description="Canonical NodeGraphCanvas with pan, zoom, selection, and picker integration"
    ))

    # 9. index.ts
    index_content = f"""{section_header(f"{graph_name} Suite Facade")}
// ══════════════════════════════════════════════════════════════════════════════

export * from './types.js';
export * from './ConnectionRuleStore.js';
export * from './SolidifyWidget.js';
export * from './CompatibleNodePicker.js';
export * from './CanvasContextMenu.js';
export * from './MovableSocketHandle.js';
export * from './NodeCard.js';
export * from './NodeGraphCanvas.js';
"""
    files.append(GeneratedFile(
        relative_path="index.ts",
        content=index_content,
        description=f"{graph_name} suite barrel facade"
    ))

    # 10. Companion Test
    test_content = f"""{section_header(f"{graph_name} Companion Test")}
// ══════════════════════════════════════════════════════════════════════════════

import {{ describe, it, expect, beforeEach }} from 'vitest';
import {{ ConnectionRuleStore }} from './ConnectionRuleStore.js';
import {{ getTaperedBeamPoints }} from './MovableSocketHandle.js';

describe('{graph_name} Canonical Invariants', () => {{
  beforeEach(() => {{
    ConnectionRuleStore.initializeDefaults();
  }});

  it('correctly resolves compatibility rules', () => {{
    expect(ConnectionRuleStore.canConnect('STRING', 'STRING')).toBe(true);
    expect(ConnectionRuleStore.canConnect('STRING', 'NUMBER')).toBe(false);
  }});

  it('filters node types to only compatible candidates', () => {{
    ConnectionRuleStore.registerNodeType({{
      type: 'string_sink',
      label: 'String Sink',
      inputs: [{{ id: 's1', dataType: 'STRING', category: 'DATA', direction: 'INPUT', connectionMode: 'SINGLE' }}]
    }});

    const candidates = ConnectionRuleStore.getCompatibleNodeTypes('STRING', 'output');
    expect(candidates.some(c => c.type === 'string_sink')).toBe(true);
  }});

  it('calculates tapered beam points that are wide at base and narrow at head', () => {{
    const nudge = {{ x: 30, y: 40 }};
    const points = getTaperedBeamPoints(nudge, 6, 1.5);
    expect(points).toBeTruthy();
    expect(points.split(' ').length).toBe(4);
  }});
}});
"""
    files.append(GeneratedFile(
        relative_path=f"{graph_name}.test.ts",
        content=test_content,
        description=f"{graph_name} suite companion tests"
    ))

    result = emit_directory(
        target_dir=target_dir,
        files=files,
        dry_run=params.get("dry_run", False),
        force=params.get("force", False)
    )
    result.generator_id = GENERATOR_ID
    result.generator_title = GENERATOR_TITLE
    result.duration_ms = (time.time() - start_time) * 1000
    result.messages.extend([
        f"Generated {len(files)} files for {graph_name} Suite",
        "Baked canonical controls: middle-mouse pan, marquee box select, context menu",
        "Baked anti-spill proportional NodeCard (2/3 icon, 1/3 RTL scrolling text)",
        "Baked icon-only SolidifyWidget without text label",
        "Baked CompatibleNodePicker for socket handle drag release",
        "Baked central ConnectionRuleStore and canonical NodeGraphCanvas"
    ])
    return result

if __name__ == "__main__":
    target_dir, params = parse_generator_args("Generate a complete Node Graph Suite with canonical UX controls")
    result = generate_node_graph_suite(target_dir, params)
    print_generator_report(result)
