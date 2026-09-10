---
name: tiled-menus-guidelines
description: Directives for dnd-kit tiled menus, sortable grids, icon-only tiles, and collision-aware tooltips.
---

# TILED MENUS & DND-KIT GUIDELINES

## 1. FORMAL TILED SPECIFICATIONS

$$\forall t \in \text{Tiles}: \text{Label}(t) = \emptyset \wedge \text{Content}(t) \in \text{SVG}_{\text{mono}} \wedge \text{Hover}(t) \implies \text{RevealTooltip}(t)$$

$$\text{Placement}(el) = \begin{cases} \text{"bottom"}, & \text{rect}(el).\text{top} < 80\text{px} \\ \text{"top"}, & \text{otherwise} \end{cases} \quad (\text{Prevents Viewport Clipping})$$

## 2. INTEGRATION MATRIX

- **Framework**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- **Styling**: Hard-edged brutalist shadows (`box-shadow: 4px 4px 0 var(--skipo-border)`), themed scrollbars ($\le 6\text{px}$).
- **Triggers**: Icon-only buttons with bottom strip or collision-aware popover.
