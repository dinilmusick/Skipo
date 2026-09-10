---
name: react-flow-guidelines
description: Directives for react-flow node graph interaction controls, mouse button mappings, hotkeys, wire drag auto-spawn, edge delete gizmo z-index layering below node bodies, and visual differentiation across node categories.
---

# REACT FLOW INTERACTION & VISUAL RULES (DENSE)

$$\text{ZIndex}(\text{wires: 5}) < \text{ZIndex}(\text{gizmos: 7}) < \text{ZIndex}(\text{nodes: 10}) < \text{ZIndex}(\text{panels: 50})$$
$$\text{CanvasUI}: \text{FloatingButtons} = \emptyset \wedge \text{Actions} \subseteq \text{ContextMenu} \oplus \text{BottomDock}$$

## 1. INPUT BINDINGS & HOTKEY MATRIX

| Input | Target | Action |
| :--- | :--- | :--- |
| `LeftClick` | Node | Select node |
| `LeftDrag` | Node / Marquee | Move nodes / Box multi-select |
| `MiddleDrag` | Canvas | Pan canvas |
| `Wheel` | Canvas | Zoom centered on cursor |
| `Del / Backspace` | Selection | Delete selected nodes & edges |
| `Cmd/Ctrl + C / V`| Selection | Copy / Paste topology at cursor |
| `Cmd/Ctrl + Z / Y`| History | Undo / Redo graph mutations |

## 2. WIRE DRAG & AUTO-SPAWN ALGORITHM

```python
def on_connect_end(event, source_handle):
    target = get_drop_target(event)
    if is_handle(target):
        connect(source_handle, target)
    elif is_canvas(target):
        pos = screen_to_flow(event.clientX, event.clientY)
        compatible = get_compatible_types(source_handle)
        open_spawn_menu(pos, compatible, on_select=lambda type: (
            node := spawn_node(type, at=pos),
            connect(source_handle, node.matching_handle)
        ))
```

## 3. Z-INDEX & OCCLUSION LAW
Wire delete gizmos (`z=7`) **MUST ALWAYS render below node cards (`z=10`)**. Node bodies cleanly occlude background wire badges. Zero floating `✕` badges overlapping card headers.

## 4. CHECKLIST GATE
`python3 checklists/02_ui_primitives_themes.py .` && `python3 checklists/03_layout_shell_invariants.py .`
