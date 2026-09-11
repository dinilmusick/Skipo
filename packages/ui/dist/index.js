import {
  DEFAULT_DARK_THEME_PACK,
  DEFAULT_LIGHT_THEME_PACK,
  SkipoThemeProvider,
  applyThemePack,
  palettes,
  tokensToCssVariables,
  useSkipoTheme,
  validateThemePack
} from "./chunk-K6TXJNF5.js";

// src/components/base/BaseButton.tsx
import { forwardRef } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var BaseButton = forwardRef(({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  children,
  className = "",
  disabled,
  ...props
}, ref) => {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      ref,
      className: `skipo-btn skipo-btn--${variant} skipo-btn--${size} ${className}`,
      disabled: disabled || loading,
      ...props,
      children: [
        loading ? /* @__PURE__ */ jsx("span", { className: "skipo-spinner" }) : icon,
        children
      ]
    }
  );
});
BaseButton.displayName = "BaseButton";

// src/components/base/BaseInput.tsx
import { forwardRef as forwardRef2 } from "react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var BaseInput = forwardRef2(({
  error,
  leadingIcon,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsxs2("div", { className: `skipo-input-wrapper ${className}`, children: [
    leadingIcon && /* @__PURE__ */ jsx2("span", { className: "skipo-input-icon", children: leadingIcon }),
    /* @__PURE__ */ jsx2("input", { ref, className: "skipo-input", "data-error": error, ...props })
  ] });
});
BaseInput.displayName = "BaseInput";

