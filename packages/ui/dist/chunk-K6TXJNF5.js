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
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { jsx } from "react/jsx-runtime";
var SkipoThemeContext = createContext(null);
function useThemeManager(defaultTheme = "dark", initialThemePack) {
  const [theme, setThemeState] = useState(defaultTheme);
  const [themePack, setThemePackState] = useState(
    initialThemePack || (defaultTheme === "dark" ? DEFAULT_DARK_THEME_PACK : DEFAULT_LIGHT_THEME_PACK)
  );
  const applyPack = useCallback((pack) => {
    setThemePackState(pack);
    setThemeState(pack.metadata.mode);
    if (typeof document !== "undefined") {
      applyThemePack(pack);
    }
  }, []);
  const setTheme = useCallback((mode) => {
    applyPack(mode === "dark" ? DEFAULT_DARK_THEME_PACK : DEFAULT_LIGHT_THEME_PACK);
  }, [applyPack]);
  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);
  useEffect(() => {
    applyPack(initialThemePack || (defaultTheme === "dark" ? DEFAULT_DARK_THEME_PACK : DEFAULT_LIGHT_THEME_PACK));
  }, []);
  return { theme, themePack, setTheme, setThemePack: applyPack, toggleTheme };
}
function SkipoThemeProvider({
  children,
  defaultTheme = "dark",
  initialThemePack
}) {
  const themeState = useThemeManager(defaultTheme, initialThemePack);
  return /* @__PURE__ */ jsx(SkipoThemeContext.Provider, { value: themeState, children: /* @__PURE__ */ jsx("div", { "data-skipo-theme": themeState.theme, className: "skipo-root", children }) });
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

export {
  DEFAULT_DARK_THEME_PACK,
  DEFAULT_LIGHT_THEME_PACK,
  tokensToCssVariables,
  applyThemePack,
  validateThemePack,
  SkipoThemeProvider,
  useSkipoTheme,
  palettes
};
