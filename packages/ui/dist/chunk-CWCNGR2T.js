// src/theme/defaultPacks.ts
var DEFAULT_DARK_THEME_PACK = {
  metadata: {
    id: "skipo-dark-neo",
    name: "Skipo Dark Neo",
    version: "1.0.0",
    mode: "dark",
    author: "Skipo Core Team",
    description: "Default 2.5D Neo-Brutalism theme with charcoal panels and warm gold accents."
  },
  tokens: {
    bg: {
      canvas: "#16181d",
      surface: "rgba(26, 29, 36, 0.85)",
      surfaceHover: "rgba(34, 38, 48, 0.92)",
      blur: "blur(20px)"
    },
    text: {
      primary: "#f1f5f9",
      muted: "#8e95a5",
      inverse: "#0f172a"
    },
    accent: {
      primary: "#d4af37",
      fg: "#000000",
      glow: "0 0 14px rgba(212, 175, 55, 0.45)",
      hover: "#c59f2e"
    },
    border: {
      color: "rgba(255, 255, 255, 0.85)",
      input: "rgba(255, 255, 255, 0.85)",
      style: "2px solid rgba(255, 255, 255, 0.85)"
    },
    radius: {
      base: "10px",
      sm: "6px",
      lg: "14px"
    },
    shadow: {
      card: "5px 5px 0px rgba(0, 0, 0, 0.90)",
      cardHover: "8px 8px 0px rgba(0, 0, 0, 0.95)",
      btn: "3px 3px 0px rgba(0, 0, 0, 0.90)",
      btnHover: "5px 5px 0px rgba(0, 0, 0, 0.95)",
      btnActive: "1px 1px 0px rgba(0, 0, 0, 0.90)"
    },
    font: {
      sans: "'Inter', -apple-system, 'SF Pro Display', 'Segoe UI', sans-serif",
      mono: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace"
    },
    status: {
      success: "#10b981",
      successFg: "#000000",
      warning: "#f59e0b",
      warningFg: "#000000",
      danger: "#ef4444",
      dangerFg: "#ffffff",
      info: "#3b82f6",
      infoFg: "#ffffff"
    },
    shell: {
      topToolbarHeight: "44px",
      topToolbarBg: "rgba(18, 20, 25, 0.95)",
      bottomStripHeight: "30px",
      bottomStripBg: "rgba(15, 17, 21, 0.95)",
      inspectionTextTranslucent: "rgba(241, 245, 249, 0.80)"
    }
  }
};
var DEFAULT_LIGHT_THEME_PACK = {
  metadata: {
    id: "skipo-light-coffee",
    name: "Skipo Light Coffee",
    version: "1.0.0",
    mode: "light",
    author: "Skipo Core Team",
    description: "Warm cream, espresso brown and subtle tan palette."
  },
  tokens: {
    bg: {
      canvas: "#f5f0e8",
      surface: "rgba(245, 240, 232, 0.90)",
      surfaceHover: "rgba(238, 230, 218, 0.95)",
      blur: "blur(16px)"
    },
    text: {
      primary: "#21140e",
      muted: "#6b5c52",
      inverse: "#f5f0e8"
    },
    accent: {
      primary: "#6f4e37",
      fg: "#ffffff",
      glow: "0 0 12px rgba(111, 78, 55, 0.35)",
      hover: "#5c3f2b"
    },
    border: {
      color: "rgba(44, 24, 16, 0.85)",
      input: "rgba(44, 24, 16, 0.85)",
      style: "2px solid rgba(44, 24, 16, 0.85)"
    },
    radius: {
      base: "10px",
      sm: "6px",
      lg: "14px"
    },
    shadow: {
      card: "5px 5px 0px rgba(44, 24, 16, 0.25)",
      cardHover: "8px 8px 0px rgba(44, 24, 16, 0.35)",
      btn: "3px 3px 0px rgba(44, 24, 16, 0.25)",
      btnHover: "5px 5px 0px rgba(44, 24, 16, 0.35)",
      btnActive: "1px 1px 0px rgba(44, 24, 16, 0.25)"
    },
    font: {
      sans: "'Inter', -apple-system, 'SF Pro Display', 'Segoe UI', sans-serif",
      mono: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace"
    },
    status: {
      success: "#059669",
      successFg: "#ffffff",
      warning: "#d97706",
      warningFg: "#ffffff",
      danger: "#dc2626",
      dangerFg: "#ffffff",
      info: "#2563eb",
      infoFg: "#ffffff"
    },
    shell: {
      topToolbarHeight: "44px",
      topToolbarBg: "rgba(240, 233, 222, 0.95)",
      bottomStripHeight: "30px",
      bottomStripBg: "rgba(235, 226, 214, 0.95)",
      inspectionTextTranslucent: "rgba(33, 20, 14, 0.80)"
    }
  }
};

// src/theme/ThemePackLoader.ts
function mapTypographyAndBg(tokens) {
  return {
    "--skipo-font": tokens.font.sans,
    "--skipo-font-mono": tokens.font.mono,
    "--skipo-bg": tokens.bg.canvas,
    "--skipo-surface": tokens.bg.surface,
    "--skipo-matte-bg": tokens.bg.surface,
    "--skipo-matte-bg-hover": tokens.bg.surfaceHover,
    "--skipo-matte-blur": tokens.bg.blur,
    "--skipo-text": tokens.text.primary,
    "--skipo-text-muted": tokens.text.muted,
    "--skipo-text-inverse": tokens.text.inverse
  };
}
function mapAccentAndBorders(tokens) {
  return {
    "--skipo-accent": tokens.accent.primary,
    "--skipo-accent-fg": tokens.accent.fg,
    "--skipo-accent-glow": tokens.accent.glow,
    "--skipo-border-color": tokens.border.color,
    "--skipo-border": tokens.border.style,
    "--skipo-border-input": `2px solid ${tokens.border.input}`,
    "--skipo-radius": tokens.radius.base,
    "--skipo-radius-sm": tokens.radius.sm
  };
}
function mapShadowsAndStatus(tokens) {
  return {
    "--skipo-shadow": tokens.shadow.card,
    "--skipo-shadow-hover": tokens.shadow.cardHover,
    "--skipo-shadow-btn": tokens.shadow.btn,
    "--skipo-shadow-btn-hover": tokens.shadow.btnHover,
    "--skipo-shadow-btn-active": tokens.shadow.btnActive,
    "--skipo-success": tokens.status.success,
    "--skipo-success-fg": tokens.status.successFg,
    "--skipo-warning": tokens.status.warning,
    "--skipo-warning-fg": tokens.status.warningFg,
    "--skipo-danger": tokens.status.danger,
    "--skipo-danger-fg": tokens.status.dangerFg,
    "--skipo-info": tokens.status.info,
    "--skipo-info-fg": tokens.status.infoFg,
    "--skipo-top-toolbar-height": tokens.shell.topToolbarHeight,
    "--skipo-top-toolbar-bg": tokens.shell.topToolbarBg,
    "--skipo-bottom-strip-height": tokens.shell.bottomStripHeight,
    "--skipo-bottom-strip-bg": tokens.shell.bottomStripBg,
    "--skipo-inspection-text-color": tokens.shell.inspectionTextTranslucent
  };
}
function tokensToCssVariables(tokens) {
  return {
    ...mapTypographyAndBg(tokens),
    ...mapAccentAndBorders(tokens),
    ...mapShadowsAndStatus(tokens)
  };
}
function applyThemePack(themePack, target) {
  const vars = tokensToCssVariables(themePack.tokens);
  const el = target || (typeof document !== "undefined" ? document.documentElement : null);
  if (!el) return;
  for (const [prop, val] of Object.entries(vars)) {
    el.style.setProperty(prop, val);
  }
  el.setAttribute("data-skipo-theme", themePack.metadata.mode);
  el.setAttribute("data-skipo-theme-id", themePack.metadata.id);
}
function validateThemePack(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["Theme pack must be an object"] };
  }
  const pack = raw;
  if (!pack.metadata?.id) errors.push("Missing metadata.id");
  if (!pack.metadata?.mode) errors.push("Missing metadata.mode");
  if (!pack.tokens?.bg?.canvas) errors.push("Missing tokens.bg.canvas");
  if (!pack.tokens?.text?.primary) errors.push("Missing tokens.text.primary");
  if (!pack.tokens?.accent?.primary) errors.push("Missing tokens.accent.primary");
  if (!pack.tokens?.border?.style) errors.push("Missing tokens.border.style");
  if (!pack.tokens?.shell?.bottomStripBg) errors.push("Missing tokens.shell.bottomStripBg");
  return { valid: errors.length === 0, errors };
}

// src/theme/SkipoThemeProvider.tsx
import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";