// src/components/base/BaseTextarea.tsx
import { forwardRef as forwardRef3 } from "react";
import { jsx as jsx3 } from "react/jsx-runtime";
var BaseTextarea = forwardRef3(({
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsx3("textarea", { ref, className: `skipo-textarea ${className}`, ...props });
});
BaseTextarea.displayName = "BaseTextarea";

// src/components/base/BaseSelect.tsx
import { forwardRef as forwardRef4 } from "react";
import { jsx as jsx4 } from "react/jsx-runtime";
var BaseSelect = forwardRef4(({
  options,
  error,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsx4("select", { ref, className: `skipo-select ${className}`, "data-error": error, ...props, children: options.map((o) => /* @__PURE__ */ jsx4("option", { value: o.value, children: o.label }, o.value)) });
});
BaseSelect.displayName = "BaseSelect";

// src/components/base/BaseCard.tsx
import { forwardRef as forwardRef5 } from "react";
import { jsx as jsx5 } from "react/jsx-runtime";
var BaseCard = forwardRef5(({
  variant = "surface",
  depth = "md",
  interactive,
  className = "",
  children,
  ...props
}, ref) => {
  return /* @__PURE__ */ jsx5("div", { ref, className: `skipo-card skipo-card--${variant} skipo-card--${depth} ${interactive ? "skipo-card--interactive" : ""} ${className}`, ...props, children });
});
BaseCard.displayName = "BaseCard";

// src/components/base/BaseBadge.tsx
import { forwardRef as forwardRef6 } from "react";
import { jsx as jsx6 } from "react/jsx-runtime";
var BaseBadge = forwardRef6(({
  variant = "neutral",
  className = "",
  children,
  ...props
}, ref) => {
  return /* @__PURE__ */ jsx6("span", { ref, className: `skipo-badge skipo-badge--${variant} ${className}`, ...props, children });
});
BaseBadge.displayName = "BaseBadge";

// src/components/base/BaseToggle.tsx
import { forwardRef as forwardRef7 } from "react";
import { jsx as jsx7, jsxs as jsxs3 } from "react/jsx-runtime";
var BaseToggle = forwardRef7(({
  label,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsxs3("label", { className: "skipo-toggle-label", children: [
    /* @__PURE__ */ jsx7("input", { ref, type: "checkbox", className: `skipo-toggle ${className}`, ...props }),
    label && /* @__PURE__ */ jsx7("span", { children: label })
  ] });
});
BaseToggle.displayName = "BaseToggle";

// src/components/base/BaseTooltip.tsx
import React9, { forwardRef as forwardRef8, cloneElement, isValidElement } from "react";

// src/components/bottom-strip/BottomStripContext.tsx
import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { jsx as jsx8 } from "react/jsx-runtime";
var BottomStripContext = createContext(null);
function useAutoSaveController(initialEnabled) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [status, setStatus] = useState("idle");
  const toggle = useCallback(() => setEnabled((prev) => !prev), []);
  return { enabled, status, toggle, setStatus, setEnabled };
}
function useApiActivityController() {
  const [activeCount, setActiveCount] = useState(0);
  const [lastEndpoint, setLastEndpoint] = useState(void 0);
  const [lastMethod, setLastMethod] = useState(void 0);
  const recordRequestStart = useCallback((endpoint, method = "GET") => {
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setActiveCount((prev) => prev + 1);
    setLastEndpoint(endpoint);
    setLastMethod(method);
    return id;
  }, []);
  const recordRequestEnd = useCallback((_requestId) => {
    setActiveCount((prev) => Math.max(0, prev - 1));
  }, []);
  return { activeCount, lastEndpoint, lastMethod, recordRequestStart, recordRequestEnd };
}
function useSystemMessageController() {
  const [systemMessages, setSystemMessages] = useState([]);
  const clearSystemMessage = useCallback((id) => {
    setSystemMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);
  const showSystemMessage = useCallback((message, type = "info", durationMs = 5e3) => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newMsg = { id, type, message, timestamp: Date.now() };
    setSystemMessages((prev) => [...prev.slice(-4), newMsg]);
    if (durationMs > 0) {
      setTimeout(() => clearSystemMessage(id), durationMs);
    }
  }, [clearSystemMessage]);
  return { systemMessages, showSystemMessage, clearSystemMessage };
}
function BottomStripProvider({
  children,
  initialAutoSave = true
}) {
  const [inspectionText, setInspectionText] = useState(null);
  const autoSave = useAutoSaveController(initialAutoSave);
  const apiActivity = useApiActivityController();
  const { systemMessages, showSystemMessage, clearSystemMessage } = useSystemMessageController();
  const value = useMemo(() => ({
    inspectionText,
    setInspectionText,
    autoSave,
    apiActivity,
    systemMessages,
    showSystemMessage,
    clearSystemMessage
  }), [inspectionText, autoSave, apiActivity, systemMessages, showSystemMessage, clearSystemMessage]);
  return /* @__PURE__ */ jsx8(BottomStripContext.Provider, { value, children });
}
function useBottomStrip() {
  const ctx = useContext(BottomStripContext);
  if (!ctx) {
    return {
      inspectionText: null,
      setInspectionText: () => {
      },
      autoSave: {
        enabled: true,
        status: "idle",
        toggle: () => {
        },
        setStatus: () => {
        },
        setEnabled: () => {
        }
      },
      apiActivity: {
        activeCount: 0,
        recordRequestStart: () => "noop",
        recordRequestEnd: () => {
        }
      },
      systemMessages: [],
      showSystemMessage: () => {
      },
      clearSystemMessage: () => {
      }
    };
  }
  return ctx;
}

// src/components/base/BaseTooltip.tsx
import { jsx as jsx9 } from "react/jsx-runtime";
var BaseTooltip = forwardRef8(({
  content,
  children,
  className = "",
  ...props
}, ref) => {
  const { setInspectionText } = useBottomStrip();
  const textContent = typeof content === "string" ? content : React9.Children.toArray(content).filter((c) => typeof c === "string").join(" ") || String(content ?? "");
  const handleMouseEnter = (e) => {
    setInspectionText(textContent);
    if (props.onMouseEnter) props.onMouseEnter(e);
  };
  const handleMouseLeave = (e) => {
    setInspectionText(null);
    if (props.onMouseLeave) props.onMouseLeave(e);
  };
  const handleFocus = (e) => {
    setInspectionText(textContent);
    if (props.onFocus) props.onFocus(e);
  };
  const handleBlur = (e) => {
    setInspectionText(null);
    if (props.onBlur) props.onBlur(e);
  };
  if (isValidElement(children)) {
    const childProps = children.props;
    return cloneElement(children, {
      onMouseEnter: (e) => {
        handleMouseEnter(e);
        if (childProps.onMouseEnter) childProps.onMouseEnter(e);
      },
      onMouseLeave: (e) => {
        handleMouseLeave(e);
        if (childProps.onMouseLeave) childProps.onMouseLeave(e);
      },
      onFocus: (e) => {
        handleFocus(e);
        if (childProps.onFocus) childProps.onFocus(e);
      },
      onBlur: (e) => {
        handleBlur(e);
        if (childProps.onBlur) childProps.onBlur(e);
      },
      "aria-label": childProps["aria-label"] || textContent
    });
  }
  return /* @__PURE__ */ jsx9(
    "div",
    {
      ref,
      className: `skipo-inspection-target ${className}`,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleFocus,
      onBlur: handleBlur,
      "aria-label": textContent,
      style: { display: "inline-flex" },
      ...props,
      children
    }
  );
});
BaseTooltip.displayName = "BaseTooltip";

// src/components/base/CredentialField.tsx
import { forwardRef as forwardRef9, useState as useState2 } from "react";
import { Fragment, jsx as jsx10, jsxs as jsxs4 } from "react/jsx-runtime";
var KNOWN_CREDENTIAL_URLS = {
  openai: { name: "OpenAI API Keys", url: "https://platform.openai.com/api-keys" },
  anthropic: { name: "Anthropic Console", url: "https://console.anthropic.com/settings/keys" },
  google: { name: "Google AI Studio", url: "https://aistudio.google.com/app/apikey" },
  gemini: { name: "Google AI Studio", url: "https://aistudio.google.com/app/apikey" },
  backblaze: { name: "Backblaze B2 App Keys", url: "https://secure.backblaze.com/app_keys.htm" },
  b2: { name: "Backblaze B2 App Keys", url: "https://secure.backblaze.com/app_keys.htm" },
  cloudflare: { name: "Cloudflare R2 API Tokens", url: "https://dash.cloudflare.com/?to=/:account/r2/api-tokens" },
  r2: { name: "Cloudflare R2 API Tokens", url: "https://dash.cloudflare.com/?to=/:account/r2/api-tokens" },
  aws: { name: "AWS IAM Security Credentials", url: "https://console.aws.amazon.com/iam/home#/security_credentials" },
  s3: { name: "AWS IAM Security Credentials", url: "https://console.aws.amazon.com/iam/home#/security_credentials" },
  supabase: { name: "Supabase API Settings", url: "https://supabase.com/dashboard/project/_/settings/api" },
  neon: { name: "Neon API Keys", url: "https://console.neon.tech/app/settings/api-keys" },
  github: { name: "GitHub Personal Access Tokens", url: "https://github.com/settings/tokens" },
  openrouter: { name: "OpenRouter Keys", url: "https://openrouter.ai/keys" }
};
var CredentialField = forwardRef9(({
  serviceId,
  credentialUrl,
  serviceLabel,
  className = "",
  ...props
}, ref) => {
  const [showSecret, setShowSecret] = useState2(false);
  const known = serviceId ? KNOWN_CREDENTIAL_URLS[serviceId.toLowerCase()] : void 0;
  const resolvedUrl = credentialUrl || known?.url;
  const resolvedLabel = serviceLabel || known?.name || (serviceId ? serviceId.toUpperCase() : "CREDENTIALS");
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      className: `skipo-credential-field ${className}`,
      style: {
        position: "relative",
        display: "flex",
        alignItems: "center",
        width: "100%"
      },
      children: [
        /* @__PURE__ */ jsx10(
          "input",
          {
            ref,
            type: showSecret ? "text" : "password",
            className: "skipo-input",
            style: { paddingRight: resolvedUrl ? "56px" : "32px" },
            ...props
          }
        ),
        /* @__PURE__ */ jsxs4(
          "div",
          {
            style: {
              position: "absolute",
              right: "4px",
              display: "flex",
              alignItems: "center",
              gap: "2px"
            },
            children: [
              /* @__PURE__ */ jsx10(BaseTooltip, { content: showSecret ? "HIDE SECRET CREDENTIAL" : "SHOW SECRET CREDENTIAL", children: /* @__PURE__ */ jsx10(
                "button",
                {
                  type: "button",
                  onClick: () => setShowSecret(!showSecret),
                  "aria-label": showSecret ? "Hide secret" : "Show secret",
                  style: {
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    color: "var(--skipo-text-muted)",
                    display: "flex",
                    alignItems: "center"
                  },
                  children: /* @__PURE__ */ jsx10("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: showSecret ? /* @__PURE__ */ jsxs4(Fragment, { children: [
                    /* @__PURE__ */ jsx10("path", { d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" }),
                    /* @__PURE__ */ jsx10("line", { x1: "1", y1: "1", x2: "23", y2: "23" })
                  ] }) : /* @__PURE__ */ jsxs4(Fragment, { children: [
                    /* @__PURE__ */ jsx10("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }),
                    /* @__PURE__ */ jsx10("circle", { cx: "12", cy: "12", r: "3" })
                  ] }) })
                }
              ) }),
              resolvedUrl && /* @__PURE__ */ jsx10(BaseTooltip, { content: `GET CREDENTIALS: OPEN ${resolvedLabel.toUpperCase()} (EXTERNAL LINK)`, children: /* @__PURE__ */ jsx10(
                "a",
                {
                  href: resolvedUrl,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  "aria-label": `Get ${resolvedLabel} credentials`,
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "4px",
                    color: "var(--skipo-accent)",
                    textDecoration: "none"
                  },
                  children: /* @__PURE__ */ jsxs4("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
                    /* @__PURE__ */ jsx10("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
                    /* @__PURE__ */ jsx10("polyline", { points: "15 3 21 3 21 9" }),
                    /* @__PURE__ */ jsx10("line", { x1: "10", y1: "14", x2: "21", y2: "3" })
                  ] })
                }
              ) })
            ]
          }
        )
      ]
    }
  );
});
CredentialField.displayName = "CredentialField";

