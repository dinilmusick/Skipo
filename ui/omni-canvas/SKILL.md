---
name: omni-canvas-paradigm
description: Complete specification for the Omni Canvas Paradigm in application design, featuring unified infinite canvas, Viewer Nodes, 'Views' socket handles, contextual view spawning, and canvas window management.
---

# OMNI CANVAS PARADIGM FOR APPLICATIONS (`omni-canvas`)

## 1. CORE PHILOSOPHY & UNIFIED INFINITE CANVAS
In the **Omni Canvas Paradigm**, applications do NOT segregate architecture, UI building, code editing, state debugging, and sandboxed testing into disconnected modal tabs or standalone windows.

Instead, the **entire application lifecycle lives on a single, unified, infinite canvas**:
- Architectural concept nodes (Entities, Quad-Units, Concept Libraries, Sub-Apps) define the topological domain graph.
- Interactive **Viewer Nodes (Widget Windows)** reside directly on the canvas alongside the concept nodes, tethered via live dynamic wires.

---

## 2. THE 'VIEWS' SOCKET HANDLE (`socket-views`)
Every architectural node MUST expose a dedicated **Views Handle** (`.socket-views`):

```
┌──────────────────────────────────────────────┐
│ [🏛️ SYSTEM ENTITY]               [● In]      │
│ TradingSystem                     [● Out]     │
│ ⚡ Auto-Discovered                 [👁️ Views] ├──────(Wire)──────► [🎨 UI & Builder Viewer]
└──────────────────────────────────────────────┘
```

- **Universal Placement**: Positioned prominently on every architectural card (Entity, Functionality, Concept Library, Sub-App).
- **Distinct Visual Style**: Rendered with a dedicated icon (`👁️` or `✦`) and distinct violet/purple wire accent (`#c678dd`).

---

## 3. WIRE DRAG VIEW-SPAWN DIALOGUE
Dragging a wire from the `Views` handle onto empty canvas space MUST open a contextual **View Selector Dialogue**:

```
function onViewsWireDrop(event, sourceNode):
    dropPosition = screenToFlowPosition(event.clientX, event.clientY)
    availableViews = getAvailableViewsForNode(sourceNode.type)
    
    openViewSelectorModal(dropPosition, availableViews, onSelect = (selectedViewType) => {
        viewerWidget = spawnViewerNode({
            sourceNodeId: sourceNode.id,
            viewType: selectedViewType,
            position: dropPosition
        })
        connectViewsWire(sourceNode.viewsHandle, viewerWidget.inputHandle)
    })
```

### Supported View Types by Category:
1. **Quad-Unit Functionality**:
   - `🎨 UI View & Atom Builder`: Live interactive component rendering + atomic drag-and-drop palette + generated VanJS Monaco code.
   - `📄 Monaco Source Code Viewer`: Full TypeScript source code inspection & editing for Quad-Layers (Atom, Logic, State, Helpers).
   - `🧪 Sandboxed Test Bench & Metrics`: Interactive JSON input/output execution sandbox with live millisecond latency badges.
   - `💾 Reactive State Inspector`: Real-time reactive state JSON inspector.
2. **System Entity**:
   - `🎨 System Dashboard & Status View`: Live health metrics and subsystem overview.
   - `📄 Entity Class Source Code`: Monaco TypeScript editor for root class and boot loader.
   - `🌊 Flow Execution Pipeline View`: Visual pipeline sequence for `.then()` and `.branch()` steps.
3. **Domain Concept Library**:
   - `📄 Pure Math Code (Monaco Editor)`: Layer 0 deterministic function inspection.
   - `🧮 Math REPL & Unit Test Bench`: Pure function sandbox tester.
4. **Sub-App Container**:
   - `🌐 Embedded Full-Stack SPA View`: Live interactive frontend route view.
   - `📄 Manifest & Route Configuration`: Configuration inspector.

---

## 4. CANVAS WINDOW MANAGEMENT & RESIZABLE WIDGETS
Viewer Nodes on the Omni Canvas act as full **Windowed Canvas Widgets**:

1. **Direct Manipulation**:
   - **Movable**: Drag anywhere by the window titlebar header.
   - **Resizable**: Drag the bottom-right corner resize handle (`.viewer-resize-handle`) to resize width and height freely (default 520px × 420px, min 360px × 260px, max 1600px × 1200px).
2. **Window Controls**:
   - `[ − Minimize ]`: Collapses the widget body into a sleek docked titlebar badge.
   - `[ ⤢ Maximize ]`: Expands widget to a prominent focused viewport size.
   - `[ ✕ Close ]`: Closes the viewer node and removes the tethering view wire.
3. **Z-Index Layering & Focus**:
   - Clicking inside any Viewer Node immediately brings it to the top of the canvas z-index stack.
4. **Zero Modal Windows**:
   - No pop-up modals or full-screen overlays; all tools exist as first-class citizens directly on the Omni Canvas.