// src/theme/canonicalElementsBase.ts
var CANONICAL_ELEMENTS_BASE = [
  // Layout & Wallpaper
  {
    id: "canvas",
    name: "Workspace Canvas",
    category: "layout",
    description: "Main background workspace canvas hosting views and nodes.",
    cssVariables: ["--skipo-bg", "--color-base"],
    firstDefinedByApp: "skipo"
  },
  {
    id: "canvasGrid",
    name: "Canvas Grid System",
    category: "layout",
    description: "Background geometric grid dots or lines on canvas.",
    cssVariables: ["--skipo-grid-dot"],
    firstDefinedByApp: "skipo"
  },
  {
    id: "wallpaperOverlay",
    name: "Wallpaper Backdrop Overlay",
    category: "layout",
    description: "Translucent or blurred tint overlay above canvas wallpapers.",
    cssVariables: ["--wallpaper-overlay-color", "--wallpaper-overlay-opacity"],
    firstDefinedByApp: "docustack"
  },
  // App Shell & Bars
  {
    id: "topToolbar",
    name: "Top Navigation Toolbar",
    category: "navigation",
    description: "44px application header toolbar with flat tabs.",
    cssVariables: ["--skipo-top-toolbar-height", "--skipo-top-toolbar-bg"],
    firstDefinedByApp: "skipo"
  },
  {
    id: "bottomStrip",
    name: "Bottom Inspection Strip",
    category: "navigation",
    description: "30px persistent inspection strip for system hover telemetry.",
    cssVariables: ["--skipo-bottom-strip-height", "--skipo-bottom-strip-bg"],
    firstDefinedByApp: "skipo"
  },
  {
    id: "headerBar",
    name: "Workspace Header Bar",
    category: "navigation",
    description: "App brand header with breadcrumbs and workspace switches.",
    cssVariables: ["--color-surface-subtle", "--color-border"],
    firstDefinedByApp: "docustack"
  },
  {
    id: "workspaceTabBar",
    name: "Workspace Tab Bar",
    category: "navigation",
    description: "Tab selector for switching open vaults or documents.",
    cssVariables: ["--color-surface", "--color-accent"],
    firstDefinedByApp: "docustack"
  },
  // Surfaces & Containers
  {
    id: "card",
    name: "Tactile Content Card",
    category: "surface",
    description: "2.5D container card for list items and metrics.",
    cssVariables: ["--skipo-surface", "--skipo-shadow", "--skipo-border"],
    firstDefinedByApp: "skipo"
  },
  {
    id: "modalDialog",
    name: "Modal Dialog Overlay",
    category: "surface",
    description: "Centered modal container for forms and confirmations.",
    cssVariables: ["--skipo-surface", "--skipo-border", "--skipo-matte-blur"],
    firstDefinedByApp: "skipo"
  },
  {
    id: "contextMenu",
    name: "Floating Context Menu",
    category: "surface",
    description: "Right-click popover action menu with keyboard navigation.",
    cssVariables: ["--skipo-surface", "--skipo-border"],
    firstDefinedByApp: "skipo"
  },
  {
    id: "floatingPanel",
    name: "Floating Inspector Panel",
    category: "surface",
    description: "Floating detail panel with 8-way resize and pinning.",
    cssVariables: ["--skipo-surface", "--skipo-border"],
    firstDefinedByApp: "skipo"
  },
  // Controls
  {
    id: "buttonPrimary",
    name: "Primary Action Button",
    category: "control",
    description: "Main interactive call-to-action button.",
    cssVariables: ["--skipo-accent", "--skipo-accent-fg", "--skipo-shadow-btn"],
    firstDefinedByApp: "skipo"
  },
  {
    id: "buttonSecondary",
    name: "Secondary Action Button",
    category: "control",
    description: "Alternative action button with subtle outline.",
    cssVariables: ["--color-surface", "--color-text", "--skipo-border"],
    firstDefinedByApp: "skipo"
  },
  {
    id: "buttonGhost",
    name: "Ghost Action Button",
    category: "control",
    description: "Transparent button used in toolbars.",
    cssVariables: ["--color-text"],
    firstDefinedByApp: "docustack"
  },
  {
    id: "inputField",
    name: "Text Input Field",
    category: "control",
    description: "Text and search inputs with brutalist focus borders.",
    cssVariables: ["--skipo-border-input", "--skipo-surface"],
    firstDefinedByApp: "skipo"
  },
  {
    id: "selectDropdown",
    name: "Select Dropdown",
    category: "control",
    description: "Themed custom dropdown for options.",
    cssVariables: ["--color-surface", "--color-text", "--color-border"],
    firstDefinedByApp: "docustack"
  },
  {
    id: "badge",
    name: "Status Badge",
    category: "feedback",
    description: "Compact tag for metadata, state, and status counts.",
    cssVariables: ["--skipo-accent", "--skipo-accent-fg"],
    firstDefinedByApp: "skipo"
  }
];

// src/theme/canonicalElementsDomain.ts
var CANONICAL_ELEMENTS_DOMAIN = [
  // Specialized & Domain
  {
    id: "kanbanBoard",
    name: "Kanban Board Viewport",
    category: "specialized",
    description: "Multi-column drag-and-drop workflow canvas.",
    cssVariables: ["--color-base"],
    firstDefinedByApp: "docustack"
  },
  {
    id: "kanbanColumn",
    name: "Kanban Category Column",
    category: "specialized",
    description: "Vertical column container with optional column wallpaper.",
    cssVariables: ["--color-surface", "--color-border"],
    firstDefinedByApp: "docustack"
  },
  {
    id: "kanbanColumnOverlay",
    name: "Kanban Column Wallpaper Overlay",
    category: "specialized",
    description: "Tint overlay specific to category columns.",
    cssVariables: ["--column-overlay-color", "--column-overlay-opacity"],
    firstDefinedByApp: "docustack"
  },
  {
    id: "documentCard",
    name: "Document Kanban Card",
    category: "specialized",
    description: "Sortable document card with preview metadata.",
    cssVariables: ["--color-surface", "--color-border"],
    firstDefinedByApp: "docustack"
  },
  {
    id: "graphCanvas",
    name: "Force Graph Canvas",
    category: "graph",
    description: "Interactive D3 / force-directed node graph layout.",
    cssVariables: ["--color-base", "--color-border"],
    firstDefinedByApp: "docustack"
  },
  {
    id: "graphNodeRoot",
    name: "Graph Root Vault Node",
    category: "graph",
    description: "Central root node in graph topology.",
    cssVariables: ["--color-accent"],
    firstDefinedByApp: "docustack"
  },
  {
    id: "graphNodeLeaf",
    name: "Graph Document Leaf Node",
    category: "graph",
    description: "Standard document or tag node.",
    cssVariables: ["--color-surface", "--color-text"],
    firstDefinedByApp: "docustack"
  },
  {
    id: "graphEdge",
    name: "Graph Connection Wire",
    category: "graph",
    description: "Connecting bezier curve or wire between graph nodes.",
    cssVariables: ["--skipo-text-muted"],
    firstDefinedByApp: "skipo"
  },
  {
    id: "codeEditor",
    name: "Brutalist Code & Markdown Editor",
    category: "specialized",
    description: "Monaco or brutalist code/document editor pane.",
    cssVariables: ["--font-mono", "--color-surface"],
    firstDefinedByApp: "docustack"
  },
  {
    id: "aiChatPanel",
    name: "AI Document Chat Panel",
    category: "specialized",
    description: "Collapsible floating drawer for document intelligence chat.",
    cssVariables: ["--color-surface", "--color-border"],
    firstDefinedByApp: "docustack"
  }
];

// src/theme/canonicalElements.ts
var CANONICAL_ELEMENTS = [...CANONICAL_ELEMENTS_BASE, ...CANONICAL_ELEMENTS_DOMAIN];

// src/theme/elements.ts
var ElementLedgerRegistry = class {
  elements = /* @__PURE__ */ new Map();
  constructor() {
    this.reset();
  }
  reset() {
    this.elements.clear();
    for (const el of CANONICAL_ELEMENTS) {
      this.elements.set(el.id, { ...el });
    }
  }
  register(def) {
    const existing = this.elements.get(def.id);
    if (existing) {
      if (existing.name !== def.name || existing.category !== def.category) {
        throw new Error(
          `Cannot redefine existing UI element "${def.id}" from app "${existing.firstDefinedByApp}" with different semantics in app "${def.firstDefinedByApp}". Reuse canonical definition.`
        );
      }
      return;
    }
    this.elements.set(def.id, { ...def });
  }
  get(id) {
    return this.elements.get(id);
  }
  has(id) {
    return this.elements.has(id);
  }
  getAll() {
    return Array.from(this.elements.values());
  }
  count() {
    return this.elements.size;
  }
};
var centralLedger = new ElementLedgerRegistry();
function registerUIElement(def) {
  centralLedger.register(def);
}
function getUIElement(id) {
  return centralLedger.get(id);
}
function getAllUIElements() {
  return centralLedger.getAll();
}

// src/theme/status.ts
function getThemeEngineStatus(engine) {
  const socket = engine.getSocket();
  const basePackId = engine.getActiveBasePackId();
  const basePack = engine.getThemePack(basePackId);
  const overrides = engine.getElementOverrides();
  const elementsReport = {};
  const uncoveredElements = [];
  for (const elId of socket.elementIds) {
    const canonical = centralLedger.get(elId);
    const resolved = engine.resolveElementTheme(elId);
    if (resolved.isFallback) {
      uncoveredElements.push(elId);
    }
    elementsReport[elId] = {
      elementId: elId,
      name: canonical?.name || elId,
      category: canonical?.category || "specialized",
      appliedThemePackId: resolved.appliedPackId,
      appliedVariant: resolved.appliedVariant,
      isOverridden: resolved.isOverridden,
      isFallback: resolved.isFallback,
      effectiveCssVars: resolved.value.cssVars || {},
      effectiveStyles: resolved.value.styles || {},
      effectiveEffects: resolved.value.effects || {},
      effectiveAssets: resolved.value.assets || {}
    };
  }
  const relevantPackIds = /* @__PURE__ */ new Set([basePackId, ...Object.values(overrides)]);
  const ignoredElementsSet = /* @__PURE__ */ new Set();
  for (const packId of relevantPackIds) {
    const pack = engine.getThemePack(packId);
    if (!pack) continue;
    const styles = pack.variants?.[engine.getMode()]?.elementStyles || pack.elementStyles;
    for (const elKey of Object.keys(styles)) {
      if (!socket.elementIds.includes(elKey)) {
        ignoredElementsSet.add(elKey);
      }
    }
  }
  return {
    appId: socket.appId,
    socketVersion: socket.version,
    registeredElementsCount: socket.elementIds.length,
    activeBasePackId: basePackId,
    activeBasePackName: basePack?.metadata.name || basePackId,
    activeMode: engine.getMode(),
    elementOverridesCount: Object.keys(overrides).length,
    elementOverrides: overrides,
    elements: elementsReport,
    uncoveredElements,
    ignoredElements: Array.from(ignoredElementsSet),
    timestamp: Date.now(),
    isValid: uncoveredElements.length === 0
  };
}

// src/theme/SkipoThemeProvider.tsx
import { jsx } from "react/jsx-runtime";
var SkipoThemeContext = createContext(null);
function SkipoThemeProvider({
  children,
  defaultTheme = "dark",
  initialThemePack,
  engine
}) {
  const [theme, setThemeState] = useState(
    engine ? engine.getMode() : defaultTheme
  );
  const [themePack, setThemePackState] = useState(
    initialThemePack || (defaultTheme === "dark" ? DEFAULT_DARK_THEME_PACK : DEFAULT_LIGHT_THEME_PACK)
  );
  const [elementOverrides, setElementOverrides] = useState(
    engine ? engine.getElementOverrides() : {}
  );
  const [status, setStatus] = useState(
    engine ? getThemeEngineStatus(engine) : void 0
  );
  const applyPack = useCallback((pack) => {
    setThemePackState(pack);
    setThemeState(pack.metadata.mode);
    if (typeof document !== "undefined") {
      applyThemePack(pack);
    }
  }, []);
  const setTheme = useCallback((mode) => {
    if (engine) {
      engine.setMode(mode);
      setThemeState(mode);
    } else {
      applyPack(mode === "dark" ? DEFAULT_DARK_THEME_PACK : DEFAULT_LIGHT_THEME_PACK);
    }
  }, [engine, applyPack]);
  const toggleTheme = useCallback(() => {
    if (engine) {
      const next = engine.toggleMode();
      setThemeState(next);
    } else {
      setTheme(theme === "dark" ? "light" : "dark");
    }
  }, [engine, theme, setTheme]);
  const setElementOverride = useCallback((elementId, packId) => {
    if (engine) {
      engine.setElementOverride(elementId, packId);
      setElementOverrides(engine.getElementOverrides());
      setStatus(getThemeEngineStatus(engine));
    }
  }, [engine]);
  const clearElementOverride = useCallback((elementId) => {
    if (engine) {
      engine.clearElementOverride(elementId);
      setElementOverrides(engine.getElementOverrides());
      setStatus(getThemeEngineStatus(engine));
    }
  }, [engine]);
  useEffect(() => {
    if (engine) {
      engine.applyToDOM();
      setThemeState(engine.getMode());
      setElementOverrides(engine.getElementOverrides());
      setStatus(getThemeEngineStatus(engine));
      const unsub = engine.subscribe((state) => {
        setThemeState(state.activeMode);
        setElementOverrides(state.elementOverrides);
        setStatus(getThemeEngineStatus(engine));
      });
      return unsub;
    } else {
      applyPack(initialThemePack || (defaultTheme === "dark" ? DEFAULT_DARK_THEME_PACK : DEFAULT_LIGHT_THEME_PACK));
    }
  }, [engine, applyPack, defaultTheme, initialThemePack]);
  const value = useMemo(() => ({
    theme,
    themePack,
    engine,
    status,
    elementOverrides,
    setTheme,
    setThemePack: applyPack,
    toggleTheme,
    setElementOverride,
    clearElementOverride
  }), [theme, themePack, engine, status, elementOverrides, setTheme, applyPack, toggleTheme, setElementOverride, clearElementOverride]);
  return /* @__PURE__ */ jsx(SkipoThemeContext.Provider, { value, children: /* @__PURE__ */ jsx("div", { "data-skipo-theme": theme, className: "skipo-root", children }) });
}
function useSkipoTheme() {
  const ctx = useContext(SkipoThemeContext);
  if (!ctx) throw new Error("useSkipoTheme must be used within <SkipoThemeProvider>");
  return ctx;
}