// src/components/containers/PageContainer.tsx
import { forwardRef as forwardRef10 } from "react";
import { jsx as jsx11, jsxs as jsxs5 } from "react/jsx-runtime";
var PageContainer = forwardRef10(({
  title,
  subtitle,
  actions,
  paddingScale = "md",
  children,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsxs5("div", { ref, className: `skipo-page-container skipo-page-container--${paddingScale} ${className}`, ...props, children: [
    /* @__PURE__ */ jsxs5("header", { className: "skipo-page-header", children: [
      /* @__PURE__ */ jsxs5("div", { children: [
        title && /* @__PURE__ */ jsx11("h1", { children: title }),
        subtitle && /* @__PURE__ */ jsx11("h2", { children: subtitle })
      ] }),
      actions && /* @__PURE__ */ jsx11("div", { className: "skipo-page-actions", children: actions })
    ] }),
    /* @__PURE__ */ jsx11("main", { className: "skipo-page-content", children })
  ] });
});
PageContainer.displayName = "PageContainer";

// src/components/containers/SectionContainer.tsx
import { forwardRef as forwardRef11, useState as useState3 } from "react";
import { jsx as jsx12, jsxs as jsxs6 } from "react/jsx-runtime";
var SectionContainer = forwardRef11(({
  heading,
  collapsible,
  children,
  className = "",
  ...props
}, ref) => {
  const [collapsed, setCollapsed] = useState3(false);
  return /* @__PURE__ */ jsxs6("section", { ref, className: `skipo-section-container ${className}`, ...props, children: [
    /* @__PURE__ */ jsx12("h3", { onClick: () => collapsible && setCollapsed(!collapsed), children: heading }),
    !collapsed && /* @__PURE__ */ jsx12("div", { children })
  ] });
});
SectionContainer.displayName = "SectionContainer";

// src/components/containers/SidebarContainer.tsx
import { forwardRef as forwardRef13, useState as useState4 } from "react";

// src/components/composite/IconOnlyButton.tsx
import { forwardRef as forwardRef12 } from "react";
import { jsx as jsx13 } from "react/jsx-runtime";
var IconOnlyButton = forwardRef12(({
  icon,
  label,
  variant = "secondary",
  active = false,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsx13(BaseTooltip, { content: label, children: /* @__PURE__ */ jsx13(
    BaseButton,
    {
      ref,
      variant: active ? "accent" : variant,
      className: `skipo-icon-btn ${active ? "skipo-icon-btn--active" : ""} ${className}`,
      "aria-label": label,
      ...props,
      children: icon
    }
  ) });
});
IconOnlyButton.displayName = "IconOnlyButton";

// src/components/containers/SidebarContainer.tsx
import { jsx as jsx14, jsxs as jsxs7 } from "react/jsx-runtime";
var SidebarContainer = forwardRef13(({
  minWidth = 200,
  maxWidth = 400,
  children,
  className = "",
  ...props
}, ref) => {
  const [collapsed, setCollapsed] = useState4(false);
  return /* @__PURE__ */ jsxs7("aside", { ref, style: { width: collapsed ? 60 : minWidth, maxWidth }, className: `skipo-sidebar-container ${className}`, ...props, children: [
    /* @__PURE__ */ jsx14(
      IconOnlyButton,
      {
        icon: /* @__PURE__ */ jsxs7("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
          /* @__PURE__ */ jsx14("line", { x1: "3", y1: "12", x2: "21", y2: "12" }),
          /* @__PURE__ */ jsx14("line", { x1: "3", y1: "6", x2: "21", y2: "6" }),
          /* @__PURE__ */ jsx14("line", { x1: "3", y1: "18", x2: "21", y2: "18" })
        ] }),
        label: collapsed ? "EXPAND SIDEBAR" : "COLLAPSE SIDEBAR",
        onClick: () => setCollapsed(!collapsed)
      }
    ),
    !collapsed && children
  ] });
});
SidebarContainer.displayName = "SidebarContainer";

// src/components/containers/DrawerContainer.tsx
import { forwardRef as forwardRef14 } from "react";
import { Fragment as Fragment2, jsx as jsx15, jsxs as jsxs8 } from "react/jsx-runtime";
var DrawerContainer = forwardRef14(({
  open,
  onClose,
  position = "right",
  children,
  className = "",
  ...props
}, ref) => {
  if (!open) return null;
  return /* @__PURE__ */ jsxs8(Fragment2, { children: [
    /* @__PURE__ */ jsx15("div", { className: "skipo-modal-overlay", onClick: onClose }),
    /* @__PURE__ */ jsx15("div", { ref, className: `skipo-drawer-container skipo-drawer--${position} ${className}`, ...props, children })
  ] });
});
DrawerContainer.displayName = "DrawerContainer";

// src/components/containers/ModalContainer.tsx
import { forwardRef as forwardRef15, useEffect } from "react";
import { createPortal } from "react-dom";
import { jsx as jsx16 } from "react/jsx-runtime";
var ModalContainer = forwardRef15(({
  open,
  onClose,
  children,
  className = "",
  ...props
}, ref) => {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    /* @__PURE__ */ jsx16("div", { className: "skipo-modal-overlay", onClick: onClose, children: /* @__PURE__ */ jsx16("div", { ref, className: `skipo-modal-content ${className}`, onClick: (e) => e.stopPropagation(), ...props, children }) }),
    document.body
  );
});
ModalContainer.displayName = "ModalContainer";

// src/components/containers/PanelContainer.tsx
import { forwardRef as forwardRef16 } from "react";
import { jsx as jsx17 } from "react/jsx-runtime";
var PanelContainer = forwardRef16(({
  className = "",
  children,
  ...props
}, ref) => {
  return /* @__PURE__ */ jsx17("div", { ref, className: `skipo-panel-container ${className}`, ...props, children });
});
PanelContainer.displayName = "PanelContainer";

// src/components/containers/SplitContainer.tsx
import { forwardRef as forwardRef17 } from "react";
import { jsx as jsx18 } from "react/jsx-runtime";
var SplitContainer = forwardRef17(({
  direction = "horizontal",
  children,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsx18("div", { ref, className: `skipo-split-container skipo-split--${direction} ${className}`, ...props, children });
});
SplitContainer.displayName = "SplitContainer";

// src/components/containers/TabContainer.tsx
import { forwardRef as forwardRef18, useState as useState5 } from "react";
import { jsx as jsx19, jsxs as jsxs9 } from "react/jsx-runtime";
var TabContainer = forwardRef18(({
  tabs,
  className = "",
  ...props
}, ref) => {
  const [activeTab, setActiveTab] = useState5(tabs[0]?.id);
  return /* @__PURE__ */ jsxs9("div", { ref, className: `skipo-tab-container ${className}`, ...props, children: [
    /* @__PURE__ */ jsx19("div", { className: "skipo-tab-list", children: tabs.map((tab) => /* @__PURE__ */ jsx19(BaseTooltip, { content: `SELECT TAB: ${tab.label.toUpperCase()}`, children: /* @__PURE__ */ jsx19(
      BaseButton,
      {
        size: "sm",
        variant: tab.id === activeTab ? "accent" : "ghost",
        onClick: () => setActiveTab(tab.id),
        children: tab.label
      }
    ) }, tab.id)) }),
    /* @__PURE__ */ jsx19("div", { className: "skipo-tab-panel", children: tabs.find((t) => t.id === activeTab)?.content })
  ] });
});
TabContainer.displayName = "TabContainer";

// src/components/containers/usePanelGeometry.ts
import { useState as useState6, useCallback as useCallback2, useEffect as useEffect2 } from "react";
var DEFAULT_PANEL_GEOMETRY = {
  x: 24,
  y: 60,
  width: 340,
  height: 480
};
var memoryCache = /* @__PURE__ */ new Map();
var subscribers = /* @__PURE__ */ new Map();
function readPersistedGeometry(key, fallback) {
  if (memoryCache.has(key)) return memoryCache.get(key);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.x === "number" && typeof parsed.y === "number" && typeof parsed.width === "number" && typeof parsed.height === "number") {
          memoryCache.set(key, parsed);
          return parsed;
        }
      }
    } catch {
    }
  }
  return fallback;
}
function writePersistedGeometry(key, geometry) {
  memoryCache.set(key, geometry);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(key, JSON.stringify(geometry));
    } catch {
    }
  }
  subscribers.get(key)?.forEach((fn) => fn(geometry));
}
function subscribeToGeometry(key, listener) {
  if (!subscribers.has(key)) {
    subscribers.set(key, /* @__PURE__ */ new Set());
  }
  subscribers.get(key).add(listener);
  return () => {
    subscribers.get(key)?.delete(listener);
  };
}
function usePanelGeometry(storageKey = "skipo:details-panel:geometry", defaultGeometry = DEFAULT_PANEL_GEOMETRY) {
  const [geometry, setGeometryState] = useState6(
    () => readPersistedGeometry(storageKey, defaultGeometry)
  );
  useEffect2(() => {
    setGeometryState(readPersistedGeometry(storageKey, defaultGeometry));
    return subscribeToGeometry(storageKey, setGeometryState);
  }, [storageKey]);
  const updateGeometry = useCallback2((next) => {
    setGeometryState((prev) => {
      const updated = typeof next === "function" ? next(prev) : { ...prev, ...next };
      writePersistedGeometry(storageKey, updated);
      return updated;
    });
  }, [storageKey]);
  return { geometry, updateGeometry };
}

