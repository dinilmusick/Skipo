---
name: ui-styling-guidelines
description: Directives for neo-brutalism 2.5D biome styling, strict monochromatic SVG icon protocol, portable theme pack architecture, thin bottom strip inspection, top toolbar flat tabs, and zero floating tooltips.
---

# UI STYLING & 2.5D BIOME GUIDELINES

## 1. THEME & VISUAL IDENTITY
- **Core Paradigm**: `neo-brutalism_2.5D_biome` with **Subtle Tactile Glow** and **Theme Pack Decoupling**.
- **Shapes & Borders**: Neo-Brutalist (bold, blocky, geometric, crisp 1px-2px solid borders).
- **Subtle Glow Effects**: Tactile ambient neon/rune glow on interactive elements, hover states, and active cards (`box-shadow: 0 0 10px var(--skipo-accent-glow)`).
- **Strict Monochromatic Icon Mandate**:
  - **PROHIBITED**: Full-color OS emojis (e.g. 🏛️, ⚡, 🎨, 📚, 🌐, 💾, 🛠️, 🎯, 📐, 👁️). Emojis break the brutalist aesthetic.
  - **MANDATORY**: Single-tone monochromatic SVG vector paths or geometric line glyphs (`fill="currentColor"`, `stroke="currentColor"`).
- **Strict Icon-Only Buttons**:
  - **Zero Text Labels on Buttons**: Toolbars, docks, and action buttons MUST contain only monochromatic SVG icons.
  - Button text/utility description appears **exclusively in the center of the bottom strip** on hover or keyboard focus.
- **Zero Floating Tooltip Bubbles**:
  - Floating balloon popups and floating tooltip bubbles are strictly FORBIDDEN.
  - All element descriptions appear in the thin bottom strip center as slightly translucent text that smoothly fades in and out.
- **Zero On-Screen Explanatory Clutter**:
  - FORBID direct on-screen marketing copy, descriptive paragraphs, tutorials, or "how-to" guidance text.
  - All descriptions and utility details MUST be revealed **only on hover** over that specific element via the bottom strip.
- **Top Toolbar & Flat Tabs**:
  - Single `TopToolbar` on top for app title and all tabs.
  - Strictly flat tabs: zero nested tabs permitted anywhere.
- **External Credential Fields**:
  - Credential fields must include a direct external link button to the credential management page.
- **Fonts**: Locked set (1 Display + 1 Body font: high contrast, clean typography).

---

## 2. PORTABLE THEME PACK ARCHITECTURE
Every application loads its visual theme from a portable theme pack directory:
```
my-theme-pack/
├── theme.json      # Metadata (id, name, version, mode: 'dark' | 'light')
├── tokens.json     # Semantic token dictionary (bg, text, accent, border, radius, shadow, status, shell)
└── styles.css      # Generated CSS variables (--skipo-*)
```
- Fully compatible with the upcoming standalone Theme Designer application.
- Theme tokens must be referenced strictly through CSS custom properties (`var(--skipo-*)`).
- Hardcoded HEX, RGB, or HSL values in component code are strictly prohibited.

---

## 3. INFINITE CANVAS 4-QUADRANT CLIPPING PREVENTION
```
∀ canvas ∈ Canvas_Viewports:
  svg_wire_layer.viewBox   ≡ "-50000 -50000 100000 100000"
  svg_wire_layer.overflow  ≡ "visible"
  svg_wire_layer.position  ≡ "absolute; top: -50000px; left: -50000px; width: 100000px; height: 100000px;"
```
- **Unbounded 4-Quadrant Plane**: Canvas nodes can move into negative $X$ and negative $Y$ coordinates ($x < 0, y < 0$) without clipping.
- **SVG Wire Persistence**: The SVG connection wire layer spans all 4 quadrants ($-\infty$ to $+\infty$).

---

## 4. THEMED CONTROLS & BOTTOM STRIP INSPECTION
```
FORBID:
  - Default OS/browser unstyled elements (<select>, default webkit scrollbars).
  - Floating tooltips / popover balloons.
  - Nested tab bars.
  - Text labels on action buttons.

REQUIRE:
  - Bottom Strip:
      height: 30px
      background: var(--skipo-bottom-strip-bg)
      left slot: Status lights + AutoSaveToggle
      center slot: Translucent inspection text with smooth fade transition
      right slot: Active API activity spinner + System messages
  - Scrollbars:
      width: 4px - 6px
      track: transparent / subtle surface tone
      thumb: solid accent color with brutalist square edges
  - Dropdowns & Menus:
      surface: locked panel background with hard-edged brutalist drop-shadow
      borders: 1px - 2px solid locked accent / border tone
      options: monochromatic icons + hover highlight
```

---

## 5. PRE-BUNDLED CSS & VITE BUNDLER COMPATIBILITY
```
∀ vite_app ∈ Skipo_Applications:
  css_import ≡ "@import '@skipo/ui/dist/index.css';" ∨ "@skipo/ui/dist/index.css"
```
- **Vite & Tailwind v4 Integration**:
  In Vite applications using `@tailwindcss/vite` or plain CSS imports, `@skipo/ui` exports its compiled CSS bundle at `@skipo/ui/dist/index.css`.
- **Pre-Bundled Artifact Requirement**:
  - The `dist/index.css` artifact MUST exist prior to running Vite build (`pnpm --filter @skipo/ui build`).
  - Monorepo `.gitignore` MUST use `/dist/` to avoid masking `packages/ui/dist/index.css`.
  - When importing `@skipo/ui` styles in `src/index.css`:
    ```css
    @import '@skipo/ui/dist/index.css';
    ```

