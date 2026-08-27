---
name: ui-styling-guidelines
description: Directives for neo-brutalism 2.5D biome styling, strict monochromatic SVG icon protocol, infinite 4-quadrant canvas clipping prevention, locked palettes, custom styled scrollbars, themed dropdowns, and regression guards.
---

# UI STYLING & 2.5D BIOME GUIDELINES

## 1. THEME & VISUAL IDENTITY
- **Core Paradigm**: `neo-brutalism_2.5D_biome` with **Subtle Tactile Glow**.
- **Shapes & Borders**: Neo-Brutalist (bold, blocky, geometric, crisp 1px-2px solid borders).
- **Subtle Glow Effects**: Tactile ambient neon/rune glow on interactive elements, hover states, and active cards (`box-shadow: 0 0 10px var(--krnl-accent-glow)` / `0 0 18px rgba(212, 175, 55, 0.25)`).
- **Strict Monochromatic Icon Mandate**:
  - **PROHIBITED**: Full-color OS emojis (e.g. 🏛️, ⚡, 🎨, 📚, 🌐, 💾, 🛠️, 🎯, 📐, 👁️). Emojis render with distracting multi-color OS themes that break the brutalist aesthetic.
  - **MANDATORY**: Single-tone monochromatic SVG vector paths or geometric line glyphs.
  - **Coloring**: Must inherit or use theme color tokens (`fill="currentColor"`, `stroke="currentColor"`, or explicit theme accents: `#d4af37`, `#f5ede4`, `#c678dd`, `#61afef`, `#e5c07b`).
- **Strict Icon-Only Buttons**:
  - **Zero Text Labels on Buttons**: Toolbars, docks, and action buttons MUST contain only monochromatic SVG icons.
  - Button text/utility description appears **exclusively on hover** via a tooltip.
- **Zero On-Screen Explanatory Clutter**:
  - FORBID direct on-screen marketing copy, descriptive paragraphs, tutorials, or "how-to" guidance text.
  - All descriptions, feature utility, and guidance MUST be revealed **only on hover** over that specific element.
- **Fonts**: Locked set (1 Display + 1 Body font; high contrast, clean typography).

---

## 2. INFINITE CANVAS 4-QUADRANT CLIPPING PREVENTION
```
∀ canvas ∈ Canvas_Viewports:
  svg_wire_layer.viewBox   ≡ "-50000 -50000 100000 100000"
  svg_wire_layer.overflow  ≡ "visible"
  svg_wire_layer.position  ≡ "absolute; top: -50000px; left: -50000px; width: 100000px; height: 100000px;"
```
- **Unbounded 4-Quadrant Plane**: Canvas nodes can move into negative $X$ and negative $Y$ coordinates ($x < 0, y < 0$) without clipping.
- **SVG Wire Persistence**: The SVG connection wire layer must span all 4 quadrants ($-\infty$ to $+\infty$) so that wires between negative-coordinate nodes never clip or vanish.

---

## 3. COLOR PALETTES (LOCKED)
```
Light Mode (coffee_theme):
  base    : #F5EDE4 (Warm cream / off-white)
  surface : Latte / Tan tones
  accent  : Espresso brown, Caramel, Muted terracotta
  text    : Dark roast brown (≠ #000000)

Dark Mode (black_and_gold):
  base    : Near-black / Charcoal (≠ #000000)
  surface : Deep charcoal panels
  accent  : Muted gold, Brass
  text    : Warm off-white / Soft gold-white (≠ #FFFFFF)
```

---

## 4. THEMED CONTROLS & HOVER TOOLTIPS (ZERO UNSTYLED ELEMENTS)
```
FORBID: Default OS/browser unstyled elements (<select>, default webkit scrollbars).

REQUIRE:
  - Scrollbars:
      width: 4px - 6px
      track: transparent / subtle surface tone
      thumb: solid accent color with brutalist square edges (no bubbly border-radius)
  - Dropdowns & Menus:
      surface: locked panel background with hard-edged brutalist drop-shadow
      borders: 1px - 2px solid locked accent / border tone
      options: monochromatic icons + hover highlight from complementary palette
  - Hover Tooltips:
      surface: #1e1e28 with 1px solid theme accent
      placement: downward ("bottom") if within 80px of top window edge; upward ("top") otherwise
```