// src/components/containers/ResizeHandles.tsx
import { Fragment as Fragment3, jsx as jsx20 } from "react/jsx-runtime";
var RESIZE_DIRECTIONS = ["nw", "ne", "se", "sw", "n", "s", "e", "w"];
function ResizeHandles({ onStartResize }) {
  return /* @__PURE__ */ jsx20(Fragment3, { children: RESIZE_DIRECTIONS.map((dir) => /* @__PURE__ */ jsx20(
    "div",
    {
      className: `skipo-resize-handle skipo-resize-${dir}`,
      onMouseDown: (e) => onStartResize(dir, e)
    },
    dir
  )) });
}

// src/components/containers/usePanelInteraction.ts
import { useState as useState7, useCallback as useCallback3, useEffect as useEffect3, useRef } from "react";
function calculateResized(dir, orig, dx, dy, minW, minH) {
  let { x, y, width, height } = orig;
  if (dir.includes("e")) width = Math.max(minW, orig.width + dx);
  if (dir.includes("s")) height = Math.max(minH, orig.height + dy);
  if (dir.includes("w")) {
    const nextW = Math.max(minW, orig.width - dx);
    x = orig.x + (orig.width - nextW);
    width = nextW;
  }
  if (dir.includes("n")) {
    const nextH = Math.max(minH, orig.height - dy);
    y = orig.y + (orig.height - nextH);
    height = nextH;
  }
  return { x, y, width, height };
}
function calculateDragged(orig, dx, dy) {
  const maxW = typeof window !== "undefined" ? window.innerWidth : 1920;
  const maxH = typeof window !== "undefined" ? window.innerHeight : 1080;
  const nextX = Math.max(0, Math.min(maxW - 60, orig.x + dx));
  const nextY = Math.max(0, Math.min(maxH - 40, orig.y + dy));
  return { ...orig, x: nextX, y: nextY };
}
function useInteractionListeners(isInteracting, setIsInteracting, activeOpRef, updateGeometry, minWidth, minHeight) {
  useEffect3(() => {
    if (!isInteracting) return;
    const onMouseMove = (e) => {
      const op = activeOpRef.current;
      if (!op) return;
      const dx = e.clientX - op.startX;
      const dy = e.clientY - op.startY;
      if (op.type === "drag") updateGeometry(calculateDragged(op.origGeo, dx, dy));
      if (op.type === "resize" && op.dir) updateGeometry(calculateResized(op.dir, op.origGeo, dx, dy, minWidth, minHeight));
    };
    const onMouseUp = () => {
      setIsInteracting(false);
      activeOpRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isInteracting, minWidth, minHeight, updateGeometry, setIsInteracting, activeOpRef]);
}
function usePanelInteraction(geometry, updateGeometry, minWidth, minHeight) {
  const [isInteracting, setIsInteracting] = useState7(false);
  const activeOpRef = useRef(null);
  const handleMouseDownHeader = useCallback3((e) => {
    if (e.target.closest("button")) return;
    setIsInteracting(true);
    activeOpRef.current = { type: "drag", startX: e.clientX, startY: e.clientY, origGeo: { ...geometry } };
  }, [geometry]);
  const handleStartResize = useCallback3((dir, e) => {
    e.stopPropagation();
    setIsInteracting(true);
    activeOpRef.current = { type: "resize", dir, startX: e.clientX, startY: e.clientY, origGeo: { ...geometry } };
  }, [geometry]);
  useInteractionListeners(isInteracting, setIsInteracting, activeOpRef, updateGeometry, minWidth, minHeight);
  return { isInteracting, handleMouseDownHeader, handleStartResize };
}

// src/components/containers/FloatingDetailsPanel.tsx
import { jsx as jsx21, jsxs as jsxs10 } from "react/jsx-runtime";
var PIN_ICON = /* @__PURE__ */ jsxs10("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
  /* @__PURE__ */ jsx21("line", { x1: "12", y1: "17", x2: "12", y2: "22" }),
  /* @__PURE__ */ jsx21("path", { d: "M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" })
] });
var CLOSE_ICON = /* @__PURE__ */ jsxs10("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
  /* @__PURE__ */ jsx21("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
  /* @__PURE__ */ jsx21("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
] });
function renderHeader(title, subtitle, isPinned, onTogglePin, onClose, headerActions, handleMouseDownHeader) {
  return /* @__PURE__ */ jsxs10("div", { className: "skipo-details-panel-header", onMouseDown: handleMouseDownHeader, children: [
    /* @__PURE__ */ jsxs10("div", { className: "skipo-details-panel-title-group", children: [
      /* @__PURE__ */ jsx21("div", { className: "skipo-details-panel-title", children: title }),
      subtitle && /* @__PURE__ */ jsx21("div", { className: "skipo-details-panel-subtitle", children: subtitle })
    ] }),
    /* @__PURE__ */ jsxs10("div", { className: "skipo-details-panel-actions", children: [
      headerActions,
      onTogglePin && /* @__PURE__ */ jsx21(
        IconOnlyButton,
        {
          icon: PIN_ICON,
          label: isPinned ? "Unpin details panel" : "Pin details panel",
          active: isPinned,
          onClick: onTogglePin
        }
      ),
      /* @__PURE__ */ jsx21(IconOnlyButton, { icon: CLOSE_ICON, label: "Close panel", onClick: onClose })
    ] })
  ] });
}
function FloatingDetailsPanel({
  title,
  subtitle,
  isOpen,
  onClose,
  isPinned = false,
  onTogglePin,
  storageKey = "skipo:details-panel:geometry",
  defaultGeometry = DEFAULT_PANEL_GEOMETRY,
  minWidth = 260,
  minHeight = 180,
  headerActions,
  children,
  className = ""
}) {
  const { geometry, updateGeometry } = usePanelGeometry(storageKey, defaultGeometry);
  const { isInteracting, handleMouseDownHeader, handleStartResize } = usePanelInteraction(geometry, updateGeometry, minWidth, minHeight);
  if (!isOpen) return null;
  return /* @__PURE__ */ jsxs10(
    "div",
    {
      className: `skipo-details-panel ${isInteracting ? "is-dragging" : ""} ${className}`,
      style: { left: `${geometry.x}px`, top: `${geometry.y}px`, width: `${geometry.width}px`, height: `${geometry.height}px` },
      children: [
        /* @__PURE__ */ jsx21(ResizeHandles, { onStartResize: handleStartResize }),
        renderHeader(title, subtitle, isPinned, onTogglePin, onClose, headerActions, handleMouseDownHeader),
        /* @__PURE__ */ jsx21("div", { className: "skipo-details-panel-body", children })
      ]
    }
  );
}

