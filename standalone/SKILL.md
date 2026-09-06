---
name: skipo-standalone-app-architecture
description: Architectural standard for building standalone applications (Next.js, React SPA, Electron) using @skipo/* modular packages with base classes, container inheritance, theme packs, and zero KrnlTS dependencies.
---

# SKIPO STANDALONE APPLICATION ARCHITECTURE

Standard guide for developing modern, framework-agnostic web and desktop applications using the standalone `@skipo/*` package suite without exposing or requiring `@dinilmusick/krnlts`.

---

## 1. Core Architectural Laws

$$\text{App} = \{\text{UI (Theme Pack} \oplus \text{TopToolbar} \oplus \text{BottomStrip} \oplus \text{Base Components} \oplus \text{Containers)}, \text{Systems}, \text{Backend}\}$$

$$\text{Enforcement} = @\text{skipo/validate (AST Purity} \wedge \text{Theme Semantics} \wedge \text{Anti-Nested-Tabs} \wedge \text{Zero-Floating-Text)}$$

### Law 1: Component Inheritance & Zero-Custom-UI Mandate
Applications using Skipo MUST NOT build their own bespoke UI components or use raw HTML interactive elements.
- **Mandatory**: All buttons, inputs, toggles, badges, cards, dialogs, and navigation MUST inherit or compose directly from `@skipo/ui` (`BaseButton`, `BaseInput`, `CredentialField`, `BaseTextarea`, `BaseSelect`, `BaseCard`, `BaseBadge`, `BaseToggle`, `IconOnlyButton`, `TopToolbar`, `BottomStrip`).
- **Forbidden**: Bespoke raw HTML `<button>`, `<input>`, `<select>`, `<textarea>`, unstyled `<div>` buttons, or ad-hoc custom UI button/tab abstractions.
- **Rationale**: Guarantees deterministic visual rendering, unified theme token inheritance, and strict behavioral consistency across all apps.

### Law 2: Single TopToolbar & Anti-Nested-Tabs Law
Every application MUST feature a single unified `TopToolbar` at the top of the viewport:
- Contains the application name/branding on the left and all application tabs in a single flat list.
- **Strict Invariant**: Zero nested tabs of any kind. All primary view navigation is flat at the top toolbar level. Creating secondary, nested, or inner tab bars inside panels, drawers, or views is strictly FORBIDDEN.

### Law 3: Dedicated Thin BottomStrip & Zero-Floating-Text Law
Floating text bubbles, floating tooltips, and balloon popups are completely PROHIBITED.
- Every app MUST include a thin `BottomStrip` (height: 30px) anchored at the bottom of the shell.
- **Center Slot**: Displays translucent, reactive inspection text describing any currently hovered or focused element (buttons, tabs, inputs, actions). Text smoothly fades in and out with CSS transitions.
- **Bottom-Left Slot**: App operational status lights (`StatusLight`) and controls like auto-save (`AutoSaveToggle`).
- **Bottom-Right Slot**: Active in-flight API call indicator (`ApiCallIndicator`) and system notifications (`SystemMessageDisplay`).
- **Clean Central Space**: The entire central viewport in `AppShell` remains uncluttered and dedicated exclusively to the app UI.

### Law 4: Strict Icon-Only Elements & Zero Explanatory Clutter
- **Icon-Only Buttons**: Interactive action buttons, toolbars, and dock items MUST contain only monochromatic SVG glyphs without static text labels. Action names and utilities are revealed exclusively in the center of the bottom strip on hover/focus.
- **Zero Explanatory Copy**: Never clutter screens with tutorials, marketing paragraphs, or long descriptive copy unless explicitly requested by the user.
- **Clean Login & Modals**: Even authentication screens must remain strictly utilitarian, minimal, and devoid of marketing fluff.

### Law 5: External Credential Link Law
Wherever an input field requests credentials from an external service (OpenAI, Anthropic, Google AI Studio, Backblaze B2, Cloudflare R2, AWS S3, Supabase, Neon, GitHub, etc.), it MUST use `CredentialField` and include a direct link button navigating directly to the web portal where the user can retrieve those credentials.

### Law 6: Portable Theme Pack Architecture
All theming is decoupled into portable theme pack directories:
```
my-theme-pack/
├── theme.json          --> Metadata (id, name, mode: 'dark'|'light', version)
├── tokens.json         --> Standardized semantic design tokens (bg, text, accent, border, radius, shadow, font, status, shell)
└── styles.css          --> Generated CSS custom properties mapped 1:1 to --skipo-*
```
- Apps consume theme packs via `<SkipoThemeProvider initialThemePack={...}>`.
- Compatible with standalone Theme Designer applications.
- Forbidden: Hardcoded hex/rgb color values or ad-hoc style classes bypassing `--skipo-*` tokens.

### Law 7: Universal Backend Separation
$$\text{Control Plane (User Auth / Config)} \cap \text{Data Plane (Workspace Storage)} = \emptyset$$
- Use `@skipo/backend/auth` for accounts, roles, and sessions.
- Use `@skipo/backend/storage` for workspace files and objects.

### Law 8: Compile-Time & Routine Turn Audit Verification
Run `pnpm run validate` (`skipo-validate`) on every build turn and during routine 5-turn agent audits:
1. Max 200 lines per file.
2. 4-layer function purity ($L_0 \to L_1 \to L_2 \to L_3$).
3. Top-level file purity (imports + root composition only).
4. One component per file.
5. Base class inheritance across all components.
6. Zero nested tabs.
7. Zero floating tooltips / floating text bubbles.
8. Theme token semantics (`--skipo-*` variables only).