// src/theme/palettes.ts
var palettes = {
  dark: { bg: "#16181d", text: "#f1f5f9" },
  light: { bg: "#f5f0e8", text: "#1a1a1a" }
};

// src/theme/socket.ts
function validateSocketElements(socket) {
  const missing = [];
  for (const elId of socket.elementIds) {
    if (!centralLedger.has(elId)) {
      missing.push(elId);
    }
  }
  return {
    valid: missing.length === 0,
    missing
  };
}
function createAppThemeSocket(definition) {
  if (!definition.appId || !definition.appName) {
    throw new Error("AppThemeSocket requires appId and appName.");
  }
  if (!Array.isArray(definition.elementIds) || definition.elementIds.length === 0) {
    throw new Error(`AppThemeSocket "${definition.appId}" must define at least one elementId.`);
  }
  const check = validateSocketElements(definition);
  if (!check.valid) {
    throw new Error(
      `AppThemeSocket "${definition.appId}" references unknown UI elements: [${check.missing.join(", ")}]. Register them with the centralLedger first.`
    );
  }
  return {
    ...definition,
    version: definition.version || "1.0.0"
  };
}

// src/theme/tokenMapper.ts
function mapSemanticTokensToCssVars(tokens) {
  if (!tokens) return {};
  return {
    "--skipo-font": tokens.font?.sans || "",
    "--skipo-font-mono": tokens.font?.mono || "",
    "--skipo-bg": tokens.bg?.canvas || "",
    "--skipo-surface": tokens.bg?.surface || "",
    "--skipo-text": tokens.text?.primary || "",
    "--skipo-text-muted": tokens.text?.muted || "",
    "--skipo-accent": tokens.accent?.primary || "",
    "--skipo-accent-fg": tokens.accent?.fg || "",
    "--skipo-border-color": tokens.border?.color || "",
    "--skipo-border": tokens.border?.style || "",
    "--skipo-radius": tokens.radius?.base || "",
    "--skipo-shadow": tokens.shadow?.card || ""
  };
}

// src/theme/schema/cascade.ts
function resolveTypographyCascade(typo, fallbackAccent = "#D4AF37") {
  const globalFont = typo?.globalFont || "'Courier Prime', monospace";
  const globalMonoFont = typo?.globalMonoFont || "'JetBrains Mono', monospace";
  const globalColor = typo?.globalColor || "#F3EDE0";
  const globalAccentColor = typo?.globalAccentColor || fallbackAccent;
  const headingFont = typo?.headingFont || globalFont;
  const bodyFont = typo?.bodyFont || globalFont;
  const codeFont = typo?.codeFont || globalMonoFont;
  const sec = typo?.sections || {};
  const cssVars = {
    "--skipo-font-global": globalFont,
    "--skipo-font-mono": globalMonoFont,
    "--skipo-color-global": globalColor,
    "--skipo-color-accent": globalAccentColor,
    "--skipo-font-heading": headingFont,
    "--skipo-font-body": bodyFont,
    "--skipo-font-code": codeFont,
    // H1
    "--skipo-font-h1": sec.h1?.font || headingFont,
    "--skipo-h1-size": sec.h1?.fontSize || "28px",
    "--skipo-h1-weight": String(sec.h1?.fontWeight || "800"),
    "--skipo-h1-color": sec.h1?.color || globalAccentColor,
    "--skipo-h1-border": sec.h1?.borderBottom || `2px solid ${globalAccentColor}40`,
    // H2
    "--skipo-font-h2": sec.h2?.font || headingFont,
    "--skipo-h2-size": sec.h2?.fontSize || "22px",
    "--skipo-h2-weight": String(sec.h2?.fontWeight || "700"),
    "--skipo-h2-color": sec.h2?.color || globalColor,
    "--skipo-h2-border": sec.h2?.borderBottom || "1px solid rgba(0,0,0,0.15)",
    // H3
    "--skipo-font-h3": sec.h3?.font || headingFont,
    "--skipo-h3-size": sec.h3?.fontSize || "18px",
    "--skipo-h3-weight": String(sec.h3?.fontWeight || "700"),
    "--skipo-h3-color": sec.h3?.color || globalColor,
    // Paragraph / Body
    "--skipo-font-p": sec.p?.font || bodyFont,
    "--skipo-p-size": sec.p?.fontSize || "15px",
    "--skipo-p-line-height": sec.p?.lineHeight || "1.6",
    "--skipo-p-color": sec.p?.color || globalColor,
    // Blockquote
    "--skipo-blockquote-font": sec.blockquote?.font || bodyFont,
    "--skipo-blockquote-color": sec.blockquote?.color || globalColor,
    "--skipo-blockquote-bg": sec.blockquote?.bg || "rgba(0,0,0,0.2)",
    "--skipo-blockquote-border": sec.blockquote?.borderLeftColor || globalAccentColor,
    // Lists
    "--skipo-list-marker-color": sec.ul?.markerColor || globalAccentColor,
    // Code
    "--skipo-code-font": sec.inlineCode?.font || codeFont,
    "--skipo-code-color": sec.inlineCode?.color || globalAccentColor,
    "--skipo-code-bg": sec.inlineCode?.bg || `${globalAccentColor}20`,
    "--skipo-code-border": sec.inlineCode?.border || `1px solid ${globalAccentColor}40`,
    // Code Block
    "--skipo-codeblock-font": sec.codeBlock?.font || codeFont,
    "--skipo-codeblock-bg": sec.codeBlock?.bg || "#121214",
    // Table
    "--skipo-table-header-bg": sec.table?.headerBg || globalAccentColor,
    "--skipo-table-header-color": sec.table?.headerColor || "#000000",
    // Link
    "--skipo-link-color": sec.link?.color || globalAccentColor
  };
  return {
    globalFont,
    globalMonoFont,
    globalColor,
    globalAccentColor,
    headingFont,
    bodyFont,
    codeFont,
    cssVars
  };
}

