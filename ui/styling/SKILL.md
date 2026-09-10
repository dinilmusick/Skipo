---
name: ui-styling-guidelines
description: Directives for neo-brutalism 2.5D biome styling, monochromatic SVG icons, portable theme packs, and bottom strip inspection.
---

# UI STYLING & 2.5D BIOME GUIDELINES

## 1. VISUAL INVARIANTS & FORMAL PREDICATES

$$\begin{array}{ll}
\mathbf{P_1} \text{ (Icon-Only Buttons)} & \forall b \in \text{ActionButtons}: \text{Children}(b) \subset \text{SVG}_{\text{mono}} \wedge \text{Text}(b) = \emptyset \\
\mathbf{P_2} \text{ (Zero Emojis)} & \text{UI} \cap \{\text{OS Emojis}\} = \emptyset \quad (\text{Use monochromatic single-tone SVG glyphs}) \\
\mathbf{P_3} \text{ (Zero Floating Tooltips)} & \text{Elements} \cap \{\text{TooltipBubbles}, \text{Balloons}\} = \emptyset \\
\mathbf{P_4} \text{ (Hover Routing)} & \forall el \in \text{Interactive}: \text{Hover}(el) \implies \text{BottomStrip.CenterSlot.render}(\text{Desc}(el)) \\
\mathbf{P_5} \text{ (100% Theme Tokens)} & \forall c \in \text{Styles}: c \cap \{\text{HEX}, \text{RGB}, \text{HSL}\} = \emptyset \wedge c \subset \{\text{var}(--\text{skipo}-*)\}
\end{array}$$

## 2. PORTABLE THEME PACK & CANVAS SPECS

```
theme-pack/
├── theme.json      # Metadata (id, name, version, mode: 'dark' | 'light')
├── tokens.json     # Semantic token dictionary (bg, text, accent, border, shadow)
└── styles.css      # Generated CSS variables (--skipo-*)
```

- **Infinite Canvas 4-Quadrant Bounds**:
  $$\text{viewBox} = -50000 \ -50000 \ 100000 \ 100000 \quad \wedge \quad \text{overflow: visible}$$
- **Vite/Tailwind CSS Ingress**: Anchor `@import '@skipo/ui/dist/index.css';` in root `src/index.css`. Anchored `.gitignore` (`/dist/`).
