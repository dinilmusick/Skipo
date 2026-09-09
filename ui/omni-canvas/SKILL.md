---
name: omni-canvas-paradigm
description: Complete specification for the Omni Canvas Paradigm in application design, featuring unified infinite 4-quadrant canvas, Viewer Nodes, monochromatic SVG icons, 'Views' socket handles, and canvas window management.
---

# OMNI CANVAS PARADIGM FOR APPLICATIONS (`omni-canvas`)

## 1. CORE PHILOSOPHY & UNIFIED INFINITE CANVAS
In the **Omni Canvas Paradigm**, applications do NOT segregate architecture, UI building, code editing, state debugging, and sandboxed testing into disconnected modal tabs or standalone windows.

Instead, the **entire application lifecycle lives on a single, unified, infinite canvas**:
- Architectural concept nodes (Entities, Quad-Units, Concept Libraries, Sub-Apps) define the topological domain graph.
- Interactive **Viewer Nodes (Widget Windows)** reside directly on the canvas alongside the concept nodes, tethered via live dynamic wires.
- **Infinite 4-Quadrant Plane**: The canvas and SVG wiring layer MUST support negative and positive coordinates ($-\infty$ to $+\infty$) without clipping wires or nodes when moved past the origin.

---

## 2. STRICT MONOCHROMATIC ICONS & ZERO EMOJIS
```
∀ icon ∈ Canvas_Icons:
  render_type(icon) ≡ Monochromatic_SVG_Vector (fill="currentColor" or theme accent)
  render_type(icon) ≢ OS_Full_Color_Emoji
```
- Multi-color OS emojis (e.g. 🏛️, ⚡, 🎨, 📚, 🌐, 💾, 🛠️, 🎯, 📐, 👁️) are **STRICTLY FORBIDDEN**.
- All icons across node headers, dock toolbars, context menus, and handle badges must be **monochromatic vector SVGs** styled via single-tone theme accents (`#d4af37`, `#61afef`, `#c678dd`, `#e5c07b`, `#f5ede4`).

---

## 3. THE 'VIEWS' SOCKET HANDLE (`socket-views`)
Every architectural node MUST expose a dedicated **Views Handle** (`.socket-views`):

```
┌──────────────────────────────────────────────┐
│ [⬡ SYSTEM ENTITY]                 [● In]     │
│ TradingSystem                     [● Out]    │
│ ◈ Auto-Discovered                 [◈ Views] ├──────(Violet Wire)──────► [🎨 UI & Builder Viewer]
└──────────────────────────────────────────────┘
```

- **Placement**: Icon-only circular badge (`◈` or vector eye) at the base of every node with hover tooltip *"Spawn Omni View"*.
- **Interaction**: Clicking directly or dragging a wire off the handle triggers the **View Selector Modal**.

---

## 4. WIRE DRAG VIEW-SPAWN DIALOGUE
Dragging a wire from the `Views` handle onto empty canvas space (or clicking it) MUST open a contextual **View Selector Dialogue**:

### Supported View Types:
1. **Quad-Unit Functionality**:
   - `UI View & Atom Builder`: Live interactive component rendering + atomic drag-and-drop palette + generated VanJS Monaco code.
   - `Monaco Source Code Viewer`: Full TypeScript source code inspection & editing loaded directly from workspace disk.
   - `Sandboxed Test Bench & Metrics`: Interactive JSON input/output execution sandbox with live millisecond latency badges.
   - `Reactive State Inspector`: Real-time reactive state JSON inspector.
2. **System Entity**:
   - `System Dashboard & Status View`: Live health metrics and subsystem overview.
   - `Entity Class Source Code`: Monaco TypeScript editor for root class and boot loader.
   - `Flow Execution Pipeline View`: Visual pipeline sequence for `.then()` and `.branch()` steps.
3. **Domain Concept Library**:
   - `Pure Math Code (Monaco Editor)`: Layer 0 deterministic function inspection.
   - `Math REPL & Unit Test Bench`: Pure function sandbox tester.
4. **Sub-App Container**:
   - `Embedded Full-Stack SPA View`: Live interactive frontend route view.
   - `Manifest & Route Configuration`: Configuration inspector.

---

## 5. CANVAS WINDOW MANAGEMENT & RESIZABLE WIDGETS
Viewer Nodes on the Omni Canvas act as full **Windowed Canvas Widgets**:
1. **Movable**: Drag anywhere by the window titlebar header.
2. **Resizable**: Drag the bottom-right corner resize handle (`.viewer-resize-handle`) to resize width and height freely with automatic Monaco reflow (`editor.layout()`).
3. **Window Controls**: `[ ✕ Close ]` closes the viewer node and removes the tethering view wire.
4. **Z-Index Layering**: Clicking inside any Viewer Node immediately brings it to the top of the canvas focus stack.

---

## 6. MOVABLE SOCKET HANDLES & TAPERED ENERGY BEAM TETHERS
All node graphs (including Viewer Nodes and concept nodes) must adhere strictly to these physical socket interaction invariants:

### 1. Socket Sizing & Spatial Clearance (Anti-Obscuring Rule)
- **Large Target Areas**: Socket handles MUST render at a prominent, highly clickable size (`28px` / `w-7 h-7`) with internal visual indicators for connection states.
- **Node Body Clearance**: To prevent enlarged handles from obscuring labels, text, or status badges, base coordinates MUST be pushed outward from the node body edge by at least `12px`:
  ```typescript
  const baseX = isOutput ? (cardWidth / 2) + 12 : -(cardWidth / 2) - 12;
  ```

### 2. Physical Handle Displacement (Movable Sockets)
- **Nudge Feature**: Support custom X/Y displacement offsets (`socketOffsets` / `nudge`), allowing users to reposition handles away from the node body to optimize wire layouts.
- **Gizmo UI**: Each socket must render a hover-activated drag gizmo adjacent to it (`-18px` for inputs, `+18px` for outputs) to grab and displace the handle without initiating wire connections.

### 3. Tapered Energy Beam Tethers
- **Visual Feedback**: Whenever a socket is displaced (`nudge.x !== 0 || nudge.y !== 0`), it MUST render a dynamic tapered geometric beam connecting the displaced handle back to its base anchor.
- **Dual-Layered Polygons**: Never use a plain `<line>`. Use dual `<polygon>` layers: an intense inner core and a glowing outer shroud tapering from thick at the node body base to a fine point at the displaced handle.
- **Beam Mathematics Helper**:
  ```typescript
  const getBeamPoints = (nudge: { x: number; y: number }, baseW = 5, headW = 1.2) => {
    const vx = -nudge.x;
    const vy = -nudge.y;
    const d = Math.sqrt(vx * vx + vy * vy);
    if (d < 1) return "";

    const px = -vy / d;
    const py = vx / d;

    const hL_x = -px * headW;
    const hL_y = -py * headW;
    const hR_x = px * headW;
    const hR_y = py * headW;

    const bR_x = vx + px * baseW;
    const bR_y = vy + py * baseW;
    const bL_x = vx - px * baseW;
    const bL_y = vy - py * baseW;

    return `${hL_x},${hL_y} ${hR_x},${hR_y} ${bR_x},${bR_y} ${bL_x},${bL_y}`;
  };
  ```