// src/components/composite/SearchInput.tsx
import { forwardRef as forwardRef19 } from "react";
import { jsx as jsx22 } from "react/jsx-runtime";
var SearchInput = forwardRef19(({
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsx22("div", { className: "skipo-search-input", children: /* @__PURE__ */ jsx22(BaseInput, { ref, type: "search", placeholder: "Search...", className, ...props }) });
});
SearchInput.displayName = "SearchInput";

// src/components/composite/ConfirmDialog.tsx
import { forwardRef as forwardRef20 } from "react";
import { jsx as jsx23, jsxs as jsxs11 } from "react/jsx-runtime";
var ConfirmDialog = forwardRef20(({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  danger
}, ref) => {
  return /* @__PURE__ */ jsxs11(ModalContainer, { ref, open, onClose: onCancel, children: [
    /* @__PURE__ */ jsx23("h3", { children: title }),
    /* @__PURE__ */ jsx23("p", { children: message }),
    /* @__PURE__ */ jsxs11("div", { style: { display: "flex", gap: "8px", marginTop: "16px" }, children: [
      /* @__PURE__ */ jsx23(BaseButton, { variant: "ghost", onClick: onCancel, children: "Cancel" }),
      /* @__PURE__ */ jsx23(BaseButton, { variant: danger ? "danger" : "accent", onClick: onConfirm, children: "Confirm" })
    ] })
  ] });
});
ConfirmDialog.displayName = "ConfirmDialog";

// src/components/composite/StatusIndicator.tsx
import { forwardRef as forwardRef21 } from "react";
import { jsx as jsx24, jsxs as jsxs12 } from "react/jsx-runtime";
var StatusIndicator = forwardRef21(({
  status,
  label,
  className = "",
  ...props
}, ref) => {
  const colorMap = {
    online: "var(--skipo-success)",
    offline: "var(--skipo-text-muted)",
    syncing: "var(--skipo-warning)",
    error: "var(--skipo-danger)"
  };
  return /* @__PURE__ */ jsxs12("div", { ref, className: `skipo-status-indicator ${className}`, style: { display: "flex", alignItems: "center", gap: "6px" }, ...props, children: [
    /* @__PURE__ */ jsx24("span", { className: "skipo-status-dot", style: { backgroundColor: colorMap[status] } }),
    label && /* @__PURE__ */ jsx24("span", { children: label })
  ] });
});
StatusIndicator.displayName = "StatusIndicator";

// src/components/composite/LoadingOverlay.tsx
import { forwardRef as forwardRef22 } from "react";
import { jsx as jsx25 } from "react/jsx-runtime";
var LoadingOverlay = forwardRef22(({
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsx25("div", { ref, className: `skipo-loading-overlay ${className}`, ...props, children: /* @__PURE__ */ jsx25("span", { className: "skipo-spinner", children: "Loading..." }) });
});
LoadingOverlay.displayName = "LoadingOverlay";

// src/components/composite/EmptyState.tsx
import { forwardRef as forwardRef23 } from "react";
import { jsx as jsx26, jsxs as jsxs13 } from "react/jsx-runtime";
var EmptyState = forwardRef23(({
  icon,
  message,
  actionLabel,
  onAction,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsxs13("div", { ref, className: `skipo-empty-state ${className}`, ...props, children: [
    icon && /* @__PURE__ */ jsx26("div", { children: icon }),
    /* @__PURE__ */ jsx26("p", { children: message }),
    actionLabel && onAction && /* @__PURE__ */ jsx26(BaseButton, { onClick: onAction, children: actionLabel })
  ] });
});
EmptyState.displayName = "EmptyState";

// src/components/composite/CopyableErrorAlert.tsx
import { useState as useState8 } from "react";
import { jsx as jsx27, jsxs as jsxs14 } from "react/jsx-runtime";
var CopyableErrorAlert = ({
  error,
  title = "System Error",
  className = "",
  onClear
}) => {
  const [copied, setCopied] = useState8(false);
  if (!error) return null;
  const errorMessage = typeof error === "string" ? error : error.message || String(error);
  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(errorMessage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2e3);
      }
    } catch {
    }
  };
  return /* @__PURE__ */ jsxs14(
    BaseCard,
    {
      variant: "surface",
      depth: "sm",
      className: `skipo-error-alert ${className}`,
      style: {
        border: "1px solid var(--skipo-danger, #ef4444)",
        background: "rgba(239, 68, 68, 0.08)",
        padding: "0.75rem 1rem",
        marginBottom: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem"
      },
      children: [
        /* @__PURE__ */ jsxs14("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }, children: [
          /* @__PURE__ */ jsxs14("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem" }, children: [
            /* @__PURE__ */ jsx27(BaseBadge, { variant: "neutral", style: { background: "var(--skipo-danger, #ef4444)", color: "#fff" }, children: "ERROR" }),
            /* @__PURE__ */ jsx27("span", { style: { fontWeight: "bold", fontSize: "13px" }, children: title })
          ] }),
          /* @__PURE__ */ jsxs14("div", { style: { display: "flex", alignItems: "center", gap: "0.25rem" }, children: [
            /* @__PURE__ */ jsx27(
              BaseButton,
              {
                size: "sm",
                variant: copied ? "success" : "secondary",
                onClick: handleCopy,
                type: "button",
                children: copied ? "COPIED" : "COPY"
              }
            ),
            onClear && /* @__PURE__ */ jsx27(BaseButton, { size: "sm", variant: "ghost", onClick: onClear, type: "button", children: "\u2715" })
          ] })
        ] }),
        /* @__PURE__ */ jsx27(
          "div",
          {
            style: {
              fontSize: "12px",
              fontFamily: "var(--skipo-font-mono, monospace)",
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
              maxHeight: "120px",
              overflowY: "auto",
              color: "var(--skipo-text)"
            },
            children: errorMessage
          }
        )
      ]
    }
  );
};
CopyableErrorAlert.displayName = "CopyableErrorAlert";