// src/theme/engine.ts
var ThemeEngine = class {
  socket;
  packs = /* @__PURE__ */ new Map();
  activeBasePackId;
  activeMode = "dark";
  elementOverrides = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  constructor(socket, initialPacks = [], initialMode = "dark") {
    this.socket = socket;
    for (const pack of initialPacks) this.registerThemePack(pack);
    this.activeBasePackId = socket.defaultThemePackId || initialPacks[0]?.metadata.id || "";
    this.activeMode = initialMode;
  }
  registerThemePack(pack) {
    this.packs.set(pack.metadata.id, pack);
  }
  getThemePack(packId) {
    return this.packs.get(packId);
  }
  getAllThemePacks() {
    return Array.from(this.packs.values());
  }
  getSocket() {
    return this.socket;
  }
  getActiveBasePackId() {
    return this.activeBasePackId;
  }
  getMode() {
    return this.activeMode;
  }
  setBaseThemePack(packId) {
    if (!this.packs.has(packId)) throw new Error(`Theme pack "${packId}" is not registered.`);
    this.activeBasePackId = packId;
    this.notify();
    this.applyToDOM();
  }
  setMode(mode) {
    if (this.activeMode === mode) return;
    this.activeMode = mode;
    this.notify();
    this.applyToDOM();
  }
  toggleMode() {
    this.activeMode = this.activeMode === "dark" ? "light" : "dark";
    this.notify();
    this.applyToDOM();
    return this.activeMode;
  }
  setElementOverride(elementId, packId) {
    if (!this.socket.elementIds.includes(elementId)) {
      throw new Error(`Element "${elementId}" is not part of app socket "${this.socket.appId}".`);
    }
    if (!this.packs.has(packId)) throw new Error(`Theme pack "${packId}" is not registered.`);
    this.elementOverrides.set(elementId, packId);
    this.notify();
    this.applyToDOM();
  }
  clearElementOverride(elementId) {
    this.elementOverrides.delete(elementId);
    this.notify();
    this.applyToDOM();
  }
  clearAllOverrides() {
    this.elementOverrides.clear();
    this.notify();
    this.applyToDOM();
  }
  batchSetElementOverrides(overrides) {
    for (const [elId, packId] of Object.entries(overrides)) {
      if (this.socket.elementIds.includes(elId) && this.packs.has(packId)) {
        this.elementOverrides.set(elId, packId);
      }
    }
    this.notify();
    this.applyToDOM();
  }
  getElementOverrides() {
    const res = {};
    for (const [elId, packId] of this.elementOverrides.entries()) res[elId] = packId;
    return res;
  }
  resolveElementTheme(elementId) {
    const overridePackId = this.elementOverrides.get(elementId);
    const targetPackId = overridePackId || this.activeBasePackId;
    const targetPack = this.packs.get(targetPackId);
    const isOverridden = !!overridePackId;
    if (targetPack) {
      const modeVariant = targetPack.variants?.[this.activeMode]?.elementStyles?.[elementId];
      if (modeVariant) return { appliedPackId: targetPackId, appliedVariant: this.activeMode, isOverridden, isFallback: false, value: modeVariant };
      const defaultStyle = targetPack.elementStyles?.[elementId];
      if (defaultStyle) return { appliedPackId: targetPackId, appliedVariant: targetPack.metadata.mode || this.activeMode, isOverridden, isFallback: false, value: defaultStyle };
    }
    const basePack = this.packs.get(this.activeBasePackId);
    if (basePack) {
      const baseModeVariant = basePack.variants?.[this.activeMode]?.elementStyles?.[elementId];
      if (baseModeVariant) return { appliedPackId: this.activeBasePackId, appliedVariant: this.activeMode, isOverridden: false, isFallback: false, value: baseModeVariant };
      const baseDefaultStyle = basePack.elementStyles?.[elementId];
      if (baseDefaultStyle) return { appliedPackId: this.activeBasePackId, appliedVariant: basePack.metadata.mode || this.activeMode, isOverridden: false, isFallback: false, value: baseDefaultStyle };
    }
    const fallback = this.socket.elementDefaults?.[elementId] || {};
    return { appliedPackId: targetPackId, appliedVariant: this.activeMode, isOverridden, isFallback: true, value: fallback };
  }
  computeAllCssVariables() {
    const basePack = this.packs.get(this.activeBasePackId);
    const cssVars = {};
    const tokens = basePack?.variants?.[this.activeMode]?.tokens || basePack?.tokens;
    if (tokens) Object.assign(cssVars, mapSemanticTokensToCssVars(tokens));
    const typo = basePack?.variants?.[this.activeMode]?.typography || basePack?.typography;
    if (typo) {
      const resolvedTypo = resolveTypographyCascade(typo, tokens?.accent.primary);
      Object.assign(cssVars, resolvedTypo.cssVars);
    }
    for (const elId of this.socket.elementIds) {
      const resolved = this.resolveElementTheme(elId);
      if (resolved.value.cssVars) Object.assign(cssVars, resolved.value.cssVars);
    }
    return cssVars;
  }
  applyToDOM(target) {
    if (typeof document === "undefined") return;
    const root = target || document.documentElement;
    const vars = this.computeAllCssVariables();
    for (const [key, val] of Object.entries(vars)) {
      if (val) root.style.setProperty(key, val);
    }
    root.setAttribute("data-skipo-theme-id", this.activeBasePackId);
    root.setAttribute("data-skipo-theme-mode", this.activeMode);
    root.setAttribute("data-theme", this.activeMode);
    root.setAttribute("data-skipo-overrides-count", String(this.elementOverrides.size));
    if (this.activeMode === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  notify() {
    const state = {
      activeBasePackId: this.activeBasePackId,
      activeMode: this.activeMode,
      elementOverrides: this.getElementOverrides()
    };
    for (const fn of this.listeners) fn(state);
  }
};

// src/theme/schema/themePack.schema.ts
import { z as z3 } from "zod";

// src/theme/schema/tokens.schema.ts
import { z } from "zod";
var SkipoSemanticTokensSchema = z.object({
  bg: z.object({
    canvas: z.string(),
    surface: z.string(),
    surfaceHover: z.string(),
    blur: z.string()
  }),
  text: z.object({
    primary: z.string(),
    muted: z.string(),
    inverse: z.string()
  }),
  accent: z.object({
    primary: z.string(),
    fg: z.string(),
    glow: z.string(),
    hover: z.string().optional()
  }),
  border: z.object({
    color: z.string(),
    input: z.string(),
    style: z.string()
  }),
  radius: z.object({
    base: z.string(),
    sm: z.string(),
    lg: z.string().optional()
  }),
  shadow: z.object({
    card: z.string(),
    cardHover: z.string(),
    btn: z.string(),
    btnHover: z.string(),
    btnActive: z.string()
  }),
  font: z.object({
    sans: z.string(),
    mono: z.string()
  }),
  status: z.object({
    success: z.string(),
    successFg: z.string(),
    warning: z.string(),
    warningFg: z.string(),
    danger: z.string(),
    dangerFg: z.string(),
    info: z.string(),
    infoFg: z.string()
  }),
  shell: z.object({
    topToolbarHeight: z.string(),
    topToolbarBg: z.string(),
    bottomStripHeight: z.string(),
    bottomStripBg: z.string(),
    inspectionTextTranslucent: z.string()
  })
});

// src/theme/schema/typography.schema.ts
import { z as z2 } from "zod";
var HeadingLevelSchema = z2.object({
  font: z2.string().optional(),
  fontSize: z2.string().optional(),
  fontWeight: z2.union([z2.string(), z2.number()]).optional(),
  lineHeight: z2.string().optional(),
  letterSpacing: z2.string().optional(),
  color: z2.string().optional(),
  borderBottom: z2.string().optional(),
  textTransform: z2.string().optional()
});
var ParagraphStyleSchema = z2.object({
  font: z2.string().optional(),
  fontSize: z2.string().optional(),
  fontWeight: z2.union([z2.string(), z2.number()]).optional(),
  lineHeight: z2.string().optional(),
  color: z2.string().optional(),
  opacity: z2.union([z2.string(), z2.number()]).optional(),
  textAlign: z2.string().optional()
});
var BlockquoteStyleSchema = z2.object({
  font: z2.string().optional(),
  fontSize: z2.string().optional(),
  fontStyle: z2.string().optional(),
  color: z2.string().optional(),
  bg: z2.string().optional(),
  borderLeftColor: z2.string().optional(),
  borderLeftWidth: z2.string().optional(),
  calloutTitle: z2.string().optional(),
  calloutColor: z2.string().optional()
});
var ListStyleSchema = z2.object({
  font: z2.string().optional(),
  fontSize: z2.string().optional(),
  lineHeight: z2.string().optional(),
  markerColor: z2.string().optional(),
  spacing: z2.string().optional()
});
var CodeStyleSchema = z2.object({
  font: z2.string().optional(),
  fontSize: z2.string().optional(),
  color: z2.string().optional(),
  bg: z2.string().optional(),
  border: z2.string().optional(),
  radius: z2.string().optional(),
  headerBg: z2.string().optional(),
  shadow: z2.string().optional()
});
var TableStyleSchema = z2.object({
  font: z2.string().optional(),
  headerBg: z2.string().optional(),
  headerColor: z2.string().optional(),
  border: z2.string().optional(),
  cellBg: z2.string().optional(),
  cellPadding: z2.string().optional()
});
var LinkStyleSchema = z2.object({
  color: z2.string().optional(),
  textDecoration: z2.string().optional(),
  hoverColor: z2.string().optional(),
  hoverUnderline: z2.boolean().optional()
});
var HorizontalRuleStyleSchema = z2.object({
  color: z2.string().optional(),
  borderStyle: z2.string().optional(),
  height: z2.string().optional()
});
var MarkdownSectionStylesSchema = z2.object({
  h1: HeadingLevelSchema.optional(),
  h2: HeadingLevelSchema.optional(),
  h3: HeadingLevelSchema.optional(),
  h4: HeadingLevelSchema.optional(),
  h5: HeadingLevelSchema.optional(),
  h6: HeadingLevelSchema.optional(),
  p: ParagraphStyleSchema.optional(),
  blockquote: BlockquoteStyleSchema.optional(),
  ul: ListStyleSchema.optional(),
  ol: ListStyleSchema.optional(),
  inlineCode: CodeStyleSchema.optional(),
  codeBlock: CodeStyleSchema.optional(),
  table: TableStyleSchema.optional(),
  link: LinkStyleSchema.optional(),
  hr: HorizontalRuleStyleSchema.optional()
});
var ThemeTypographySchema = z2.object({
  globalFont: z2.string(),
  globalMonoFont: z2.string(),
  globalColor: z2.string().optional(),
  globalAccentColor: z2.string().optional(),
  headingFont: z2.string().optional(),
  bodyFont: z2.string().optional(),
  codeFont: z2.string().optional(),
  sections: MarkdownSectionStylesSchema.optional()
});

// src/theme/schema/themePack.schema.ts
var SkipoThemeMetadataSchema = z3.object({
  id: z3.string().min(1),
  name: z3.string().min(1),
  version: z3.string().default("1.0.0"),
  mode: z3.enum(["dark", "light"]).default("dark"),
  author: z3.string().optional(),
  description: z3.string().optional()
});
var UIElementThemeValueSchema = z3.object({
  cssVars: z3.record(z3.string(), z3.string()).optional(),
  styles: z3.record(z3.string(), z3.union([z3.string(), z3.number()])).optional(),
  effects: z3.object({
    animation: z3.string().optional(),
    transition: z3.string().optional(),
    glow: z3.string().optional(),
    filter: z3.string().optional(),
    transformHover: z3.string().optional()
  }).optional(),
  assets: z3.object({
    wallpaper: z3.string().optional(),
    overlayImage: z3.string().optional(),
    texture: z3.string().optional(),
    iconGlyph: z3.string().optional(),
    mediaUrl: z3.string().optional()
  }).optional()
});
var ThemeVariantDefinitionSchema = z3.object({
  mode: z3.enum(["dark", "light"]),
  tokens: SkipoSemanticTokensSchema.optional(),
  typography: ThemeTypographySchema.optional(),
  elementStyles: z3.record(z3.string(), UIElementThemeValueSchema).default({}),
  customCss: z3.string().optional()
});
var ModularThemePackSchema = z3.object({
  metadata: SkipoThemeMetadataSchema,
  variants: z3.object({
    dark: ThemeVariantDefinitionSchema,
    light: ThemeVariantDefinitionSchema
  }),
  typography: ThemeTypographySchema.optional(),
  tokens: SkipoSemanticTokensSchema.optional(),
  elementStyles: z3.record(z3.string(), UIElementThemeValueSchema).default({}),
  customCss: z3.string().optional()
});
function validateModularThemePack(pack) {
  return ModularThemePackSchema.parse(pack);
}
function safeValidateModularThemePack(pack) {
  return ModularThemePackSchema.safeParse(pack);
}

// src/theme/packs/docustack-dark-gold/tokens.ts
var darkTokens = {
  bg: { canvas: "#121214", surface: "#1E1E24", surfaceHover: "#26262E", blur: "blur(16px)" },
  text: { primary: "#F3EDE0", muted: "#A0A0B0", inverse: "#121214" },
  accent: { primary: "#D4AF37", fg: "#000000", glow: "0 0 16px rgba(212, 175, 55, 0.45)", hover: "#B59443" },
  border: { color: "#000000", input: "#D4AF37", style: "2px solid #000000" },
  radius: { base: "0px", sm: "0px", lg: "0px" },
  shadow: {
    card: "4px 4px 0px #000000",
    cardHover: "6px 6px 0px #000000",
    btn: "2px 2px 0px #000000",
    btnHover: "3px 3px 0px #000000",
    btnActive: "1px 1px 0px #000000"
  },
  font: { sans: "'Courier Prime', monospace", mono: "'JetBrains Mono', monospace" },
  status: {
    success: "#10B981",
    successFg: "#000000",
    warning: "#F59E0B",
    warningFg: "#000000",
    danger: "#EF4444",
    dangerFg: "#FFFFFF",
    info: "#3B82F6",
    infoFg: "#FFFFFF"
  },
  shell: {
    topToolbarHeight: "44px",
    topToolbarBg: "rgba(18, 18, 20, 0.95)",
    bottomStripHeight: "30px",
    bottomStripBg: "rgba(18, 18, 20, 0.95)",
    inspectionTextTranslucent: "rgba(243, 237, 224, 0.85)"
  }
};
var lightTokens = {
  bg: { canvas: "#F8F6F0", surface: "#EDE8DC", surfaceHover: "#E4DEC0", blur: "blur(16px)" },
  text: { primary: "#18181A", muted: "#6E6B65", inverse: "#F8F6F0" },
  accent: { primary: "#B58900", fg: "#FFFFFF", glow: "0 0 14px rgba(181, 137, 0, 0.35)", hover: "#997400" },
  border: { color: "#2A2518", input: "#B58900", style: "2px solid #2A2518" },
  radius: { base: "0px", sm: "0px", lg: "0px" },
  shadow: {
    card: "4px 4px 0px #2A2518",
    cardHover: "6px 6px 0px #2A2518",
    btn: "2px 2px 0px #2A2518",
    btnHover: "3px 3px 0px #2A2518",
    btnActive: "1px 1px 0px #2A2518"
  },
  font: { sans: "'Courier Prime', monospace", mono: "'JetBrains Mono', monospace" },
  status: {
    success: "#059669",
    successFg: "#FFFFFF",
    warning: "#D97706",
    warningFg: "#FFFFFF",
    danger: "#DC2626",
    dangerFg: "#FFFFFF",
    info: "#2563EB",
    infoFg: "#FFFFFF"
  },
  shell: {
    topToolbarHeight: "44px",
    topToolbarBg: "#EDE8DC",
    bottomStripHeight: "30px",
    bottomStripBg: "#E4DEC0",
    inspectionTextTranslucent: "rgba(24, 24, 26, 0.85)"
  }
};

// src/theme/packs/docustack-dark-gold/typography.ts
var darkTypography = {
  globalFont: "'Courier Prime', monospace",
  globalMonoFont: "'JetBrains Mono', monospace",
  globalColor: "#F3EDE0",
  globalAccentColor: "#D4AF37",
  headingFont: "'Courier Prime', monospace",
  bodyFont: "'Courier Prime', monospace",
  codeFont: "'JetBrains Mono', monospace",
  sections: {
    h1: { fontSize: "28px", fontWeight: "800", lineHeight: "1.2", color: "#D4AF37", borderBottom: "2px solid rgba(212, 175, 55, 0.4)" },
    h2: { fontSize: "22px", fontWeight: "700", lineHeight: "1.3", color: "#F3EDE0", borderBottom: "1px solid rgba(212, 175, 55, 0.2)" },
    h3: { fontSize: "18px", fontWeight: "700", lineHeight: "1.4", color: "#F3EDE0" },
    h4: { fontSize: "16px", fontWeight: "600", lineHeight: "1.4", color: "#D4AF37" },
    h5: { fontSize: "14px", fontWeight: "600", lineHeight: "1.4", color: "#F3EDE0" },
    h6: { fontSize: "13px", fontWeight: "600", lineHeight: "1.4", color: "#A0A0B0" },
    p: { fontSize: "15px", lineHeight: "1.6", color: "#F3EDE0" },
    blockquote: { fontStyle: "italic", color: "#D4AF37", bg: "rgba(212, 175, 55, 0.08)", borderLeftColor: "#D4AF37", borderLeftWidth: "4px" },
    ul: { markerColor: "#D4AF37", spacing: "6px" },
    ol: { markerColor: "#D4AF37", spacing: "6px" },
    inlineCode: { fontSize: "13px", color: "#D4AF37", bg: "rgba(212, 175, 55, 0.15)", border: "1px solid rgba(212, 175, 55, 0.3)", radius: "3px" },
    codeBlock: { fontSize: "13px", color: "#F3EDE0", bg: "#18181C", border: "1px solid #333333", radius: "4px" },
    table: { headerBg: "#D4AF37", headerColor: "#000000", border: "1px solid #333333", cellBg: "#1E1E24" },
    link: { color: "#D4AF37", textDecoration: "none", hoverColor: "#FFFFFF", hoverUnderline: true },
    hr: { color: "#D4AF37", borderStyle: "solid", height: "2px" }
  }
};
var lightTypography = {
  globalFont: "'Courier Prime', monospace",
  globalMonoFont: "'JetBrains Mono', monospace",
  globalColor: "#18181A",
  globalAccentColor: "#B58900",
  headingFont: "'Courier Prime', monospace",
  bodyFont: "'Courier Prime', monospace",
  codeFont: "'JetBrains Mono', monospace",
  sections: {
    h1: { fontSize: "28px", fontWeight: "800", lineHeight: "1.2", color: "#B58900", borderBottom: "2px solid rgba(181, 137, 0, 0.35)" },
    h2: { fontSize: "22px", fontWeight: "700", lineHeight: "1.3", color: "#18181A", borderBottom: "1px solid rgba(181, 137, 0, 0.2)" },
    h3: { fontSize: "18px", fontWeight: "700", lineHeight: "1.4", color: "#18181A" },
    h4: { fontSize: "16px", fontWeight: "600", lineHeight: "1.4", color: "#B58900" },
    h5: { fontSize: "14px", fontWeight: "600", lineHeight: "1.4", color: "#18181A" },
    h6: { fontSize: "13px", fontWeight: "600", lineHeight: "1.4", color: "#6E6B65" },
    p: { fontSize: "15px", lineHeight: "1.6", color: "#18181A" },
    blockquote: { fontStyle: "italic", color: "#8A6800", bg: "rgba(181, 137, 0, 0.08)", borderLeftColor: "#B58900", borderLeftWidth: "4px" },
    ul: { markerColor: "#B58900", spacing: "6px" },
    ol: { markerColor: "#B58900", spacing: "6px" },
    inlineCode: { fontSize: "13px", color: "#8A6800", bg: "rgba(181, 137, 0, 0.12)", border: "1px solid rgba(181, 137, 0, 0.25)", radius: "3px" },
    codeBlock: { fontSize: "13px", color: "#18181A", bg: "#EDE8DC", border: "1px solid #D4CEBF", radius: "4px" },
    table: { headerBg: "#B58900", headerColor: "#FFFFFF", border: "1px solid #D4CEBF", cellBg: "#F8F6F0" },
    link: { color: "#B58900", textDecoration: "none", hoverColor: "#705300", hoverUnderline: true },
    hr: { color: "#B58900", borderStyle: "solid", height: "2px" }
  }
};

// src/theme/packs/docustack-dark-gold/elements.ts
var darkElements = {
  canvas: { cssVars: { "--color-base": "#121214", "--skipo-bg": "#121214" }, styles: { backgroundColor: "#121214", color: "#F3EDE0", fontFamily: "var(--skipo-font-body)" } },
  wallpaperOverlay: { cssVars: { "--wallpaper-overlay-color": "#121214", "--wallpaper-overlay-opacity": "0.70" }, effects: { transition: "opacity 0.2s ease-in-out" } },
  topToolbar: { cssVars: { "--color-surface-subtle": "#26262E", "--color-border": "#000000" }, styles: { height: "44px", borderBottom: "2px solid #000000" } },
  bottomStrip: { cssVars: { "--skipo-bottom-strip-bg": "#121214" }, styles: { height: "30px", borderTop: "2px solid #000000", fontFamily: "var(--skipo-font-mono)" } },
  headerBar: { cssVars: { "--color-surface-subtle": "#26262E", "--color-border": "#000000" }, styles: { fontFamily: "var(--skipo-font-heading)" } },
  workspaceTabBar: { cssVars: { "--color-surface": "#1E1E24", "--color-accent": "#D4AF37" } },
  card: { cssVars: { "--color-surface": "#1E1E24", "--color-border": "#000000" }, styles: { border: "2px solid #000000", boxShadow: "4px 4px 0px #000000", fontFamily: "var(--skipo-font-body)" } },
  buttonPrimary: { cssVars: { "--color-accent": "#D4AF37", "--color-border": "#000000" }, styles: { backgroundColor: "#D4AF37", color: "#000000", border: "2px solid #000000" }, effects: { transformHover: "translate(-1px, -1px)", glow: "0 0 10px rgba(212, 175, 55, 0.4)" } },
  buttonSecondary: { cssVars: { "--color-accent-secondary": "#B59443", "--color-surface": "#1E1E24" }, styles: { backgroundColor: "#1E1E24", color: "#F3EDE0", border: "2px solid #000000" } },
  buttonGhost: { styles: { backgroundColor: "transparent", color: "#F3EDE0", border: "none" } },
  inputField: { cssVars: { "--color-surface": "#1E1E24", "--color-border": "#000000" }, styles: { border: "2px solid #000000", fontFamily: "var(--skipo-font-mono)" } },
  selectDropdown: { cssVars: { "--color-surface": "#1E1E24", "--color-text": "#F3EDE0" } },
  badge: { cssVars: { "--color-accent": "#D4AF37" }, styles: { border: "1px solid #000000", fontFamily: "var(--skipo-font-mono)" } },
  kanbanBoard: { cssVars: { "--color-base": "#121214" } },
  kanbanColumn: { cssVars: { "--color-surface": "#1E1E24", "--color-border": "#000000" }, styles: { border: "2px solid #000000", boxShadow: "4px 4px 0px #000000" } },
  kanbanColumnOverlay: { cssVars: { "--column-overlay-color": "#121214", "--column-overlay-opacity": "0.80" } },
  documentCard: { cssVars: { "--color-surface": "#1E1E24", "--color-border": "#000000" }, styles: { border: "2px solid #000000", boxShadow: "3px 3px 0px #000000" } },
  graphCanvas: { cssVars: { "--color-base": "#121214" } },
  graphNodeRoot: { cssVars: { "--color-accent": "#D4AF37" }, styles: { border: "2px solid #000000" }, effects: { glow: "0 0 16px rgba(212, 175, 55, 0.6)" } },
  graphNodeLeaf: { cssVars: { "--color-surface": "#1E1E24", "--color-border": "#000000" }, styles: { border: "2px solid #000000" } },
  graphEdge: { styles: { stroke: "#B59443", strokeWidth: "2px" } },
  codeEditor: { cssVars: { "--color-surface": "#1E1E24" }, styles: { fontFamily: "var(--skipo-font-code)" } },
  aiChatPanel: { cssVars: { "--color-surface": "#1E1E24", "--color-border": "#000000" }, styles: { border: "2px solid #000000", boxShadow: "6px 6px 0px #000000" } }
};
var lightElements = {
  canvas: { cssVars: { "--color-base": "#F8F6F0", "--skipo-bg": "#F8F6F0" }, styles: { backgroundColor: "#F8F6F0", color: "#18181A", fontFamily: "var(--skipo-font-body)" } },
  wallpaperOverlay: { cssVars: { "--wallpaper-overlay-color": "#F8F6F0", "--wallpaper-overlay-opacity": "0.65" }, effects: { transition: "opacity 0.2s ease-in-out" } },
  topToolbar: { cssVars: { "--color-surface-subtle": "#E4DEC0", "--color-border": "#2A2518" }, styles: { height: "44px", borderBottom: "2px solid #2A2518" } },
  bottomStrip: { cssVars: { "--skipo-bottom-strip-bg": "#EDE8DC" }, styles: { height: "30px", borderTop: "2px solid #2A2518", fontFamily: "var(--skipo-font-mono)" } },
  headerBar: { cssVars: { "--color-surface-subtle": "#E4DEC0", "--color-border": "#2A2518" }, styles: { fontFamily: "var(--skipo-font-heading)" } },
  workspaceTabBar: { cssVars: { "--color-surface": "#EDE8DC", "--color-accent": "#B58900" } },
  card: { cssVars: { "--color-surface": "#EDE8DC", "--color-border": "#2A2518" }, styles: { border: "2px solid #2A2518", boxShadow: "4px 4px 0px #2A2518", fontFamily: "var(--skipo-font-body)" } },
  buttonPrimary: { cssVars: { "--color-accent": "#B58900", "--color-border": "#2A2518" }, styles: { backgroundColor: "#B58900", color: "#FFFFFF", border: "2px solid #2A2518" }, effects: { transformHover: "translate(-1px, -1px)", glow: "0 0 10px rgba(181, 137, 0, 0.4)" } },
  buttonSecondary: { cssVars: { "--color-accent-secondary": "#997400", "--color-surface": "#EDE8DC" }, styles: { backgroundColor: "#EDE8DC", color: "#18181A", border: "2px solid #2A2518" } },
  buttonGhost: { styles: { backgroundColor: "transparent", color: "#18181A", border: "none" } },
  inputField: { cssVars: { "--color-surface": "#EDE8DC", "--color-border": "#2A2518" }, styles: { border: "2px solid #2A2518", fontFamily: "var(--skipo-font-mono)" } },
  selectDropdown: { cssVars: { "--color-surface": "#EDE8DC", "--color-text": "#18181A" } },
  badge: { cssVars: { "--color-accent": "#B58900" }, styles: { border: "1px solid #2A2518", fontFamily: "var(--skipo-font-mono)" } },
  kanbanBoard: { cssVars: { "--color-base": "#F8F6F0" } },
  kanbanColumn: { cssVars: { "--color-surface": "#EDE8DC", "--color-border": "#2A2518" }, styles: { border: "2px solid #2A2518", boxShadow: "4px 4px 0px #2A2518" } },
  kanbanColumnOverlay: { cssVars: { "--column-overlay-color": "#F8F6F0", "--column-overlay-opacity": "0.75" } },
  documentCard: { cssVars: { "--color-surface": "#EDE8DC", "--color-border": "#2A2518" }, styles: { border: "2px solid #2A2518", boxShadow: "3px 3px 0px #2A2518" } },
  graphCanvas: { cssVars: { "--color-base": "#F8F6F0" } },
  graphNodeRoot: { cssVars: { "--color-accent": "#B58900" }, styles: { border: "2px solid #2A2518" }, effects: { glow: "0 0 14px rgba(181, 137, 0, 0.5)" } },
  graphNodeLeaf: { cssVars: { "--color-surface": "#EDE8DC", "--color-border": "#2A2518" }, styles: { border: "2px solid #2A2518" } },
  graphEdge: { styles: { stroke: "#997400", strokeWidth: "2px" } },
  codeEditor: { cssVars: { "--color-surface": "#EDE8DC" }, styles: { fontFamily: "var(--skipo-font-code)" } },
  aiChatPanel: { cssVars: { "--color-surface": "#EDE8DC", "--color-border": "#2A2518" }, styles: { border: "2px solid #2A2518", boxShadow: "6px 6px 0px #2A2518" } }
};

// src/theme/packs/docustack-dark-gold/manifest.json
var manifest_default = {
  id: "docustack-dark-gold",
  name: "DocuStack Vault (Dark & Gold)",
  version: "1.0.0",
  mode: "dark",
  author: "DocuStack Team",
  description: "Canonical 2.5D Neo-Brutalist Dark Vault theme with gold accents."
};

// src/theme/packs/docustack-dark-gold/index.ts
var DOCUSTACK_DARK_GOLD_PACK = validateModularThemePack({
  metadata: manifest_default,
  variants: {
    dark: {
      mode: "dark",
      tokens: darkTokens,
      typography: darkTypography,
      elementStyles: darkElements
    },
    light: {
      mode: "light",
      tokens: lightTokens,
      typography: lightTypography,
      elementStyles: lightElements
    }
  },
  typography: darkTypography,
  tokens: darkTokens,
  elementStyles: darkElements
});
var docustack_dark_gold_default = DOCUSTACK_DARK_GOLD_PACK;

// src/theme/packs/docustack-warm-coffee/tokens.ts
var lightTokens2 = {
  bg: { canvas: "#F5EDE4", surface: "#E8DCC4", surfaceHover: "#DFCFB9", blur: "blur(12px)" },
  text: { primary: "#21140E", muted: "#7A6B5D", inverse: "#F5EDE4" },
  accent: { primary: "#C87D32", fg: "#FFFFFF", glow: "0 0 12px rgba(200, 125, 50, 0.35)", hover: "#C25E45" },
  border: { color: "#2C1810", input: "#C87D32", style: "2px solid #2C1810" },
  radius: { base: "0px", sm: "0px", lg: "0px" },
  shadow: {
    card: "4px 4px 0px #2C1810",
    cardHover: "6px 6px 0px #2C1810",
    btn: "2px 2px 0px #2C1810",
    btnHover: "3px 3px 0px #2C1810",
    btnActive: "1px 1px 0px #2C1810"
  },
  font: { sans: "'Courier Prime', monospace", mono: "'JetBrains Mono', monospace" },
  status: {
    success: "#059669",
    successFg: "#FFFFFF",
    warning: "#D97706",
    warningFg: "#FFFFFF",
    danger: "#DC2626",
    dangerFg: "#FFFFFF",
    info: "#2563EB",
    infoFg: "#FFFFFF"
  },
  shell: {
    topToolbarHeight: "44px",
    topToolbarBg: "#DFCFB9",
    bottomStripHeight: "30px",
    bottomStripBg: "#E8DCC4",
    inspectionTextTranslucent: "rgba(33, 20, 14, 0.85)"
  }
};
var darkTokens2 = {
  bg: { canvas: "#1A120E", surface: "#281D17", surfaceHover: "#362720", blur: "blur(14px)" },
  text: { primary: "#F5EDE4", muted: "#A8988B", inverse: "#1A120E" },
  accent: { primary: "#E08A3C", fg: "#000000", glow: "0 0 14px rgba(224, 138, 60, 0.4)", hover: "#C87D32" },
  border: { color: "#3D2C22", input: "#E08A3C", style: "2px solid #3D2C22" },
  radius: { base: "0px", sm: "0px", lg: "0px" },
  shadow: {
    card: "4px 4px 0px #000000",
    cardHover: "6px 6px 0px #000000",
    btn: "2px 2px 0px #000000",
    btnHover: "3px 3px 0px #000000",
    btnActive: "1px 1px 0px #000000"
  },
  font: { sans: "'Courier Prime', monospace", mono: "'JetBrains Mono', monospace" },
  status: {
    success: "#10B981",
    successFg: "#000000",
    warning: "#F59E0B",
    warningFg: "#000000",
    danger: "#EF4444",
    dangerFg: "#FFFFFF",
    info: "#3B82F6",
    infoFg: "#FFFFFF"
  },
  shell: {
    topToolbarHeight: "44px",
    topToolbarBg: "#1A120E",
    bottomStripHeight: "30px",
    bottomStripBg: "#281D17",
    inspectionTextTranslucent: "rgba(245, 237, 228, 0.85)"
  }
};

// src/theme/packs/docustack-warm-coffee/typography.ts
var lightTypography2 = {
  globalFont: "'Courier Prime', monospace",
  globalMonoFont: "'JetBrains Mono', monospace",
  globalColor: "#21140E",
  globalAccentColor: "#C87D32",
  headingFont: "'Courier Prime', monospace",
  bodyFont: "'Courier Prime', monospace",
  codeFont: "'JetBrains Mono', monospace",
  sections: {
    h1: { fontSize: "28px", fontWeight: "800", lineHeight: "1.2", color: "#C87D32", borderBottom: "2px solid rgba(200, 125, 50, 0.35)" },
    h2: { fontSize: "22px", fontWeight: "700", lineHeight: "1.3", color: "#21140E", borderBottom: "1px solid rgba(200, 125, 50, 0.2)" },
    h3: { fontSize: "18px", fontWeight: "700", lineHeight: "1.4", color: "#21140E" },
    h4: { fontSize: "16px", fontWeight: "600", lineHeight: "1.4", color: "#C87D32" },
    h5: { fontSize: "14px", fontWeight: "600", lineHeight: "1.4", color: "#21140E" },
    h6: { fontSize: "13px", fontWeight: "600", lineHeight: "1.4", color: "#7A6B5D" },
    p: { fontSize: "15px", lineHeight: "1.6", color: "#21140E" },
    blockquote: { fontStyle: "italic", color: "#9E5B1E", bg: "rgba(200, 125, 50, 0.08)", borderLeftColor: "#C87D32", borderLeftWidth: "4px" },
    ul: { markerColor: "#C87D32", spacing: "6px" },
    ol: { markerColor: "#C87D32", spacing: "6px" },
    inlineCode: { fontSize: "13px", color: "#9E5B1E", bg: "rgba(200, 125, 50, 0.12)", border: "1px solid rgba(200, 125, 50, 0.25)", radius: "3px" },
    codeBlock: { fontSize: "13px", color: "#21140E", bg: "#E8DCC4", border: "1px solid #DFCFB9", radius: "4px" },
    table: { headerBg: "#C87D32", headerColor: "#FFFFFF", border: "1px solid #DFCFB9", cellBg: "#F5EDE4" },
    link: { color: "#C87D32", textDecoration: "none", hoverColor: "#C25E45", hoverUnderline: true },
    hr: { color: "#C87D32", borderStyle: "solid", height: "2px" }
  }
};
var darkTypography2 = {
  globalFont: "'Courier Prime', monospace",
  globalMonoFont: "'JetBrains Mono', monospace",
  globalColor: "#F5EDE4",
  globalAccentColor: "#E08A3C",
  headingFont: "'Courier Prime', monospace",
  bodyFont: "'Courier Prime', monospace",
  codeFont: "'JetBrains Mono', monospace",
  sections: {
    h1: { fontSize: "28px", fontWeight: "800", lineHeight: "1.2", color: "#E08A3C", borderBottom: "2px solid rgba(224, 138, 60, 0.4)" },
    h2: { fontSize: "22px", fontWeight: "700", lineHeight: "1.3", color: "#F5EDE4", borderBottom: "1px solid rgba(224, 138, 60, 0.2)" },
    h3: { fontSize: "18px", fontWeight: "700", lineHeight: "1.4", color: "#F5EDE4" },
    h4: { fontSize: "16px", fontWeight: "600", lineHeight: "1.4", color: "#E08A3C" },
    h5: { fontSize: "14px", fontWeight: "600", lineHeight: "1.4", color: "#F5EDE4" },
    h6: { fontSize: "13px", fontWeight: "600", lineHeight: "1.4", color: "#A8988B" },
    p: { fontSize: "15px", lineHeight: "1.6", color: "#F5EDE4" },
    blockquote: { fontStyle: "italic", color: "#E08A3C", bg: "rgba(224, 138, 60, 0.08)", borderLeftColor: "#E08A3C", borderLeftWidth: "4px" },
    ul: { markerColor: "#E08A3C", spacing: "6px" },
    ol: { markerColor: "#E08A3C", spacing: "6px" },
    inlineCode: { fontSize: "13px", color: "#E08A3C", bg: "rgba(224, 138, 60, 0.15)", border: "1px solid rgba(224, 138, 60, 0.3)", radius: "3px" },
    codeBlock: { fontSize: "13px", color: "#F5EDE4", bg: "#281D17", border: "1px solid #3D2C22", radius: "4px" },
    table: { headerBg: "#E08A3C", headerColor: "#000000", border: "1px solid #3D2C22", cellBg: "#1A120E" },
    link: { color: "#E08A3C", textDecoration: "none", hoverColor: "#FFFFFF", hoverUnderline: true },
    hr: { color: "#E08A3C", borderStyle: "solid", height: "2px" }
  }
};

// src/theme/packs/docustack-warm-coffee/elements.ts
var lightElements2 = {
  canvas: { cssVars: { "--color-base": "#F5EDE4", "--skipo-bg": "#F5EDE4" }, styles: { backgroundColor: "#F5EDE4", color: "#21140E", fontFamily: "var(--skipo-font-body)" } },
  wallpaperOverlay: { cssVars: { "--wallpaper-overlay-color": "#F5EDE4", "--wallpaper-overlay-opacity": "0.60" } },
  topToolbar: { cssVars: { "--color-surface-subtle": "#DFCFB9", "--color-border": "#2C1810" }, styles: { height: "44px", borderBottom: "2px solid #2C1810" } },
  bottomStrip: { cssVars: { "--skipo-bottom-strip-bg": "#E8DCC4" }, styles: { height: "30px", borderTop: "2px solid #2C1810", fontFamily: "var(--skipo-font-mono)" } },
  headerBar: { cssVars: { "--color-surface-subtle": "#DFCFB9", "--color-border": "#2C1810" }, styles: { fontFamily: "var(--skipo-font-heading)" } },
  workspaceTabBar: { cssVars: { "--color-surface": "#E8DCC4", "--color-accent": "#C87D32" } },
  card: { cssVars: { "--color-surface": "#E8DCC4", "--color-border": "#2C1810" }, styles: { border: "2px solid #2C1810", boxShadow: "4px 4px 0px #2C1810", fontFamily: "var(--skipo-font-body)" } },
  buttonPrimary: { cssVars: { "--color-accent": "#C87D32", "--color-border": "#2C1810" }, styles: { backgroundColor: "#C87D32", color: "#FFFFFF", border: "2px solid #2C1810" } },
  buttonSecondary: { cssVars: { "--color-accent-secondary": "#C25E45", "--color-surface": "#E8DCC4" }, styles: { backgroundColor: "#E8DCC4", color: "#21140E", border: "2px solid #2C1810" } },
  kanbanColumn: { cssVars: { "--color-surface": "#E8DCC4", "--color-border": "#2C1810" } },
  kanbanColumnOverlay: { cssVars: { "--column-overlay-color": "#F5EDE4", "--column-overlay-opacity": "0.75" } },
  documentCard: { cssVars: { "--color-surface": "#E8DCC4", "--color-border": "#2C1810" }, styles: { border: "2px solid #2C1810", boxShadow: "3px 3px 0px #2C1810" } },
  graphCanvas: { cssVars: { "--color-base": "#F5EDE4" } },
  graphNodeRoot: { cssVars: { "--color-accent": "#C87D32" }, styles: { border: "2px solid #2C1810" } },
  graphNodeLeaf: { cssVars: { "--color-surface": "#E8DCC4", "--color-border": "#2C1810" }, styles: { border: "2px solid #2C1810" } },
  graphEdge: { styles: { stroke: "#C87D32", strokeWidth: "2px" } },
  codeEditor: { cssVars: { "--color-surface": "#E8DCC4" }, styles: { fontFamily: "var(--skipo-font-code)" } },
  aiChatPanel: { cssVars: { "--color-surface": "#E8DCC4", "--color-border": "#2C1810" }, styles: { border: "2px solid #2C1810", boxShadow: "6px 6px 0px #2C1810" } }
};
var darkElements2 = {
  canvas: { cssVars: { "--color-base": "#1A120E", "--skipo-bg": "#1A120E" }, styles: { backgroundColor: "#1A120E", color: "#F5EDE4", fontFamily: "var(--skipo-font-body)" } },
  wallpaperOverlay: { cssVars: { "--wallpaper-overlay-color": "#1A120E", "--wallpaper-overlay-opacity": "0.75" } },
  topToolbar: { cssVars: { "--color-surface-subtle": "#362720", "--color-border": "#3D2C22" }, styles: { height: "44px", borderBottom: "2px solid #3D2C22" } },
  bottomStrip: { cssVars: { "--skipo-bottom-strip-bg": "#281D17" }, styles: { height: "30px", borderTop: "2px solid #3D2C22", fontFamily: "var(--skipo-font-mono)" } },
  headerBar: { cssVars: { "--color-surface-subtle": "#362720", "--color-border": "#3D2C22" }, styles: { fontFamily: "var(--skipo-font-heading)" } },
  workspaceTabBar: { cssVars: { "--color-surface": "#281D17", "--color-accent": "#E08A3C" } },
  card: { cssVars: { "--color-surface": "#281D17", "--color-border": "#3D2C22" }, styles: { border: "2px solid #3D2C22", boxShadow: "4px 4px 0px #000000", fontFamily: "var(--skipo-font-body)" } },
  buttonPrimary: { cssVars: { "--color-accent": "#E08A3C", "--color-border": "#3D2C22" }, styles: { backgroundColor: "#E08A3C", color: "#000000", border: "2px solid #3D2C22" } },
  buttonSecondary: { cssVars: { "--color-accent-secondary": "#C87D32", "--color-surface": "#281D17" }, styles: { backgroundColor: "#281D17", color: "#F5EDE4", border: "2px solid #3D2C22" } },
  kanbanColumn: { cssVars: { "--color-surface": "#281D17", "--color-border": "#3D2C22" } },
  kanbanColumnOverlay: { cssVars: { "--column-overlay-color": "#1A120E", "--column-overlay-opacity": "0.80" } },
  documentCard: { cssVars: { "--color-surface": "#281D17", "--color-border": "#3D2C22" }, styles: { border: "2px solid #3D2C22", boxShadow: "3px 3px 0px #000000" } },
  graphCanvas: { cssVars: { "--color-base": "#1A120E" } },
  graphNodeRoot: { cssVars: { "--color-accent": "#E08A3C" }, styles: { border: "2px solid #3D2C22" } },
  graphNodeLeaf: { cssVars: { "--color-surface": "#281D17", "--color-border": "#3D2C22" }, styles: { border: "2px solid #3D2C22" } },
  graphEdge: { styles: { stroke: "#E08A3C", strokeWidth: "2px" } },
  codeEditor: { cssVars: { "--color-surface": "#281D17" }, styles: { fontFamily: "var(--skipo-font-code)" } },
  aiChatPanel: { cssVars: { "--color-surface": "#281D17", "--color-border": "#3D2C22" }, styles: { border: "2px solid #3D2C22", boxShadow: "6px 6px 0px #000000" } }
};

// src/theme/packs/docustack-warm-coffee/manifest.json
var manifest_default2 = {
  id: "docustack-warm-coffee",
  name: "DocuStack Warm Coffee",
  version: "1.0.0",
  mode: "light",
  author: "DocuStack Team",
  description: "Warm espresso and caramel dual-variant palette."
};

// src/theme/packs/docustack-warm-coffee/index.ts
var DOCUSTACK_WARM_COFFEE_PACK = validateModularThemePack({
  metadata: manifest_default2,
  variants: {
    dark: {
      mode: "dark",
      tokens: darkTokens2,
      typography: darkTypography2,
      elementStyles: darkElements2
    },
    light: {
      mode: "light",
      tokens: lightTokens2,
      typography: lightTypography2,
      elementStyles: lightElements2
    }
  },
  typography: lightTypography2,
  tokens: lightTokens2,
  elementStyles: lightElements2
});
var docustack_warm_coffee_default = DOCUSTACK_WARM_COFFEE_PACK;

// src/theme/packs/docustack-cyberpunk-neon/tokens.ts
var darkTokens3 = {
  bg: { canvas: "#0A0B10", surface: "#121520", surfaceHover: "#1A1F2C", blur: "blur(20px)" },
  text: { primary: "#E0F7FC", muted: "#708A9E", inverse: "#0A0B10" },
  accent: { primary: "#00F0FF", fg: "#000000", glow: "0 0 18px rgba(0, 240, 255, 0.65)", hover: "#00D0E0" },
  border: { color: "#00F0FF", input: "#FF0055", style: "2px solid #00F0FF" },
  radius: { base: "0px", sm: "0px", lg: "0px" },
  shadow: {
    card: "4px 4px 0px #000000",
    cardHover: "6px 6px 0px rgba(0, 240, 255, 0.4)",
    btn: "2px 2px 0px #000000",
    btnHover: "3px 3px 0px #00F0FF",
    btnActive: "1px 1px 0px #000000"
  },
  font: { sans: "'Space Grotesk', sans-serif", mono: "'JetBrains Mono', monospace" },
  status: {
    success: "#00FF9D",
    successFg: "#000000",
    warning: "#FFE600",
    warningFg: "#000000",
    danger: "#FF0055",
    dangerFg: "#FFFFFF",
    info: "#00F0FF",
    infoFg: "#000000"
  },
  shell: {
    topToolbarHeight: "44px",
    topToolbarBg: "#0A0B10",
    bottomStripHeight: "30px",
    bottomStripBg: "#0A0B10",
    inspectionTextTranslucent: "rgba(224, 247, 252, 0.85)"
  }
};
var lightTokens3 = {
  bg: { canvas: "#EBF4F7", surface: "#D4E5ED", surfaceHover: "#C2D9E4", blur: "blur(16px)" },
  text: { primary: "#0B1920", muted: "#536D7A", inverse: "#EBF4F7" },
  accent: { primary: "#008C99", fg: "#FFFFFF", glow: "0 0 14px rgba(0, 140, 153, 0.4)", hover: "#00727D" },
  border: { color: "#008C99", input: "#D6004C", style: "2px solid #008C99" },
  radius: { base: "0px", sm: "0px", lg: "0px" },
  shadow: {
    card: "4px 4px 0px #A0B4BE",
    cardHover: "6px 6px 0px rgba(0, 140, 153, 0.4)",
    btn: "2px 2px 0px #A0B4BE",
    btnHover: "3px 3px 0px #008C99",
    btnActive: "1px 1px 0px #A0B4BE"
  },
  font: { sans: "'Space Grotesk', sans-serif", mono: "'JetBrains Mono', monospace" },
  status: {
    success: "#059669",
    successFg: "#FFFFFF",
    warning: "#D97706",
    warningFg: "#FFFFFF",
    danger: "#DC2626",
    dangerFg: "#FFFFFF",
    info: "#0284C7",
    infoFg: "#FFFFFF"
  },
  shell: {
    topToolbarHeight: "44px",
    topToolbarBg: "#D4E5ED",
    bottomStripHeight: "30px",
    bottomStripBg: "#C2D9E4",
    inspectionTextTranslucent: "rgba(11, 25, 32, 0.85)"
  }
};

// src/theme/packs/docustack-cyberpunk-neon/typography.ts
var darkTypography3 = {
  globalFont: "'Space Grotesk', sans-serif",
  globalMonoFont: "'JetBrains Mono', monospace",
  globalColor: "#E0F7FC",
  globalAccentColor: "#00F0FF",
  headingFont: "'Space Grotesk', sans-serif",
  bodyFont: "'Space Grotesk', sans-serif",
  codeFont: "'JetBrains Mono', monospace",
  sections: {
    h1: { fontSize: "28px", fontWeight: "800", lineHeight: "1.2", color: "#00F0FF", borderBottom: "2px solid rgba(0, 240, 255, 0.4)" },
    h2: { fontSize: "22px", fontWeight: "700", lineHeight: "1.3", color: "#FF0055", borderBottom: "1px solid rgba(255, 0, 85, 0.3)" },
    h3: { fontSize: "18px", fontWeight: "700", lineHeight: "1.4", color: "#00F0FF" },
    h4: { fontSize: "16px", fontWeight: "600", lineHeight: "1.4", color: "#00FF9D" },
    h5: { fontSize: "14px", fontWeight: "600", lineHeight: "1.4", color: "#E0F7FC" },
    h6: { fontSize: "13px", fontWeight: "600", lineHeight: "1.4", color: "#708A9E" },
    p: { fontSize: "15px", lineHeight: "1.6", color: "#E0F7FC" },
    blockquote: { fontStyle: "italic", color: "#00F0FF", bg: "rgba(0, 240, 255, 0.08)", borderLeftColor: "#FF0055", borderLeftWidth: "4px" },
    ul: { markerColor: "#00F0FF", spacing: "6px" },
    ol: { markerColor: "#FF0055", spacing: "6px" },
    inlineCode: { fontSize: "13px", color: "#00F0FF", bg: "rgba(0, 240, 255, 0.15)", border: "1px solid rgba(0, 240, 255, 0.4)", radius: "3px" },
    codeBlock: { fontSize: "13px", color: "#00FF9D", bg: "#080A10", border: "1px solid rgba(0, 240, 255, 0.25)", radius: "4px" },
    table: { headerBg: "#00F0FF", headerColor: "#000000", border: "1px solid rgba(0, 240, 255, 0.25)", cellBg: "#121520" },
    link: { color: "#00F0FF", textDecoration: "none", hoverColor: "#FF0055", hoverUnderline: true },
    hr: { color: "#00F0FF", borderStyle: "solid", height: "2px" }
  }
};
var lightTypography3 = {
  globalFont: "'Space Grotesk', sans-serif",
  globalMonoFont: "'JetBrains Mono', monospace",
  globalColor: "#0B1920",
  globalAccentColor: "#008C99",
  headingFont: "'Space Grotesk', sans-serif",
  bodyFont: "'Space Grotesk', sans-serif",
  codeFont: "'JetBrains Mono', monospace",
  sections: {
    h1: { fontSize: "28px", fontWeight: "800", lineHeight: "1.2", color: "#008C99", borderBottom: "2px solid rgba(0, 140, 153, 0.35)" },
    h2: { fontSize: "22px", fontWeight: "700", lineHeight: "1.3", color: "#D6004C", borderBottom: "1px solid rgba(214, 0, 76, 0.25)" },
    h3: { fontSize: "18px", fontWeight: "700", lineHeight: "1.4", color: "#008C99" },
    h4: { fontSize: "16px", fontWeight: "600", lineHeight: "1.4", color: "#059669" },
    h5: { fontSize: "14px", fontWeight: "600", lineHeight: "1.4", color: "#0B1920" },
    h6: { fontSize: "13px", fontWeight: "600", lineHeight: "1.4", color: "#536D7A" },
    p: { fontSize: "15px", lineHeight: "1.6", color: "#0B1920" },
    blockquote: { fontStyle: "italic", color: "#008C99", bg: "rgba(0, 140, 153, 0.08)", borderLeftColor: "#D6004C", borderLeftWidth: "4px" },
    ul: { markerColor: "#008C99", spacing: "6px" },
    ol: { markerColor: "#D6004C", spacing: "6px" },
    inlineCode: { fontSize: "13px", color: "#008C99", bg: "rgba(0, 140, 153, 0.12)", border: "1px solid rgba(0, 140, 153, 0.25)", radius: "3px" },
    codeBlock: { fontSize: "13px", color: "#0B1920", bg: "#D4E5ED", border: "1px solid #C2D9E4", radius: "4px" },
    table: { headerBg: "#008C99", headerColor: "#FFFFFF", border: "1px solid #C2D9E4", cellBg: "#EBF4F7" },
    link: { color: "#008C99", textDecoration: "none", hoverColor: "#D6004C", hoverUnderline: true },
    hr: { color: "#008C99", borderStyle: "solid", height: "2px" }
  }
};

// src/theme/packs/docustack-cyberpunk-neon/elements.ts
var darkElements3 = {
  canvas: { cssVars: { "--color-base": "#0A0B10", "--skipo-bg": "#0A0B10" }, styles: { backgroundColor: "#0A0B10", color: "#E0F7FC", fontFamily: "var(--skipo-font-body)" } },
  buttonPrimary: {
    cssVars: { "--color-accent": "#00F0FF" },
    styles: { backgroundColor: "#00F0FF", color: "#000000", border: "2px solid #000000" },
    effects: { glow: "0 0 15px rgba(0, 240, 255, 0.8)" }
  },
  graphNodeRoot: {
    cssVars: { "--color-accent": "#00F0FF" },
    styles: { border: "2px solid #00F0FF" },
    effects: { glow: "0 0 20px rgba(0, 240, 255, 0.9)" }
  }
};
var lightElements3 = {
  canvas: { cssVars: { "--color-base": "#EBF4F7", "--skipo-bg": "#EBF4F7" }, styles: { backgroundColor: "#EBF4F7", color: "#0B1920", fontFamily: "var(--skipo-font-body)" } },
  buttonPrimary: {
    cssVars: { "--color-accent": "#008C99" },
    styles: { backgroundColor: "#008C99", color: "#FFFFFF", border: "2px solid #008C99" },
    effects: { glow: "0 0 12px rgba(0, 140, 153, 0.5)" }
  },
  graphNodeRoot: {
    cssVars: { "--color-accent": "#008C99" },
    styles: { border: "2px solid #008C99" },
    effects: { glow: "0 0 16px rgba(0, 140, 153, 0.6)" }
  }
};

// src/theme/packs/docustack-cyberpunk-neon/manifest.json
var manifest_default3 = {
  id: "docustack-cyberpunk-neon",
  name: "DocuStack Cyberpunk Neon",
  version: "1.0.0",
  mode: "dark",
  author: "DocuStack Team",
  description: "High-contrast cyberpunk cyan and magenta dual-variant glow."
};

// src/theme/packs/docustack-cyberpunk-neon/index.ts
var DOCUSTACK_CYBERPUNK_PACK = validateModularThemePack({
  metadata: manifest_default3,
  variants: {
    dark: {
      mode: "dark",
      tokens: darkTokens3,
      typography: darkTypography3,
      elementStyles: darkElements3
    },
    light: {
      mode: "light",
      tokens: lightTokens3,
      typography: lightTypography3,
      elementStyles: lightElements3
    }
  },
  typography: darkTypography3,
  tokens: darkTokens3,
  elementStyles: darkElements3
});
var docustack_cyberpunk_neon_default = DOCUSTACK_CYBERPUNK_PACK;

export {
  DEFAULT_DARK_THEME_PACK,
  DEFAULT_LIGHT_THEME_PACK,
  tokensToCssVariables,
  applyThemePack,
  validateThemePack,
  CANONICAL_ELEMENTS,
  centralLedger,
  registerUIElement,
  getUIElement,
  getAllUIElements,
  getThemeEngineStatus,
  SkipoThemeProvider,
  useSkipoTheme,
  palettes,
  validateSocketElements,
  createAppThemeSocket,
  resolveTypographyCascade,
  ThemeEngine,
  SkipoSemanticTokensSchema,
  HeadingLevelSchema,
  ParagraphStyleSchema,
  BlockquoteStyleSchema,
  ListStyleSchema,
  CodeStyleSchema,
  TableStyleSchema,
  LinkStyleSchema,
  HorizontalRuleStyleSchema,
  MarkdownSectionStylesSchema,
  ThemeTypographySchema,
  SkipoThemeMetadataSchema,
  UIElementThemeValueSchema,
  ThemeVariantDefinitionSchema,
  ModularThemePackSchema,
  validateModularThemePack,
  safeValidateModularThemePack,
  DOCUSTACK_DARK_GOLD_PACK,
  docustack_dark_gold_default,
  DOCUSTACK_WARM_COFFEE_PACK,
  docustack_warm_coffee_default,
  DOCUSTACK_CYBERPUNK_PACK,
  docustack_cyberpunk_neon_default
};
