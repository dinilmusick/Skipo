---
name: react-flow-guidelines
description: Directives for react-flow node graph interaction controls, mouse button mappings, hotkeys, wire drag auto-spawn, edge delete gizmo z-index layering below node bodies, and visual differentiation across node categories.
---

# REACT FLOW NODE GRAPH INTERACTION & VISUAL DESIGN GUIDELINES (`react-flow`)

## 1. MANDATORY MOUSE & CANVAS CONTROLS
```
Mouse Bindings:
  Left Click (on Node)        : Select single node
  Left Click + Drag (Node)    : Drag individual or multi-selected nodes with 60fps real-time wire recalculation
  Left Click + Drag (Canvas)  : Box selection (marquee multi-select)
  Middle Mouse + Drag         : Pan canvas (panOnDrag={[1]} or panOnScrollMode)
  Mouse Scroll Wheel          : Zoom in / Zoom out centered on mouse cursor (zoomOnScroll={true})
```

---

## 2. WIRE DRAGGING & COMPATIBLE NODE AUTO-SPAWN
```
function onConnectEnd(event, sourceHandle):
    target = getDropTarget(event)
    if isHandle(target):
        establishConnection(sourceHandle, target)
    elif isCanvasBackground(target):
        dropPosition = screenToFlowPosition(event.clientX, event.clientY)
        compatibleTypes = getCompatibleNodeTypes(sourceHandle.dataType, sourceHandle.direction)
        
        openSpawnMenu(dropPosition, compatibleTypes, onSelect = (selectedNodeType) => {
            newNode = spawnNode(selectedNodeType, at = dropPosition)
            autoConnectHandle(sourceHandle, newNode.matchingHandle)
        })
```
- **Universal Wire Dragging**: Every handle (Input & Output) must support wire dragging.
- **Unconnected Drop Behavior**: Dropping a wire onto empty canvas space MUST trigger a contextual menu displaying compatible nodes.
- **Auto-Connection**: Selecting a node from the menu automatically instantiates the node at the drop coordinates and establishes the wire connection immediately.

---

## 3. WIRE DELETION GIZMO & Z-INDEX LAYERING INVARIANT
```
∀ edge ∈ Graph_Edges:
  if edge.isDeletable == true:
      renderDeleteGizmo(position = edge.centerMidpoint, onClick = () => deleteEdge(edge.id))
  else:
      renderPlainWire(showDeleteGizmo = false) // Immutable / locked connection

Z-Index Layering Hierarchy:
  svg_wires_layer   : z-index 5
  wire_gizmos_layer : z-index 7   <--- MUST BE BELOW NODES LAYER
  nodes_layer       : z-index 10
  node_cards        : z-index 20
  viewer_windows    : z-index 50+
```
- **Gizmos Draw Below Node Bodies**: Wire delete gizmos and connection wire badges **MUST ALWAYS render BELOW node bodies**.
- **Visual Occlusion Guard**: When a node is dragged over a wire or when a wire passes behind a node, the node body MUST cleanly overlap and occlude the wire delete gizmo, never rendering floating delete `✕` badges on top of node card headers or bodies.

---

## 4. FULL HOTKEY MATRIX
```
Key Combinations:
  Delete / Backspace  : Delete all currently selected nodes and edges (supports multi-selection)
  Ctrl+C / Cmd+C      : Copy selected nodes and internal edge topology
  Ctrl+V / Cmd+V      : Paste copied nodes at current cursor position
  Ctrl+X / Cmd+X      : Cut selected nodes
  Ctrl+A / Cmd+A      : Select all nodes on canvas
  Ctrl+Z / Cmd+Z      : Undo last graph mutation (move, connect, delete)
  Ctrl+Y / Cmd+Shift+Z: Redo last graph mutation
```

---

## 5. STRICT GRAPH CONTEXT MENUS (ZERO FLOATING CANVAS BUTTONS)
- **Zero On-Canvas Floating Action Buttons**: All mutations must be invoked via **context menus** or the **icon-only bottom dock**.
- **Right-Click on Canvas**: Spawns Entity, Quad-Unit Functionality, Domain Library, or Auto-Aligns layout.
- **Right-Click on Node**: Shows node-specific actions (Inspect Source Code, Open UI & Builder, Duplicate, Disconnect, Delete).

---

## 6. VISUAL DIFFERENTIATION FOR NODE BODIES & CATEGORIES
All node categories MUST have distinctly different silhouettes, color themes, and internal compartment grids:
- **System Entity**: Gold dual-border crown (`#d4af37`), `SYSTEM ENTITY` badge, subsystem indicator.
- **Quad-Unit Functionality**: Blue technical frame (`#61afef`), 4-compartment grid (`[Atom]`, `[Logic]`, `[State]`, `[Helpers]`).
- **Domain Concept Library**: Warm Amber bronze (`#e5c07b`), `Layer 0 Pure Math` badge.
- **Sub-App Container**: Cyan dashed frame (`#56b6c2`), fullstack SPA route container.

---

## 7. MAGNETIC TRACING & PURELY SPATIAL AUTO-SOLIDIFY
- **Centralized Rules Engine**: Nodes NEVER own connection compatibility logic. All resolutions flow through `CompatibilityMatrix.resolve(source, target)`.
- **Proximity Traces**: When `tracingEnabled = true`, compatible handle pairs within `traceCutoffDistance` automatically display transient, translucent ghost wires with a `[ SOLIDIFY ]` badge.
- **Effective Handle Offset**: Handles support local displacement ($P_{\text{effective}} = P_{\text{base}} + P_{\text{offset}}$) to resolve spatial contention without altering node cards.
- **Pure Spatial Auto-Solidify**: When `autoSolidify = true`, closest candidate wins with deterministic tie-breaking (exact distance $\to$ offset distance $\to$ deterministic node ID). Zero blacklist memory.

---

## 8. QUAD-TIER LOCKING SEMANTICS
1. **Topology Lock (`SolidConnection.locked`)**: Immune to spatial auto-replacement; prevents proximity disconnection.
2. **Geometry Lock (`BaseNode.positionLocked`)**: Protects coordinates from attraction clustering and manual movement.
3. **Dynamic State Pin (`BaseViewWindow.pinnedLive`)**: Keeps view window processing live (`PINNED_LIVE`) independently of selection focus.
4. **UI Instance Pin (`DetailsPanel.pinned`)**: Locks inspector to current element when selecting other canvas objects.

---

## 9. HIERARCHY, LANDMARKS & PERSISTENT VIEWS
- **Group Sub-Canvases**: Groups inherit global settings with partial override resolution: `object.override ?? nearestGroup.override ?? parentGroup.override ?? rootGraph.setting`.
- **Landmarks**: Canvas navigation anchors bound to number keys (`1`–`9`) and tiled context menu navigation.
- **Persistent Graph Views**: Preserves complete layouts (positions, sizes, offsets, camera, zoom, overrides) without persisting transient traces.

