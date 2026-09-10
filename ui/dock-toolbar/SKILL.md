---
name: dock-toolbar-guidelines
description: Directives for the window switcher dock toolbar, 4-edge positioning, auto-hide zones, and monochromatic icons.
---

# MAIN WINDOW SWITCHER DOCK TOOLBAR GUIDELINES

## 1. FORMAL POSITIONING & SENSING SPECS

$$\text{Position} \in \{\text{top}, \text{bottom}, \text{left}, \text{right}\}, \quad \text{Orientation}(\text{pos}) = \begin{cases} \text{flex-row}, & \text{pos} \in \{\text{top}, \text{bottom}\} \\ \text{flex-col}, & \text{pos} \in \{\text{left}, \text{right}\} \end{cases}$$

$$\begin{array}{ll}
\mathbf{D_1} \text{ (Tooltip Inversion)} & \text{TooltipDirection}(pos) = \text{OppositeEdge}(pos) \\
\mathbf{D_2} \text{ (Auto-Hide Zone)} & \text{autoHide} \implies (\text{IdleThickness} = 4\text{px} \wedge \text{HoverThreshold} \le 20\text{px} \wedge \text{Debounce} = 300\text{ms}) \\
\mathbf{D_3} \text{ (Icon-Only Protocol)} & \forall it \in \text{DockItems}: \text{Label}(it) = \emptyset \wedge \text{Icon}(it) \in \text{SVG}_{\text{mono}}
\end{array}$$

## 2. COMPONENT SPECIFICATION

```tsx
export interface DockConfig {
  position: "top" | "bottom" | "left" | "right";
  autoHide: boolean;
  activeId: string;
  items: Array<{ id: string; title: string; icon: React.ComponentType<{ className?: string }> }>;
  onSelect: (id: string) => void;
}
```
- **Styling**: `backdrop-blur-md`, solid 1px `var(--skipo-border)`, box-shadow `0 0 10px var(--skipo-accent-glow)`.