// src/components/composite/useSearchKeyboardNavigation.ts
import { useState as useState9, useEffect as useEffect4, useCallback as useCallback4, useRef as useRef2 } from "react";
function useSearchKeyboardNavigation({
  items,
  onSelect,
  onClose,
  initialIndex = 0
}) {
  const [highlightedIndex, setHighlightedIndex] = useState9(initialIndex);
  const listContainerRef = useRef2(null);
  useEffect4(() => {
    setHighlightedIndex(items.length > 0 ? 0 : -1);
  }, [items]);
  useEffect4(() => {
    if (highlightedIndex >= 0 && listContainerRef.current) {
      const container = listContainerRef.current;
      const element = container.children[highlightedIndex];
      if (element) {
        const elemTop = element.offsetTop;
        const elemBottom = elemTop + element.offsetHeight;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;
        if (elemTop < containerTop) {
          container.scrollTop = elemTop;
        } else if (elemBottom > containerBottom) {
          container.scrollTop = elemBottom - container.clientHeight;
        }
      }
    }
  }, [highlightedIndex]);
  const handleKeyDown = useCallback4(
    (e) => {
      if (items.length === 0) {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose?.();
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const activeIdx = highlightedIndex >= 0 && highlightedIndex < items.length ? highlightedIndex : 0;
        const activeItem = items[activeIdx];
        if (activeItem !== void 0) {
          onSelect(activeItem);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    },
    [items, highlightedIndex, onSelect, onClose]
  );
  return {
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown,
    highlightedItem: highlightedIndex >= 0 && highlightedIndex < items.length ? items[highlightedIndex] : void 0,
    listContainerRef
  };
}

// src/components/composite/SearchableList.tsx
import { useState as useState10, useMemo as useMemo2 } from "react";
import { jsx as jsx28, jsxs as jsxs15 } from "react/jsx-runtime";
function SearchableList({
  items,
  getItemKey,
  renderItem,
  onSelect,
  onClose,
  placeholder = "Search...",
  filterFn,
  emptyMessage = "No matching items",
  maxHeight = "240px",
  className = "",
  autoFocus = true
}) {
  const [query, setQuery] = useState10("");
  const filteredItems = useMemo2(() => {
    if (!query.trim()) return items;
    return items.filter((item) => filterFn(item, query));
  }, [items, query, filterFn]);
  const {
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown,
    listContainerRef
  } = useSearchKeyboardNavigation({
    items: filteredItems,
    onSelect,
    onClose
  });
  return /* @__PURE__ */ jsxs15("div", { className: `skipo-searchable-list ${className}`, style: { display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ jsx28("div", { style: { padding: "8px" }, children: /* @__PURE__ */ jsx28(
      SearchInput,
      {
        autoFocus,
        placeholder,
        value: query,
        onChange: (e) => setQuery(e.target.value),
        onKeyDown: handleKeyDown
      }
    ) }),
    /* @__PURE__ */ jsx28(
      "div",
      {
        ref: listContainerRef,
        style: {
          overflowY: "auto",
          maxHeight,
          padding: "4px 8px"
        },
        children: filteredItems.length === 0 ? /* @__PURE__ */ jsx28("div", { style: { padding: "16px", textAlign: "center", fontSize: "11px", color: "var(--skipo-text-muted, #888)" }, children: emptyMessage }) : filteredItems.map((item, idx) => {
          const isHighlighted = idx === highlightedIndex;
          return /* @__PURE__ */ jsx28(
            "div",
            {
              onMouseEnter: () => setHighlightedIndex(idx),
              onClick: () => onSelect(item),
              style: {
                cursor: "pointer",
                borderRadius: "var(--skipo-radius-sm, 4px)",
                backgroundColor: isHighlighted ? "var(--skipo-accent-subtle, rgba(97, 175, 239, 0.18))" : "transparent",
                border: isHighlighted ? "1px solid var(--skipo-accent, #61afef)" : "1px solid transparent",
                marginBottom: "2px",
                transition: "background-color 0.1s ease"
              },
              children: renderItem(item, isHighlighted)
            },
            getItemKey(item)
          );
        })
      }
    )
  ] });
}

// src/components/layout/AppShell.tsx
import { forwardRef as forwardRef25 } from "react";

// src/components/bottom-strip/BottomStrip.tsx
import { forwardRef as forwardRef24 } from "react";

// src/components/bottom-strip/StatusLight.tsx
import { jsx as jsx29 } from "react/jsx-runtime";
var StatusLight = ({
  status = "idle",
  label,
  pulse = false,
  className = "",
  ...props
}) => {
  const { setInspectionText } = useBottomStrip();
  const defaultLabels = {
    idle: "STATUS: SYSTEM READY (IDLE)",
    active: "STATUS: PROCESSING ACTIVE TASK",
    saving: "STATUS: SAVING CHANGES TO DISK",
    saved: "STATUS: ALL CHANGES SAVED",
    error: "STATUS: SYSTEM ERROR DETECTED",
    warning: "STATUS: SYSTEM WARNING"
  };
  const displayText = label || defaultLabels[status] || "STATUS: UNKNOWN";
  const colorMap = {
    idle: "var(--skipo-text-muted)",
    active: "var(--skipo-info)",
    saving: "var(--skipo-accent)",
    saved: "var(--skipo-success)",
    error: "var(--skipo-danger)",
    warning: "var(--skipo-warning)"
  };
  const currentColor = colorMap[status];
  return /* @__PURE__ */ jsx29(
    "span",
    {
      className: `skipo-status-light skipo-status-light--${status} ${pulse ? "skipo-status-light--pulse" : ""} ${className}`,
      style: {
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        backgroundColor: currentColor,
        boxShadow: pulse ? `0 0 8px ${currentColor}` : void 0,
        cursor: "default",
        transition: "all 0.2s ease"
      },
      onMouseEnter: () => setInspectionText(displayText),
      onMouseLeave: () => setInspectionText(null),
      onFocus: () => setInspectionText(displayText),
      onBlur: () => setInspectionText(null),
      tabIndex: 0,
      "aria-label": displayText,
      ...props
    }
  );
};
StatusLight.displayName = "StatusLight";

// src/components/bottom-strip/AutoSaveToggle.tsx
import { jsx as jsx30, jsxs as jsxs16 } from "react/jsx-runtime";
var AutoSaveToggle = ({
  onToggle,
  className = "",
  ...props
}) => {
  const { autoSave, setInspectionText } = useBottomStrip();
  const isEnabled = autoSave.enabled;
  const handleClick = (e) => {
    if (onToggle) onToggle();
    else autoSave.toggle();
    if (props.onClick) props.onClick(e);
  };
  const inspectionLabel = isEnabled ? "AUTO-SAVE: ACTIVE (AUTOMATIC BACKGROUND PERSISTENCE)" : "AUTO-SAVE: PAUSED (CHANGES REQUIRE MANUAL SAVE)";
  return /* @__PURE__ */ jsx30(
    BaseButton,
    {
      variant: "ghost",
      size: "sm",
      className: `skipo-autosave-toggle ${isEnabled ? "skipo-autosave-toggle--active" : ""} ${className}`,
      onClick: handleClick,
      onMouseEnter: () => setInspectionText(inspectionLabel),
      onMouseLeave: () => setInspectionText(null),
      onFocus: () => setInspectionText(inspectionLabel),
      onBlur: () => setInspectionText(null),
      "aria-label": inspectionLabel,
      style: {
        padding: "2px 4px",
        color: isEnabled ? "var(--skipo-success)" : "var(--skipo-text-muted)"
      },
      ...props,
      children: /* @__PURE__ */ jsxs16(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          children: [
            /* @__PURE__ */ jsx30("path", { d: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" }),
            /* @__PURE__ */ jsx30("polyline", { points: "17 21 17 13 7 13 7 21" }),
            /* @__PURE__ */ jsx30("polyline", { points: "7 3 7 8 15 8" })
          ]
        }
      )
    }
  );
};
AutoSaveToggle.displayName = "AutoSaveToggle";

// src/components/bottom-strip/ApiCallIndicator.tsx
import { jsx as jsx31, jsxs as jsxs17 } from "react/jsx-runtime";
var ApiCallIndicator = ({
  activeCount,
  className = "",
  ...props
}) => {
  const { apiActivity, setInspectionText } = useBottomStrip();
  const count = activeCount !== void 0 ? activeCount : apiActivity.activeCount;
  const isBusy = count > 0;
  const inspectionLabel = isBusy ? `API IN-FLIGHT: ${count} ACTIVE REQUEST(S)${apiActivity.lastEndpoint ? ` (${apiActivity.lastMethod || "REQ"} ${apiActivity.lastEndpoint})` : ""}` : "API NETWORK: IDLE (ZERO PENDING CALLS)";
  return /* @__PURE__ */ jsxs17(
    "span",
    {
      className: `skipo-api-indicator ${isBusy ? "skipo-api-indicator--busy" : ""} ${className}`,
      onMouseEnter: () => setInspectionText(inspectionLabel),
      onMouseLeave: () => setInspectionText(null),
      onFocus: () => setInspectionText(inspectionLabel),
      onBlur: () => setInspectionText(null),
      tabIndex: 0,
      "aria-label": inspectionLabel,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        color: isBusy ? "var(--skipo-accent)" : "var(--skipo-text-muted)",
        cursor: "default",
        transition: "color 0.2s ease"
      },
      ...props,
      children: [
        /* @__PURE__ */ jsx31(
          "svg",
          {
            width: "13",
            height: "13",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            style: {
              animation: isBusy ? "skipo-pulse-glow 1.5s infinite ease-in-out" : void 0
            },
            children: /* @__PURE__ */ jsx31("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })
          }
        ),
        isBusy && /* @__PURE__ */ jsx31("span", { style: { fontSize: "10px", fontWeight: 900, fontFamily: "var(--skipo-font-mono)" }, children: count })
      ]
    }
  );
};
ApiCallIndicator.displayName = "ApiCallIndicator";

// src/components/bottom-strip/SystemMessageDisplay.tsx
import { jsx as jsx32, jsxs as jsxs18 } from "react/jsx-runtime";
var SystemMessageDisplay = ({
  className = "",
  ...props
}) => {
  const { systemMessages, clearSystemMessage, setInspectionText } = useBottomStrip();
  const latestMessage = systemMessages[systemMessages.length - 1];
  if (!latestMessage) return null;
  const colorMap = {
    success: "var(--skipo-success)",
    error: "var(--skipo-danger)",
    warning: "var(--skipo-warning)",
    info: "var(--skipo-info)"
  };
  const currentColor = colorMap[latestMessage.type] || "var(--skipo-text)";
  const inspectionLabel = `SYSTEM [${latestMessage.type.toUpperCase()}]: ${latestMessage.message} (CLICK TO DISMISS)`;
  return /* @__PURE__ */ jsxs18(
    "div",
    {
      className: `skipo-system-msg-display skipo-system-msg-display--${latestMessage.type} ${className}`,
      onMouseEnter: () => setInspectionText(inspectionLabel),
      onMouseLeave: () => setInspectionText(null),
      onClick: () => {
        clearSystemMessage(latestMessage.id);
        setInspectionText(null);
      },
      role: "button",
      tabIndex: 0,
      "aria-label": inspectionLabel,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        color: currentColor,
        fontSize: "11px",
        fontFamily: "var(--skipo-font-mono)",
        fontWeight: 700,
        cursor: "pointer",
        maxWidth: "220px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis"
      },
      ...props,
      children: [
        /* @__PURE__ */ jsx32(
          "span",
          {
            style: {
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: currentColor,
              flexShrink: 0
            }
          }
        ),
        /* @__PURE__ */ jsx32("span", { style: { overflow: "hidden", textOverflow: "ellipsis" }, children: latestMessage.message })
      ]
    }
  );
};
SystemMessageDisplay.displayName = "SystemMessageDisplay";

// src/components/bottom-strip/BottomStrip.tsx
import { Fragment as Fragment4, jsx as jsx33, jsxs as jsxs19 } from "react/jsx-runtime";
var BottomStrip = forwardRef24(({
  leftSlot,
  centerSlot,
  rightSlot,
  hideDefaultLeft = false,
  hideDefaultRight = false,
  className = "",
  ...props
}, ref) => {
  const { inspectionText } = useBottomStrip();
  return /* @__PURE__ */ jsxs19(
    "footer",
    {
      ref,
      className: `skipo-bottom-strip ${className}`,
      style: {
        height: "var(--skipo-bottom-strip-height, 30px)",
        minHeight: "var(--skipo-bottom-strip-height, 30px)",
        background: "var(--skipo-bottom-strip-bg, rgba(15, 17, 21, 0.95))",
        borderTop: "var(--skipo-border, 2px solid rgba(255, 255, 255, 0.85))",
        backdropFilter: "var(--skipo-matte-blur, blur(20px))",
        WebkitBackdropFilter: "var(--skipo-matte-blur, blur(20px))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 0.75rem",
        fontSize: "11px",
        fontFamily: "var(--skipo-font-mono)",
        zIndex: 40,
        position: "relative",
        userSelect: "none"
      },
      ...props,
      children: [
        /* @__PURE__ */ jsxs19(
          "div",
          {
            className: "skipo-bottom-strip__left",
            style: {
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexShrink: 0,
              minWidth: "120px"
            },
            children: [
              !hideDefaultLeft && /* @__PURE__ */ jsxs19(Fragment4, { children: [
                /* @__PURE__ */ jsx33(StatusLight, {}),
                /* @__PURE__ */ jsx33(AutoSaveToggle, {})
              ] }),
              leftSlot
            ]
          }
        ),
        /* @__PURE__ */ jsx33(
          "div",
          {
            className: "skipo-bottom-strip__center",
            style: {
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              padding: "0 1rem",
              pointerEvents: "none"
            },
            children: centerSlot || /* @__PURE__ */ jsx33(
              "span",
              {
                className: "skipo-inspection-text",
                style: {
                  color: "var(--skipo-inspection-text-color, rgba(241, 245, 249, 0.80))",
                  fontSize: "11px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  opacity: inspectionText ? 0.85 : 0,
                  transform: inspectionText ? "translateY(0)" : "translateY(2px)",
                  transition: "opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
                },
                children: inspectionText || ""
              }
            )
          }
        ),
        /* @__PURE__ */ jsxs19(
          "div",
          {
            className: "skipo-bottom-strip__right",
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "12px",
              flexShrink: 0,
              minWidth: "140px"
            },
            children: [
              rightSlot,
              !hideDefaultRight && /* @__PURE__ */ jsxs19(Fragment4, { children: [
                /* @__PURE__ */ jsx33(ApiCallIndicator, {}),
                /* @__PURE__ */ jsx33(SystemMessageDisplay, {})
              ] })
            ]
          }
        )
      ]
    }
  );
});
BottomStrip.displayName = "BottomStrip";

// src/components/layout/AppShell.tsx
import { jsx as jsx34, jsxs as jsxs20 } from "react/jsx-runtime";
var AppShell = forwardRef25(({
  header,
  sidebar,
  footer,
  bottomStripProps,
  disableBottomStrip = false,
  children,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsx34(BottomStripProvider, { children: /* @__PURE__ */ jsxs20(
    "div",
    {
      ref,
      className: `skipo-app-shell ${className}`,
      style: {
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "var(--skipo-bg)",
        color: "var(--skipo-text)",
        fontFamily: "var(--skipo-font)"
      },
      ...props,
      children: [
        sidebar,
        /* @__PURE__ */ jsxs20(
          "div",
          {
            style: {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative"
            },
            children: [
              header,
              /* @__PURE__ */ jsx34(
                "main",
                {
                  className: "skipo-app-shell__main",
                  style: {
                    flex: 1,
                    overflow: "auto",
                    position: "relative"
                  },
                  children
                }
              ),
              footer !== void 0 ? footer : !disableBottomStrip && /* @__PURE__ */ jsx34(BottomStrip, { ...bottomStripProps })
            ]
          }
        )
      ]
    }
  ) });
});
AppShell.displayName = "AppShell";

// src/components/layout/HeaderBar.tsx
import { forwardRef as forwardRef26 } from "react";
import { jsx as jsx35, jsxs as jsxs21 } from "react/jsx-runtime";
var HeaderBar = forwardRef26(({
  title,
  nav,
  actions,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsxs21("header", { ref, className: `skipo-header ${className}`, ...props, children: [
    /* @__PURE__ */ jsxs21("div", { style: { display: "flex", alignItems: "center", gap: "16px" }, children: [
      title && /* @__PURE__ */ jsx35("strong", { children: title }),
      nav
    ] }),
    actions && /* @__PURE__ */ jsx35("div", { children: actions })
  ] });
});
HeaderBar.displayName = "HeaderBar";

// src/components/layout/BreadcrumbNav.tsx
import React29, { forwardRef as forwardRef27 } from "react";
import { jsx as jsx36, jsxs as jsxs22 } from "react/jsx-runtime";
var BreadcrumbNav = forwardRef27(({
  paths,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsx36("nav", { ref, className: `skipo-breadcrumb ${className}`, ...props, children: paths.map((p, i) => /* @__PURE__ */ jsxs22(React29.Fragment, { children: [
    p.href ? /* @__PURE__ */ jsx36("a", { href: p.href, children: p.label }) : /* @__PURE__ */ jsx36("span", { children: p.label }),
    i < paths.length - 1 && /* @__PURE__ */ jsx36("span", { children: "/" })
  ] }, i)) });
});
BreadcrumbNav.displayName = "BreadcrumbNav";

// src/components/layout/TopToolbar.tsx
import { forwardRef as forwardRef28 } from "react";
import { jsx as jsx37, jsxs as jsxs23 } from "react/jsx-runtime";
var TopToolbar = forwardRef28(({
  title,
  logo,
  tabs = [],
  activeTabId,
  onSelectTab,
  actions,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsxs23(
    "header",
    {
      ref,
      className: `skipo-top-toolbar ${className}`,
      style: {
        height: "var(--skipo-top-toolbar-height, 44px)",
        minHeight: "var(--skipo-top-toolbar-height, 44px)",
        background: "var(--skipo-top-toolbar-bg, rgba(18, 20, 25, 0.95))",
        borderBottom: "var(--skipo-border, 2px solid rgba(255, 255, 255, 0.85))",
        backdropFilter: "var(--skipo-matte-blur, blur(20px))",
        WebkitBackdropFilter: "var(--skipo-matte-blur, blur(20px))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 0.75rem",
        zIndex: 50,
        position: "relative",
        userSelect: "none"
      },
      ...props,
      children: [
        /* @__PURE__ */ jsxs23(
          "div",
          {
            className: "skipo-top-toolbar__brand",
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontFamily: "var(--skipo-font)",
              fontWeight: 900,
              fontSize: "13px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              flexShrink: 0
            },
            children: [
              logo,
              title && /* @__PURE__ */ jsx37("span", { className: "skipo-top-toolbar__title", children: title })
            ]
          }
        ),
        tabs.length > 0 && /* @__PURE__ */ jsx37(
          "nav",
          {
            className: "skipo-top-toolbar__tabs",
            role: "tablist",
            style: {
              display: "flex",
              alignItems: "center",
              gap: "4px",
              overflowX: "auto",
              height: "100%"
            },
            children: tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return /* @__PURE__ */ jsx37(BaseTooltip, { content: `SWITCH VIEW: ${tab.label.toUpperCase()}`, children: /* @__PURE__ */ jsxs23(
                BaseButton,
                {
                  role: "tab",
                  size: "sm",
                  "aria-selected": isActive,
                  disabled: tab.disabled,
                  variant: isActive ? "accent" : "ghost",
                  onClick: () => onSelectTab && onSelectTab(tab.id),
                  className: `skipo-tab-item ${isActive ? "skipo-tab-item--active" : ""}`,
                  style: {
                    height: "28px",
                    padding: "0 10px",
                    fontFamily: "var(--skipo-font-mono)",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing: "0.05em"
                  },
                  children: [
                    tab.icon,
                    /* @__PURE__ */ jsx37("span", { children: tab.label })
                  ]
                }
              ) }, tab.id);
            })
          }
        ),
        actions && /* @__PURE__ */ jsx37(
          "div",
          {
            className: "skipo-top-toolbar__actions",
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0
            },
            children: actions
          }
        )
      ]
    }
  );
});
TopToolbar.displayName = "TopToolbar";
export {
  ApiCallIndicator,
  AppShell,
  AutoSaveToggle,
  BaseBadge,
  BaseButton,
  BaseCard,
  BaseInput,
  BaseSelect,
  BaseTextarea,
  BaseToggle,
  BaseTooltip,
  BottomStrip,
  BottomStripProvider,
  BreadcrumbNav,
  ConfirmDialog,
  CopyableErrorAlert,
  CredentialField,
  DEFAULT_DARK_THEME_PACK,
  DEFAULT_LIGHT_THEME_PACK,
  DEFAULT_PANEL_GEOMETRY,
  DrawerContainer,
  EmptyState,
  FloatingDetailsPanel,
  HeaderBar,
  IconOnlyButton,
  KNOWN_CREDENTIAL_URLS,
  LoadingOverlay,
  ModalContainer,
  PageContainer,
  PanelContainer,
  ResizeHandles,
  SearchInput,
  SearchableList,
  SectionContainer,
  SidebarContainer,
  SkipoThemeProvider,
  SplitContainer,
  StatusIndicator,
  StatusLight,
  SystemMessageDisplay,
  TabContainer,
  TopToolbar,
  applyThemePack,
  palettes,
  tokensToCssVariables,
  useBottomStrip,
  usePanelGeometry,
  usePanelInteraction,
  useSearchKeyboardNavigation,
  useSkipoTheme,
  validateThemePack
};
