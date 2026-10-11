import {
  BlockquoteStyleSchema,
  CANONICAL_ELEMENTS,
  CodeStyleSchema,
  DEFAULT_DARK_THEME_PACK,
  DEFAULT_LIGHT_THEME_PACK,
  DEPM_THEME_PACKS,
  DOCUSTACK_CYBERPUNK_PACK,
  DOCUSTACK_DARK_GOLD_PACK,
  DOCUSTACK_WARM_COFFEE_PACK,
  HeadingLevelSchema,
  HorizontalRuleStyleSchema,
  LinkStyleSchema,
  ListStyleSchema,
  MarkdownSectionStylesSchema,
  ModularThemePackSchema,
  ParagraphStyleSchema,
  SkipoSemanticTokensSchema,
  SkipoThemeMetadataSchema,
  SkipoThemeProvider,
  TableStyleSchema,
  ThemeEngine,
  ThemeTypographySchema,
  ThemeVariantDefinitionSchema,
  UIElementThemeValueSchema,
  appThemeEngine,
  applyThemePack,
  centralLedger,
  createAppThemeSocket,
  depmThemeSocket,
  docustack_cyberpunk_neon_default,
  docustack_dark_gold_default,
  docustack_warm_coffee_default,
  getAllUIElements,
  getThemeEngineStatus,
  getUIElement,
  palettes,
  registerUIElement,
  resolveTypographyCascade,
  safeValidateModularThemePack,
  tokensToCssVariables,
  useSkipoTheme,
  validateModularThemePack,
  validateSocketElements,
  validateThemePack
} from "./chunk-6QCUHYUF.js";

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
import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
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
  const [inspectionText, setInspectionTextState] = useState(null);
  const [inspectionDescription, setInspectionDescription] = useState(null);
  const [isDKeyPressed, setIsDKeyPressed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isEditable = (el) => {
      const tag = el?.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || el?.isContentEditable;
    };
    const handleKeyDown = (e) => {
      if ((e.key === "d" || e.key === "D") && !isEditable(e.target)) {
        setIsDKeyPressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === "d" || e.key === "D") {
        setIsDKeyPressed(false);
      }
    };
    const handleBlur = () => setIsDKeyPressed(false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);
  const setInspectionText = useCallback((text, description) => {
    setInspectionTextState(text);
    setInspectionDescription(description || null);
  }, []);
  const autoSave = useAutoSaveController(initialAutoSave);
  const apiActivity = useApiActivityController();
  const { systemMessages, showSystemMessage, clearSystemMessage } = useSystemMessageController();
  const value = useMemo(() => ({
    inspectionText,
    inspectionDescription,
    isDKeyPressed,
    setInspectionText,
    autoSave,
    apiActivity,
    systemMessages,
    showSystemMessage,
    clearSystemMessage
  }), [inspectionText, inspectionDescription, isDKeyPressed, setInspectionText, autoSave, apiActivity, systemMessages, showSystemMessage, clearSystemMessage]);
  return /* @__PURE__ */ jsx8(BottomStripContext.Provider, { value, children });
}
function useBottomStrip() {
  const ctx = useContext(BottomStripContext);
  if (!ctx) {
    return {
      inspectionText: null,
      inspectionDescription: null,
      isDKeyPressed: false,
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
  description,
  children,
  className = "",
  ...props
}, ref) => {
  const { setInspectionText } = useBottomStrip();
  const textContent = typeof content === "string" ? content : React9.Children.toArray(content).filter((c) => typeof c === "string").join(" ") || String(content ?? "");
  const handleMouseEnter = (e) => {
    setInspectionText(textContent, description);
    if (props.onMouseEnter) props.onMouseEnter(e);
  };
  const handleMouseLeave = (e) => {
    setInspectionText(null, null);
    if (props.onMouseLeave) props.onMouseLeave(e);
  };
  const handleFocus = (e) => {
    setInspectionText(textContent, description);
    if (props.onFocus) props.onFocus(e);
  };
  const handleBlur = (e) => {
    setInspectionText(null, null);
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
import { forwardRef as forwardRef15, useEffect as useEffect2 } from "react";
import { createPortal } from "react-dom";
import { jsx as jsx16 } from "react/jsx-runtime";
var ModalContainer = forwardRef15(({
  open,
  onClose,
  children,
  className = "",
  ...props
}, ref) => {
  useEffect2(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    /* @__PURE__ */ jsx16("div", { className: "skipo-modal-overlay overscroll-contain", onClick: onClose, onWheel: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsx16("div", { ref, className: `skipo-modal-content overscroll-contain ${className}`, onClick: (e) => e.stopPropagation(), onWheel: (e) => e.stopPropagation(), ...props, children }) }),
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
import { useState as useState6, useCallback as useCallback2, useEffect as useEffect3 } from "react";
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
  useEffect3(() => {
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
import { useState as useState7, useCallback as useCallback3, useEffect as useEffect4, useRef } from "react";
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
  useEffect4(() => {
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
  const handleCopy = async (e) => {
    e.stopPropagation();
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
        gap: "0.5rem",
        position: "relative"
      },
      children: [
        /* @__PURE__ */ jsxs14("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }, children: [
          /* @__PURE__ */ jsxs14("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden" }, children: [
            /* @__PURE__ */ jsx27(BaseBadge, { variant: "neutral", style: { background: "var(--skipo-danger, #ef4444)", color: "var(--skipo-danger-fg, #ffffff)" }, children: "ERROR" }),
            /* @__PURE__ */ jsx27("span", { style: { fontWeight: "bold", fontSize: "13px", color: "var(--skipo-text)" }, children: title })
          ] }),
          /* @__PURE__ */ jsxs14("div", { style: { display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }, children: [
            /* @__PURE__ */ jsx27(
              BaseButton,
              {
                size: "sm",
                variant: copied ? "success" : "secondary",
                onClick: handleCopy,
                type: "button",
                title: "Copy Error to Clipboard",
                "aria-label": "Copy Error",
                style: { fontSize: "10px", height: "24px", padding: "0 8px" },
                children: copied ? "Copied" : "Copy"
              }
            ),
            onClear && /* @__PURE__ */ jsx27(
              BaseButton,
              {
                size: "sm",
                variant: "ghost",
                onClick: onClear,
                type: "button",
                title: "Dismiss",
                "aria-label": "Dismiss",
                style: { fontSize: "10px", height: "24px", padding: "0 6px" },
                children: "\u2715"
              }
            )
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
              maxHeight: "140px",
              overflowY: "auto",
              color: "var(--skipo-text)",
              backgroundColor: "rgba(0, 0, 0, 0.2)",
              padding: "6px 8px",
              borderRadius: "4px"
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
import { useState as useState9, useEffect as useEffect5, useCallback as useCallback4, useRef as useRef2 } from "react";
function useSearchKeyboardNavigation({
  items,
  onSelect,
  onClose,
  initialIndex = 0
}) {
  const [highlightedIndex, setHighlightedIndex] = useState9(initialIndex);
  const listContainerRef = useRef2(null);
  useEffect5(() => {
    setHighlightedIndex(items.length > 0 ? 0 : -1);
  }, [items]);
  useEffect5(() => {
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

// src/components/composite/CopyableLogViewer.tsx
import { useState as useState11, useMemo as useMemo3, useRef as useRef3, useEffect as useEffect6 } from "react";
import { jsx as jsx29, jsxs as jsxs16 } from "react/jsx-runtime";
var CopyableLogViewer = ({
  logs,
  title = "System Logs",
  maxHeight = "280px",
  autoScroll = true,
  className = "",
  onClear
}) => {
  const [copied, setCopied] = useState11(false);
  const [filter, setFilter] = useState11("all");
  const scrollRef = useRef3(null);
  const normalizedLogs = useMemo3(() => {
    return logs.map((log, idx) => {
      if (typeof log === "string") {
        const isErr = /error|fatal|fail/i.test(log);
        const isWarn = /warn/i.test(log);
        return {
          id: `log-${idx}`,
          level: isErr ? "error" : isWarn ? "warn" : "info",
          message: log,
          timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString()
        };
      }
      return {
        id: log.id || `log-${idx}`,
        level: log.level || "info",
        message: log.message,
        timestamp: log.timestamp || (/* @__PURE__ */ new Date()).toLocaleTimeString()
      };
    });
  }, [logs]);
  const filteredLogs = useMemo3(() => {
    if (filter === "all") return normalizedLogs;
    return normalizedLogs.filter((l) => l.level === filter);
  }, [normalizedLogs, filter]);
  useEffect6(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);
  const handleCopyAll = async () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.level?.toUpperCase()}] ${l.message}`).join("\n");
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2e3);
      }
    } catch {
    }
  };
  const getLevelColor = (level) => {
    if (level === "error") return "var(--skipo-danger, #ef4444)";
    if (level === "warn") return "var(--skipo-warning, #f59e0b)";
    return "var(--skipo-accent, #61afef)";
  };
  return /* @__PURE__ */ jsxs16(
    BaseCard,
    {
      variant: "surface",
      depth: "sm",
      className: `skipo-log-viewer ${className}`,
      style: {
        border: "1px solid var(--skipo-border-color, #333)",
        backgroundColor: "var(--skipo-surface, #1e1e24)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      },
      children: [
        /* @__PURE__ */ jsxs16(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 12px",
              borderBottom: "1px solid var(--skipo-border-color, #333)",
              backgroundColor: "rgba(0, 0, 0, 0.25)"
            },
            children: [
              /* @__PURE__ */ jsxs16("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
                /* @__PURE__ */ jsx29("span", { style: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--skipo-text)" }, children: title }),
                /* @__PURE__ */ jsx29(BaseBadge, { variant: "neutral", style: { fontSize: "10px", padding: "1px 6px" }, children: filteredLogs.length })
              ] }),
              /* @__PURE__ */ jsxs16("div", { style: { display: "flex", alignItems: "center", gap: "6px" }, children: [
                /* @__PURE__ */ jsxs16(
                  "button",
                  {
                    type: "button",
                    onClick: () => setFilter((f) => f === "all" ? "error" : f === "error" ? "warn" : "all"),
                    style: {
                      background: "none",
                      border: "1px solid var(--skipo-border-color, #444)",
                      borderRadius: "4px",
                      color: "var(--skipo-text-muted, #888)",
                      fontSize: "10px",
                      padding: "2px 6px",
                      cursor: "pointer"
                    },
                    children: [
                      "Filter: ",
                      filter.toUpperCase()
                    ]
                  }
                ),
                /* @__PURE__ */ jsx29(
                  BaseButton,
                  {
                    size: "sm",
                    variant: copied ? "success" : "secondary",
                    onClick: handleCopyAll,
                    type: "button",
                    title: "Copy Logs",
                    "aria-label": "Copy Logs",
                    style: { fontSize: "10px", height: "22px", padding: "0 8px" },
                    children: copied ? "Copied" : "Copy"
                  }
                ),
                onClear && /* @__PURE__ */ jsx29(
                  BaseButton,
                  {
                    size: "sm",
                    variant: "ghost",
                    onClick: onClear,
                    type: "button",
                    title: "Clear",
                    "aria-label": "Clear",
                    style: { fontSize: "10px", height: "22px", padding: "0 6px" },
                    children: "\u2715"
                  }
                )
              ] })
            ]
          }
        ),
        /* @__PURE__ */ jsx29(
          "div",
          {
            ref: scrollRef,
            style: {
              maxHeight,
              overflowY: "auto",
              padding: "8px 12px",
              fontFamily: "var(--skipo-font-mono, monospace)",
              fontSize: "11px",
              lineHeight: "1.5",
              backgroundColor: "var(--skipo-bg, #121214)",
              color: "var(--skipo-text, #f1f5f9)"
            },
            children: filteredLogs.length === 0 ? /* @__PURE__ */ jsx29("div", { style: { color: "var(--skipo-text-muted, #666)", fontStyle: "italic", padding: "8px 0" }, children: "No log entries recorded." }) : filteredLogs.map((log) => /* @__PURE__ */ jsxs16("div", { style: { display: "flex", gap: "8px", wordBreak: "break-all" }, children: [
              /* @__PURE__ */ jsx29("span", { style: { color: "var(--skipo-text-muted, #555)", flexShrink: 0, fontSize: "10px" }, children: log.timestamp }),
              /* @__PURE__ */ jsxs16("span", { style: { color: getLevelColor(log.level), fontWeight: 700, width: "42px", flexShrink: 0, fontSize: "10px" }, children: [
                "[",
                log.level?.toUpperCase(),
                "]"
              ] }),
              /* @__PURE__ */ jsx29("span", { style: { flex: 1 }, children: log.message })
            ] }, log.id))
          }
        )
      ]
    }
  );
};
CopyableLogViewer.displayName = "CopyableLogViewer";

// src/components/layout/AppShell.tsx
import { forwardRef as forwardRef25 } from "react";

// src/components/bottom-strip/BottomStrip.tsx
import { forwardRef as forwardRef24 } from "react";

// src/components/bottom-strip/StatusLight.tsx
import { jsx as jsx30 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsx30(
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
import { jsx as jsx31, jsxs as jsxs17 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsx31(
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
      children: /* @__PURE__ */ jsxs17(
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
            /* @__PURE__ */ jsx31("path", { d: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" }),
            /* @__PURE__ */ jsx31("polyline", { points: "17 21 17 13 7 13 7 21" }),
            /* @__PURE__ */ jsx31("polyline", { points: "7 3 7 8 15 8" })
          ]
        }
      )
    }
  );
};
AutoSaveToggle.displayName = "AutoSaveToggle";

// src/components/bottom-strip/ApiCallIndicator.tsx
import { jsx as jsx32, jsxs as jsxs18 } from "react/jsx-runtime";
var ApiCallIndicator = ({
  activeCount,
  className = "",
  ...props
}) => {
  const { apiActivity, setInspectionText } = useBottomStrip();
  const count = activeCount !== void 0 ? activeCount : apiActivity.activeCount;
  const isBusy = count > 0;
  const inspectionLabel = isBusy ? `API IN-FLIGHT: ${count} ACTIVE REQUEST(S)${apiActivity.lastEndpoint ? ` (${apiActivity.lastMethod || "REQ"} ${apiActivity.lastEndpoint})` : ""}` : "API NETWORK: IDLE (ZERO PENDING CALLS)";
  return /* @__PURE__ */ jsxs18(
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
        /* @__PURE__ */ jsx32(
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
            children: /* @__PURE__ */ jsx32("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })
          }
        ),
        isBusy && /* @__PURE__ */ jsx32("span", { style: { fontSize: "10px", fontWeight: 900, fontFamily: "var(--skipo-font-mono)" }, children: count })
      ]
    }
  );
};
ApiCallIndicator.displayName = "ApiCallIndicator";

// src/components/bottom-strip/SystemMessageDisplay.tsx
import { jsx as jsx33, jsxs as jsxs19 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs19(
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
        /* @__PURE__ */ jsx33(
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
        /* @__PURE__ */ jsx33("span", { style: { overflow: "hidden", textOverflow: "ellipsis" }, children: latestMessage.message })
      ]
    }
  );
};
SystemMessageDisplay.displayName = "SystemMessageDisplay";

// src/components/bottom-strip/BottomStrip.tsx
import { Fragment as Fragment4, jsx as jsx34, jsxs as jsxs20 } from "react/jsx-runtime";
var BottomStrip = forwardRef24(({
  leftSlot,
  centerSlot,
  rightSlot,
  hideDefaultLeft = false,
  hideDefaultRight = false,
  className = "",
  ...props
}, ref) => {
  const { inspectionText, inspectionDescription, isDKeyPressed } = useBottomStrip();
  const showDescription = Boolean(isDKeyPressed && inspectionDescription);
  const activeText = showDescription ? inspectionDescription : inspectionText;
  return /* @__PURE__ */ jsxs20(
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
        /* @__PURE__ */ jsxs20(
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
              !hideDefaultLeft && /* @__PURE__ */ jsxs20(Fragment4, { children: [
                /* @__PURE__ */ jsx34(StatusLight, {}),
                /* @__PURE__ */ jsx34(AutoSaveToggle, {})
              ] }),
              leftSlot
            ]
          }
        ),
        /* @__PURE__ */ jsx34(
          "div",
          {
            className: "skipo-bottom-strip__center",
            style: {
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              padding: "0 0.5rem",
              pointerEvents: "none",
              textAlign: "center"
            },
            children: centerSlot || /* @__PURE__ */ jsx34(
              "span",
              {
                className: "skipo-inspection-text",
                "data-mode": showDescription ? "description" : "label",
                style: {
                  color: "var(--skipo-inspection-text-color, rgba(241, 245, 249, 0.85))",
                  fontSize: showDescription ? "10px" : "clamp(8px, 1.1vw, 11px)",
                  lineHeight: 1.15,
                  fontWeight: showDescription ? 300 : 700,
                  textTransform: showDescription ? "none" : "uppercase",
                  letterSpacing: showDescription ? "0.01em" : "0.04em",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  maxHeight: "100%",
                  opacity: activeText ? 0.9 : 0,
                  transform: activeText ? "translateY(0)" : "translateY(1px)",
                  transition: "opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                },
                children: activeText || ""
              }
            )
          }
        ),
        /* @__PURE__ */ jsxs20(
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
              !hideDefaultRight && /* @__PURE__ */ jsxs20(Fragment4, { children: [
                /* @__PURE__ */ jsx34(ApiCallIndicator, {}),
                /* @__PURE__ */ jsx34(SystemMessageDisplay, {})
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
import { jsx as jsx35, jsxs as jsxs21 } from "react/jsx-runtime";
var AppShell = forwardRef25(({
  header,
  sidebar,
  footer,
  bottomStripProps,
  disableBottomStrip = false,
  workspaceGate,
  children,
  className = "",
  ...props
}, ref) => {
  if (workspaceGate) {
    return /* @__PURE__ */ jsx35("div", { className: `skipo-workspace-screen-gate ${className}`, style: { minHeight: "100vh", width: "100vw" }, children: workspaceGate });
  }
  return /* @__PURE__ */ jsx35(BottomStripProvider, { children: /* @__PURE__ */ jsxs21(
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
        /* @__PURE__ */ jsxs21(
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
              /* @__PURE__ */ jsx35(
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
              footer !== void 0 ? footer : !disableBottomStrip && /* @__PURE__ */ jsx35(BottomStrip, { ...bottomStripProps })
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
import { jsx as jsx36, jsxs as jsxs22 } from "react/jsx-runtime";
var HeaderBar = forwardRef26(({
  title,
  nav,
  actions,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsxs22("header", { ref, className: `skipo-header ${className}`, ...props, children: [
    /* @__PURE__ */ jsxs22("div", { style: { display: "flex", alignItems: "center", gap: "16px" }, children: [
      title && /* @__PURE__ */ jsx36("strong", { children: title }),
      nav
    ] }),
    actions && /* @__PURE__ */ jsx36("div", { children: actions })
  ] });
});
HeaderBar.displayName = "HeaderBar";

// src/components/layout/BreadcrumbNav.tsx
import React31, { forwardRef as forwardRef27 } from "react";
import { jsx as jsx37, jsxs as jsxs23 } from "react/jsx-runtime";
var BreadcrumbNav = forwardRef27(({
  paths,
  className = "",
  ...props
}, ref) => {
  return /* @__PURE__ */ jsx37("nav", { ref, className: `skipo-breadcrumb ${className}`, ...props, children: paths.map((p, i) => /* @__PURE__ */ jsxs23(React31.Fragment, { children: [
    p.href ? /* @__PURE__ */ jsx37("a", { href: p.href, children: p.label }) : /* @__PURE__ */ jsx37("span", { children: p.label }),
    i < paths.length - 1 && /* @__PURE__ */ jsx37("span", { children: "/" })
  ] }, i)) });
});
BreadcrumbNav.displayName = "BreadcrumbNav";

// src/components/layout/TopToolbar.tsx
import { forwardRef as forwardRef28 } from "react";
import { jsx as jsx38, jsxs as jsxs24 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs24(
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
        /* @__PURE__ */ jsxs24(
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
              title && /* @__PURE__ */ jsx38("span", { className: "skipo-top-toolbar__title", children: title })
            ]
          }
        ),
        tabs.length > 0 && /* @__PURE__ */ jsx38(
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
              return /* @__PURE__ */ jsx38(BaseTooltip, { content: `SWITCH VIEW: ${tab.label.toUpperCase()}`, children: /* @__PURE__ */ jsxs24(
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
                    /* @__PURE__ */ jsx38("span", { children: tab.label })
                  ]
                }
              ) }, tab.id);
            })
          }
        ),
        actions && /* @__PURE__ */ jsx38(
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

// src/components/settings/ThemeSettingsSection.tsx
import { jsx as jsx39, jsxs as jsxs25 } from "react/jsx-runtime";
var AVAILABLE_PACKS = [
  { id: "skipo-dark-neo", name: "Dark Neo", mode: "dark", pack: DEFAULT_DARK_THEME_PACK },
  { id: "skipo-light-neo", name: "Light Neo", mode: "light", pack: DEFAULT_LIGHT_THEME_PACK }
];
var ACCENT_COLORS = [
  { name: "Gold", value: "#d4af37" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Emerald", value: "#10b981" },
  { name: "Cyan", value: "#00d9ff" },
  { name: "Purple", value: "#a855f7" }
];
var ThemeSettingsSection = () => {
  const { theme, themePack, setTheme, setThemePack } = useSkipoTheme();
  const handleAccentChange = (hex) => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--skipo-accent", hex);
      document.documentElement.style.setProperty("--skipo-accent-glow", `0 0 14px ${hex}66`);
    }
  };
  return /* @__PURE__ */ jsxs25(
    BaseCard,
    {
      variant: "surface",
      depth: "sm",
      style: {
        padding: "16px",
        border: "1px solid var(--skipo-border-color, #333)",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      },
      children: [
        /* @__PURE__ */ jsxs25("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
          /* @__PURE__ */ jsxs25("div", { children: [
            /* @__PURE__ */ jsx39("h3", { style: { margin: 0, fontSize: "13px", fontWeight: 800, textTransform: "uppercase", color: "var(--skipo-text)" }, children: "Appearance & Theming" }),
            /* @__PURE__ */ jsx39("p", { style: { margin: "2px 0 0", fontSize: "11px", color: "var(--skipo-text-muted)" }, children: "Configure theme packs, display mode, and custom accent highlights." })
          ] }),
          /* @__PURE__ */ jsxs25(BaseBadge, { variant: "neutral", style: { fontSize: "10px" }, children: [
            theme.toUpperCase(),
            " MODE"
          ] })
        ] }),
        /* @__PURE__ */ jsxs25("div", { children: [
          /* @__PURE__ */ jsx39("label", { style: { display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "6px", color: "var(--skipo-text)" }, children: "Color Mode" }),
          /* @__PURE__ */ jsxs25("div", { style: { display: "flex", gap: "8px" }, children: [
            /* @__PURE__ */ jsx39(
              BaseButton,
              {
                size: "sm",
                variant: theme === "dark" ? "accent" : "secondary",
                onClick: () => setTheme("dark"),
                type: "button",
                children: "Dark Mode"
              }
            ),
            /* @__PURE__ */ jsx39(
              BaseButton,
              {
                size: "sm",
                variant: theme === "light" ? "accent" : "secondary",
                onClick: () => setTheme("light"),
                type: "button",
                children: "Light Mode"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs25("div", { children: [
          /* @__PURE__ */ jsx39("label", { style: { display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "6px", color: "var(--skipo-text)" }, children: "Theme Pack Preset" }),
          /* @__PURE__ */ jsx39("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px" }, children: AVAILABLE_PACKS.map((p) => {
            const isSelected = themePack?.metadata?.id === p.id;
            return /* @__PURE__ */ jsxs25(
              "div",
              {
                onClick: () => setThemePack(p.pack),
                style: {
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: isSelected ? "2px solid var(--skipo-accent, #d4af37)" : "1px solid var(--skipo-border-color, #444)",
                  backgroundColor: isSelected ? "rgba(212, 175, 55, 0.12)" : "var(--skipo-bg, #16181d)",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                },
                children: [
                  /* @__PURE__ */ jsx39("div", { style: { fontSize: "11px", fontWeight: 700, color: isSelected ? "var(--skipo-accent)" : "var(--skipo-text)" }, children: p.name }),
                  /* @__PURE__ */ jsxs25("div", { style: { fontSize: "9px", color: "var(--skipo-text-muted)", textTransform: "capitalize" }, children: [
                    p.mode,
                    " Preset"
                  ] })
                ]
              },
              p.id
            );
          }) })
        ] }),
        /* @__PURE__ */ jsxs25("div", { children: [
          /* @__PURE__ */ jsx39("label", { style: { display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "6px", color: "var(--skipo-text)" }, children: "Accent Highlight" }),
          /* @__PURE__ */ jsx39("div", { style: { display: "flex", gap: "8px", alignItems: "center" }, children: ACCENT_COLORS.map((c) => /* @__PURE__ */ jsx39(
            "button",
            {
              type: "button",
              title: c.name,
              "aria-label": c.name,
              onClick: () => handleAccentChange(c.value),
              style: {
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                backgroundColor: c.value,
                border: "2px solid rgba(255, 255, 255, 0.8)",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.4)",
                transition: "transform 0.1s ease"
              }
            },
            c.name
          )) })
        ] })
      ]
    }
  );
};
ThemeSettingsSection.displayName = "ThemeSettingsSection";

// src/components/settings/SettingsTab.tsx
import { useState as useState12 } from "react";
import { jsx as jsx40, jsxs as jsxs26 } from "react/jsx-runtime";
var SettingsTab = ({
  appName = "Skipo Application",
  version = "1.0.0",
  systemLogs = [
    "System initialization verified.",
    "Theme engine loaded default tokens.",
    "Ready for user operations."
  ],
  activeWorkspaceName = "Default Workspace",
  onResetDefaults
}) => {
  const [resetStatus, setResetStatus] = useState12(false);
  const handleReset = () => {
    if (onResetDefaults) onResetDefaults();
    setResetStatus(true);
    setTimeout(() => setResetStatus(false), 2e3);
  };
  return /* @__PURE__ */ jsxs26(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "24px",
        maxWidth: "840px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box"
      },
      children: [
        /* @__PURE__ */ jsxs26("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--skipo-border-color, #333)", paddingBottom: "12px" }, children: [
          /* @__PURE__ */ jsxs26("div", { children: [
            /* @__PURE__ */ jsx40("h2", { style: { margin: 0, fontSize: "18px", fontWeight: 900, textTransform: "uppercase", color: "var(--skipo-text)" }, children: "Application Settings" }),
            /* @__PURE__ */ jsx40("p", { style: { margin: "4px 0 0", fontSize: "12px", color: "var(--skipo-text-muted)" }, children: "Manage appearance themes, workspace diagnostics, and runtime telemetry." })
          ] }),
          /* @__PURE__ */ jsxs26("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
            /* @__PURE__ */ jsxs26(BaseBadge, { variant: "neutral", children: [
              "v",
              version
            ] }),
            /* @__PURE__ */ jsx40(BaseButton, { size: "sm", variant: resetStatus ? "success" : "secondary", onClick: handleReset, type: "button", children: resetStatus ? "Reset Done" : "Reset Defaults" })
          ] })
        ] }),
        /* @__PURE__ */ jsx40(ThemeSettingsSection, {}),
        /* @__PURE__ */ jsxs26(
          BaseCard,
          {
            variant: "surface",
            depth: "sm",
            style: {
              padding: "16px",
              border: "1px solid var(--skipo-border-color, #333)",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            },
            children: [
              /* @__PURE__ */ jsxs26("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
                /* @__PURE__ */ jsx40("h3", { style: { margin: 0, fontSize: "13px", fontWeight: 800, textTransform: "uppercase", color: "var(--skipo-text)" }, children: "Workspace & Runtime" }),
                /* @__PURE__ */ jsx40(BaseBadge, { variant: "success", children: "ONLINE" })
              ] }),
              /* @__PURE__ */ jsxs26("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "11px" }, children: [
                /* @__PURE__ */ jsxs26("div", { style: { padding: "8px 10px", backgroundColor: "var(--skipo-bg, #16181d)", borderRadius: "4px", border: "1px solid var(--skipo-border-color, #333)" }, children: [
                  /* @__PURE__ */ jsx40("span", { style: { color: "var(--skipo-text-muted)", display: "block", marginBottom: "2px" }, children: "App Target" }),
                  /* @__PURE__ */ jsx40("span", { style: { fontWeight: 700, color: "var(--skipo-text)" }, children: appName })
                ] }),
                /* @__PURE__ */ jsxs26("div", { style: { padding: "8px 10px", backgroundColor: "var(--skipo-bg, #16181d)", borderRadius: "4px", border: "1px solid var(--skipo-border-color, #333)" }, children: [
                  /* @__PURE__ */ jsx40("span", { style: { color: "var(--skipo-text-muted)", display: "block", marginBottom: "2px" }, children: "Active Context" }),
                  /* @__PURE__ */ jsx40("span", { style: { fontWeight: 700, color: "var(--skipo-accent, #d4af37)" }, children: activeWorkspaceName })
                ] })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ jsx40("div", { children: /* @__PURE__ */ jsx40(
          CopyableLogViewer,
          {
            title: "Runtime Event Logs",
            logs: systemLogs,
            maxHeight: "160px"
          }
        ) })
      ]
    }
  );
};
SettingsTab.displayName = "SettingsTab";

// src/components/auth/LoginModal.tsx
import { useState as useState13 } from "react";
import { ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { jsx as jsx41, jsxs as jsxs27 } from "react/jsx-runtime";
var LoginModal = ({
  appName = "Ecosystem App",
  onSuccess,
  defaultEmail = ""
}) => {
  const [email, setEmail] = useState13(defaultEmail);
  const [password, setPassword] = useState13("");
  const [isRegister, setIsRegister] = useState13(false);
  const [name, setName] = useState13("");
  const [loading, setLoading] = useState13(false);
  const [error, setError] = useState13(null);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegister ? { email, password, name } : { email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.user) {
        throw new Error(data.error || "Authentication failed. Please verify credentials.");
      }
      const token = data.token || `usr_${Date.now()}`;
      if (typeof window !== "undefined") {
        localStorage.setItem("skipo_auth_token", token);
        localStorage.setItem("skipo_user", JSON.stringify(data.user));
      }
      onSuccess(data.user, token);
    } catch (err) {
      setError(err.message || "Server error. Authentication failed.");
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ jsx41(
    "div",
    {
      className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs font-mono p-4",
      onWheel: (e) => e.stopPropagation(),
      onPointerDown: (e) => e.stopPropagation(),
      children: /* @__PURE__ */ jsxs27("div", { className: "w-full max-w-md p-6 border-2 border-[var(--skipo-border-color)] bg-[var(--skipo-surface)] text-[var(--skipo-text)] shadow-2xl rounded-lg space-y-4", children: [
        /* @__PURE__ */ jsxs27("div", { className: "flex items-center justify-between pb-3 border-b border-[var(--skipo-border-color)]", children: [
          /* @__PURE__ */ jsxs27("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx41("div", { className: "w-7 h-7 bg-[var(--skipo-accent)] text-black font-black flex items-center justify-center text-xs rounded", children: "\u25B2" }),
            /* @__PURE__ */ jsxs27("span", { className: "font-black text-sm tracking-wider uppercase text-[var(--skipo-text)]", children: [
              appName,
              " Authentication"
            ] })
          ] }),
          /* @__PURE__ */ jsxs27("span", { className: "text-[9px] px-2 py-0.5 border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-bold rounded flex items-center gap-1", children: [
            /* @__PURE__ */ jsx41(ShieldCheck, { size: 10 }),
            " SYSTEM DB"
          ] })
        ] }),
        error && /* @__PURE__ */ jsxs27("div", { className: "p-3 border border-red-500/60 bg-red-500/10 text-red-300 text-xs rounded flex items-start gap-2", children: [
          /* @__PURE__ */ jsx41(AlertCircle, { size: 14, className: "shrink-0 mt-0.5" }),
          /* @__PURE__ */ jsx41("span", { children: error })
        ] }),
        /* @__PURE__ */ jsxs27("form", { onSubmit: handleSubmit, className: "space-y-3", children: [
          isRegister && /* @__PURE__ */ jsxs27("div", { children: [
            /* @__PURE__ */ jsx41("label", { className: "block text-[10px] font-black uppercase mb-1", children: "Full Name *" }),
            /* @__PURE__ */ jsx41(
              BaseInput,
              {
                type: "text",
                value: name,
                onChange: (e) => setName(e.target.value),
                placeholder: "Developer Name",
                required: isRegister
              }
            )
          ] }),
          /* @__PURE__ */ jsxs27("div", { children: [
            /* @__PURE__ */ jsx41("label", { className: "block text-[10px] font-black uppercase mb-1", children: "Email Address *" }),
            /* @__PURE__ */ jsx41(
              BaseInput,
              {
                type: "email",
                value: email,
                onChange: (e) => setEmail(e.target.value),
                placeholder: "user@example.com",
                required: true
              }
            )
          ] }),
          /* @__PURE__ */ jsxs27("div", { children: [
            /* @__PURE__ */ jsx41("label", { className: "block text-[10px] font-black uppercase mb-1", children: "Password *" }),
            /* @__PURE__ */ jsx41(
              BaseInput,
              {
                type: "password",
                value: password,
                onChange: (e) => setPassword(e.target.value),
                placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
                required: true
              }
            )
          ] }),
          /* @__PURE__ */ jsx41("div", { className: "pt-2", children: /* @__PURE__ */ jsxs27(
            BaseButton,
            {
              variant: "accent",
              size: "md",
              type: "submit",
              disabled: loading,
              className: "w-full flex items-center justify-center gap-2",
              children: [
                /* @__PURE__ */ jsx41("span", { children: loading ? "AUTHENTICATING..." : isRegister ? "REGISTER & ENTER" : "SIGN IN" }),
                /* @__PURE__ */ jsx41(ArrowRight, { size: 14 })
              ]
            }
          ) })
        ] }),
        /* @__PURE__ */ jsxs27("div", { className: "pt-2 border-t border-[var(--skipo-border-color)]/60 flex items-center justify-between text-[11px]", children: [
          /* @__PURE__ */ jsx41(
            "button",
            {
              type: "button",
              onClick: () => {
                setIsRegister(!isRegister);
                setError(null);
              },
              className: "text-[var(--skipo-accent)] hover:underline cursor-pointer",
              children: isRegister ? "Already have an account? Sign In" : "Create new account"
            }
          ),
          /* @__PURE__ */ jsx41("span", { className: "text-[10px] text-[var(--skipo-text-muted)]", children: "ULTRST Identity" })
        ] })
      ] })
    }
  );
};

// src/components/workspace/StoragePresetTile.tsx
import { HardDrive, CheckCircle2 } from "lucide-react";
import { jsx as jsx42, jsxs as jsxs28 } from "react/jsx-runtime";
var StoragePresetTile = ({ conn, isSelected, onSelect }) => {
  return /* @__PURE__ */ jsxs28(
    "div",
    {
      onClick: () => onSelect(conn),
      className: `p-3 border-2 rounded transition-all font-mono select-none cursor-pointer flex items-center justify-between ${isSelected ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "border-[var(--skipo-border-color)] bg-[var(--skipo-bg)] hover:border-emerald-500/60"}`,
      children: [
        /* @__PURE__ */ jsxs28("div", { className: "flex items-center gap-2.5", children: [
          /* @__PURE__ */ jsx42("div", { className: `p-1.5 rounded border ${isSelected ? "bg-emerald-500 text-black border-emerald-500" : "bg-[var(--skipo-surface)] text-emerald-400 border-[var(--skipo-border-color)]"}`, children: /* @__PURE__ */ jsx42(HardDrive, { size: 16 }) }),
          /* @__PURE__ */ jsxs28("div", { children: [
            /* @__PURE__ */ jsx42("span", { className: "text-xs font-black uppercase text-[var(--skipo-text)] block", children: conn.label || conn.localFolderName || "Local Workstation Vault" }),
            /* @__PURE__ */ jsxs28("span", { className: "text-[10px] text-[var(--skipo-text-muted)] block", children: [
              "Directory: ./",
              conn.localFolderName || "workspace",
              " (Deterministic local storage)"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx42("div", { className: "flex items-center gap-1.5", children: isSelected && /* @__PURE__ */ jsxs28("span", { className: "text-[9px] font-black uppercase px-2 py-0.5 border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 rounded flex items-center gap-1", children: [
          /* @__PURE__ */ jsx42(CheckCircle2, { size: 10 }),
          " SELECTED"
        ] }) })
      ]
    }
  );
};

// src/components/workspace/SrklBackblazeTile.tsx
import { useState as useState14, useEffect as useEffect7 } from "react";
import { Cloud, CheckCircle2 as CheckCircle22, RefreshCw } from "lucide-react";
import { jsx as jsx43, jsxs as jsxs29 } from "react/jsx-runtime";
var SrklBackblazeTile = ({
  account,
  selectedBucketName,
  isSelectedAccount,
  onSelectBucket,
  userId
}) => {
  const [buckets, setBuckets] = useState14([]);
  const [loading, setLoading] = useState14(false);
  const fetchBuckets = async () => {
    setLoading(true);
    try {
      const creds = account.credentials || account.metadata?.credentials || {};
      const keyId = creds.keyId || creds.b2KeyId || "";
      const applicationKey = creds.applicationKey || creds.b2ApplicationKey || "";
      const defaultBucket = creds.bucketName || "ultrst-apps";
      const res = await fetch("/api/srkl/backblaze/buckets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId, applicationKey, userId, bucketName: defaultBucket })
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && Array.isArray(data.buckets)) {
        setBuckets(data.buckets);
      } else {
        setBuckets([{ bucketId: "default", bucketName: defaultBucket }]);
      }
    } catch {
      setBuckets([{ bucketId: "default", bucketName: "ultrst-apps" }]);
    } finally {
      setLoading(false);
    }
  };
  useEffect7(() => {
    fetchBuckets();
  }, [account.id]);
  return /* @__PURE__ */ jsxs29("div", { className: `p-3 border-2 rounded transition-all font-mono select-none ${isSelectedAccount ? "border-amber-400 bg-amber-400/10 shadow-[0_0_15px_rgba(251,191,36,0.2)]" : "border-[var(--skipo-border-color)] bg-[var(--skipo-bg)] hover:border-amber-400/60"}`, children: [
    /* @__PURE__ */ jsxs29("div", { className: "flex items-center justify-between pb-2 border-b border-[var(--skipo-border-color)]/60", children: [
      /* @__PURE__ */ jsxs29("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx43(Cloud, { size: 16, className: "text-amber-400" }),
        /* @__PURE__ */ jsx43("span", { className: "text-xs font-black uppercase text-[var(--skipo-text)] truncate max-w-[180px]", children: account.name })
      ] }),
      /* @__PURE__ */ jsx43(
        "button",
        {
          type: "button",
          onClick: fetchBuckets,
          disabled: loading,
          className: "p-1 text-[var(--skipo-text-muted)] hover:text-amber-300 rounded cursor-pointer",
          title: "Refresh buckets",
          children: /* @__PURE__ */ jsx43(RefreshCw, { size: 11, className: loading ? "animate-spin text-amber-400" : "" })
        }
      )
    ] }),
    /* @__PURE__ */ jsxs29("div", { className: "mt-2 space-y-1.5", children: [
      /* @__PURE__ */ jsx43("span", { className: "text-[9px] font-bold uppercase text-[var(--skipo-text-muted)] block", children: "Select Target B2 Bucket:" }),
      /* @__PURE__ */ jsx43("div", { className: "flex flex-wrap gap-1.5", children: buckets.map((b) => {
        const bName = b.bucketName || b.name || "ultrst-apps";
        const isSelected = isSelectedAccount && selectedBucketName === bName;
        return /* @__PURE__ */ jsxs29(
          "button",
          {
            type: "button",
            onClick: () => onSelectBucket(account, bName),
            className: `px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 border transition-all cursor-pointer ${isSelected ? "border-amber-400 bg-amber-400 text-black shadow-sm font-black" : "border-[var(--skipo-border-color)] bg-[var(--skipo-surface)] hover:border-amber-400/80 text-[var(--skipo-text)]"}`,
            children: [
              isSelected && /* @__PURE__ */ jsx43(CheckCircle22, { size: 10 }),
              /* @__PURE__ */ jsx43("span", { children: bName })
            ]
          },
          b.bucketId || bName
        );
      }) })
    ] })
  ] });
};

// src/components/workspace/StorageOptionTiles.tsx
import { useState as useState15, useEffect as useEffect8, useCallback as useCallback5 } from "react";
import { HardDrive as HardDrive2, Cloud as Cloud2, RefreshCw as RefreshCw2 } from "lucide-react";
import { jsx as jsx44, jsxs as jsxs30 } from "react/jsx-runtime";
var StorageOptionTiles = ({
  currentUser,
  selectedConnectionId,
  onSelectStorage
}) => {
  const [activeId, setActiveId] = useState15(selectedConnectionId || "local_default");
  const [selectedBucket, setSelectedBucket] = useState15("");
  const [srklAccounts, setSrklAccounts] = useState15([]);
  const [loadingSrkl, setLoadingSrkl] = useState15(false);
  const fetchSrklAccounts = useCallback5(async () => {
    if (!currentUser?.id) return;
    setLoadingSrkl(true);
    try {
      const uId = encodeURIComponent(currentUser.id);
      const res = await fetch(`/api/srkl/accounts?service=backblaze&userId=${uId}`);
      const data = await res.json().catch(() => ({}));
      if (data.success && Array.isArray(data.accounts)) {
        setSrklAccounts(data.accounts);
      }
    } catch {
    } finally {
      setLoadingSrkl(false);
    }
  }, [currentUser?.id]);
  useEffect8(() => {
    fetchSrklAccounts();
  }, [fetchSrklAccounts]);
  const handleSelectLocal = (conn) => {
    setActiveId(conn.id);
    setSelectedBucket("");
    onSelectStorage({
      provider: "local_fs",
      connectionId: conn.id,
      localFolderName: conn.localFolderName || "Local-Vault",
      localFolderKey: conn.localFolderKey
    });
  };
  const handleSelectSrklBucket = (account, bucketName) => {
    setActiveId(account.id);
    setSelectedBucket(bucketName);
    const creds = account.credentials || {};
    onSelectStorage({
      provider: "backblaze_b2",
      connectionId: account.id,
      b2BucketName: bucketName,
      b2Endpoint: creds.endpoint,
      b2Region: creds.region || "us-east-005"
    });
  };
  const defaultLocalConn = {
    id: "local_default",
    label: "Local Workstation Vault",
    localFolderName: "Local-Vault",
    provider: "local_fs"
  };
  return /* @__PURE__ */ jsxs30("div", { className: "space-y-4 font-mono select-none", children: [
    /* @__PURE__ */ jsxs30("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxs30("span", { className: "text-[9px] font-black uppercase text-[var(--skipo-text-muted)] flex items-center gap-1", children: [
        /* @__PURE__ */ jsx44(HardDrive2, { size: 11 }),
        " 1. Local Filesystem (Workstation Vault)"
      ] }),
      /* @__PURE__ */ jsx44(
        StoragePresetTile,
        {
          conn: defaultLocalConn,
          isSelected: activeId === defaultLocalConn.id && !selectedBucket,
          onSelect: handleSelectLocal
        }
      )
    ] }),
    /* @__PURE__ */ jsxs30("div", { className: "space-y-2 pt-1 border-t border-[var(--skipo-border-color)]/60", children: [
      /* @__PURE__ */ jsxs30("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxs30("span", { className: "text-[9px] font-black uppercase text-amber-300 flex items-center gap-1", children: [
          /* @__PURE__ */ jsx44(Cloud2, { size: 11 }),
          " 2. Backblaze B2 (Federated from SRKL)"
        ] }),
        /* @__PURE__ */ jsx44(
          "button",
          {
            type: "button",
            onClick: fetchSrklAccounts,
            disabled: loadingSrkl,
            className: "p-1 rounded text-[var(--skipo-text-muted)] hover:text-amber-300 cursor-pointer",
            title: "Refresh SRKL Accounts",
            children: /* @__PURE__ */ jsx44(RefreshCw2, { size: 11, className: loadingSrkl ? "animate-spin text-amber-300" : "" })
          }
        )
      ] }),
      srklAccounts.length === 0 && !loadingSrkl && /* @__PURE__ */ jsx44("div", { className: "p-3 border border-dashed border-[var(--skipo-border-color)] text-[11px] text-[var(--skipo-text-muted)] rounded", children: "No Backblaze B2 accounts linked in your SRKL profile. Configure Backblaze in SRKL to pick buckets here." }),
      srklAccounts.map((account) => /* @__PURE__ */ jsx44(
        SrklBackblazeTile,
        {
          account,
          selectedBucketName: selectedBucket,
          isSelectedAccount: account.id === activeId,
          onSelectBucket: handleSelectSrklBucket,
          userId: currentUser?.id
        },
        account.id
      ))
    ] })
  ] });
};

// src/components/workspace/WorkspaceStorageReadonlyPanel.tsx
import { useState as useState16 } from "react";
import { Lock, Cloud as Cloud3, HardDrive as HardDrive3, ShieldCheck as ShieldCheck2, Copy, Check } from "lucide-react";
import { jsx as jsx45, jsxs as jsxs31 } from "react/jsx-runtime";
var WorkspaceStorageReadonlyPanel = ({ workspace }) => {
  const [copied, setCopied] = useState16(false);
  const isB2 = workspace.storageProvider === "backblaze_b2";
  const target = isB2 ? workspace.b2BucketName || "ultrst-apps" : workspace.localFolderName || workspace.name;
  const handleCopy = () => {
    navigator.clipboard?.writeText(target);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  };
  return /* @__PURE__ */ jsxs31("div", { className: "space-y-3 font-mono select-none", children: [
    /* @__PURE__ */ jsxs31("div", { className: "flex items-center justify-between pb-1 border-b border-[var(--skipo-border-color)]", children: [
      /* @__PURE__ */ jsxs31("span", { className: "text-[10px] font-black uppercase text-[var(--skipo-text)] flex items-center gap-1.5", children: [
        /* @__PURE__ */ jsx45(Lock, { size: 12, className: "text-amber-400" }),
        /* @__PURE__ */ jsx45("span", { children: "CONNECTED STORAGE VAULT" })
      ] }),
      /* @__PURE__ */ jsx45("span", { className: "text-[9px] px-2 py-0.5 border border-amber-500/50 bg-amber-500/10 text-amber-300 font-bold rounded", children: "READ ONLY \xB7 LOCKED PRIMARY" })
    ] }),
    /* @__PURE__ */ jsxs31("div", { className: "p-3.5 border-2 border-[var(--skipo-border-color)] bg-[var(--skipo-bg)] rounded-lg space-y-2.5", children: [
      /* @__PURE__ */ jsxs31("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxs31("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx45("div", { className: "p-2 rounded border border-[var(--skipo-border-color)] bg-[var(--skipo-surface)] text-[var(--skipo-accent)]", children: isB2 ? /* @__PURE__ */ jsx45(Cloud3, { size: 18, className: "text-amber-400" }) : /* @__PURE__ */ jsx45(HardDrive3, { size: 18 }) }),
          /* @__PURE__ */ jsxs31("div", { children: [
            /* @__PURE__ */ jsx45("span", { className: "text-xs font-black uppercase text-[var(--skipo-text)] block", children: isB2 ? "Backblaze B2 Cloud Vault" : "Local Workstation Vault" }),
            /* @__PURE__ */ jsxs31("span", { className: "text-[10px] text-[var(--skipo-text-muted)] block", children: [
              "Target: ",
              target
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs31(
          "button",
          {
            type: "button",
            onClick: handleCopy,
            className: "px-2 py-1 text-[10px] border border-[var(--skipo-border-color)] bg-[var(--skipo-surface)] hover:border-[var(--skipo-accent)] text-[var(--skipo-text)] rounded flex items-center gap-1 cursor-pointer",
            title: "Copy target",
            children: [
              copied ? /* @__PURE__ */ jsx45(Check, { size: 11, className: "text-emerald-400" }) : /* @__PURE__ */ jsx45(Copy, { size: 11 }),
              /* @__PURE__ */ jsx45("span", { children: copied ? "COPIED" : "COPY" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs31("div", { className: "border border-[var(--skipo-border-color)]/70 rounded bg-[var(--skipo-surface)] divide-y divide-[var(--skipo-border-color)]/60 text-[10px]", children: [
        /* @__PURE__ */ jsxs31("div", { className: "px-3 py-1.5 flex justify-between", children: [
          /* @__PURE__ */ jsx45("span", { className: "text-[var(--skipo-text-muted)]", children: "Storage Provider:" }),
          /* @__PURE__ */ jsx45("span", { className: "font-bold text-white uppercase font-mono", children: workspace.storageProvider || "local_fs" })
        ] }),
        /* @__PURE__ */ jsxs31("div", { className: "px-3 py-1.5 flex justify-between", children: [
          /* @__PURE__ */ jsx45("span", { className: "text-[var(--skipo-text-muted)]", children: "Canonical Vault Path:" }),
          /* @__PURE__ */ jsx45("span", { className: "font-mono text-emerald-400 truncate max-w-[240px]", children: workspace.workspacePath || target })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs31("div", { className: "p-2.5 border border-dashed border-[var(--skipo-border-color)] bg-[var(--skipo-surface)]/50 rounded text-[10px] text-[var(--skipo-text-muted)] leading-relaxed space-y-1", children: [
      /* @__PURE__ */ jsxs31("div", { className: "flex items-center gap-1 text-[var(--skipo-text)] font-bold", children: [
        /* @__PURE__ */ jsx45(ShieldCheck2, { size: 12, className: "text-emerald-400" }),
        /* @__PURE__ */ jsx45("span", { children: "Storage Immutability Protocol:" })
      ] }),
      /* @__PURE__ */ jsx45("p", { children: "Primary storage cannot be mutated post-creation. Add secondary redundant clones below to replicate and back up files across cloud buckets and local disks." })
    ] })
  ] });
};

// src/components/workspace/WorkspaceSecondaryClonesPanel.tsx
import { useState as useState17 } from "react";
import { RefreshCw as RefreshCw3, Trash2, Plus, ShieldCheck as ShieldCheck3, Cloud as Cloud4, HardDrive as HardDrive4 } from "lucide-react";
import { jsx as jsx46, jsxs as jsxs32 } from "react/jsx-runtime";
var WorkspaceSecondaryClonesPanel = ({ workspace, onClonesUpdated, onClose }) => {
  const [clones, setClones] = useState17(workspace.secondaryClones || []);
  const [syncing, setSyncing] = useState17(null);
  const [addingClone, setAddingClone] = useState17(false);
  const [newLabel, setNewLabel] = useState17("");
  const [newBucket, setNewBucket] = useState17("");
  const [newProvider, setNewProvider] = useState17("backblaze_b2");
  const [statusMsg, setStatusMsg] = useState17(null);
  const handleSync = async (cloneId) => {
    setSyncing(cloneId || "all");
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/sync-clones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloneIds: cloneId ? [cloneId] : void 0 })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Replication failed");
      setStatusMsg(`\u2713 Replicated ${data.totalFilesSynced} files.`);
      onClonesUpdated?.();
    } catch (err) {
      setStatusMsg(`\u26A0 Error: ${err.message}`);
    } finally {
      setSyncing(null);
    }
  };
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/clones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newLabel.trim(),
          provider: newProvider,
          b2BucketName: newProvider === "backblaze_b2" ? newBucket.trim() || "ultrst-apps" : void 0,
          localFolderName: newProvider === "local_fs" ? newLabel.trim() : void 0
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setClones(data.clones || []);
      setAddingClone(false);
      setNewLabel("");
      setNewBucket("");
      onClonesUpdated?.();
    } catch (err) {
      setStatusMsg(`\u26A0 Error: ${err.message}`);
    }
  };
  const handleDelete = async (cloneId) => {
    if (!confirm("Remove this secondary clone?")) return;
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/clones/${encodeURIComponent(cloneId)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setClones(data.clones || []);
      onClonesUpdated?.();
    } catch (err) {
      setStatusMsg(`\u26A0 Error: ${err.message}`);
    }
  };
  return /* @__PURE__ */ jsxs32("div", { className: "space-y-3 font-mono pt-3 border-t border-[var(--skipo-border-color)]", children: [
    /* @__PURE__ */ jsxs32("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs32("div", { className: "flex items-center gap-1.5", children: [
        /* @__PURE__ */ jsx46(ShieldCheck3, { size: 14, className: "text-sky-400" }),
        /* @__PURE__ */ jsxs32("span", { className: "text-[11px] font-black uppercase text-[var(--skipo-text)]", children: [
          "CLONES (",
          clones.length,
          ")"
        ] })
      ] }),
      /* @__PURE__ */ jsxs32("div", { className: "flex items-center gap-2", children: [
        clones.length > 0 && /* @__PURE__ */ jsxs32("button", { type: "button", disabled: Boolean(syncing), onClick: () => handleSync(), className: "px-2 py-1 text-[9px] font-bold border border-sky-500/50 bg-sky-500/20 text-sky-300 rounded flex items-center gap-1", children: [
          /* @__PURE__ */ jsx46(RefreshCw3, { size: 10, className: syncing === "all" ? "animate-spin" : "" }),
          " SYNC ALL"
        ] }),
        /* @__PURE__ */ jsxs32("button", { type: "button", onClick: () => setAddingClone(!addingClone), className: "px-2 py-1 text-[9px] font-bold border rounded flex items-center gap-1", children: [
          /* @__PURE__ */ jsx46(Plus, { size: 10 }),
          " ADD"
        ] }),
        onClose && /* @__PURE__ */ jsx46("button", { type: "button", onClick: onClose, className: "px-2 py-1 text-[9px] border rounded", children: "BACK" })
      ] })
    ] }),
    statusMsg && /* @__PURE__ */ jsx46("div", { className: "p-2 border border-sky-500/40 bg-sky-950/20 text-[10px] text-sky-200 rounded", children: statusMsg }),
    clones.length > 0 ? /* @__PURE__ */ jsx46("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-2", children: clones.map((c) => /* @__PURE__ */ jsxs32("div", { className: "p-2 border border-sky-500/30 rounded flex flex-col justify-between", children: [
      /* @__PURE__ */ jsxs32("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxs32("span", { className: "text-[11px] font-bold flex items-center gap-1", children: [
          c.provider === "backblaze_b2" ? /* @__PURE__ */ jsx46(Cloud4, { size: 11, className: "text-amber-400" }) : /* @__PURE__ */ jsx46(HardDrive4, { size: 11, className: "text-emerald-400" }),
          " ",
          c.label
        ] }),
        /* @__PURE__ */ jsx46("button", { type: "button", onClick: () => handleDelete(c.id), className: "text-red-400 p-1", children: /* @__PURE__ */ jsx46(Trash2, { size: 10 }) })
      ] }),
      /* @__PURE__ */ jsxs32("div", { className: "text-[9px] text-[var(--skipo-text-muted)] truncate", children: [
        "Target: ",
        c.b2BucketName || c.localFolderName || "Backup"
      ] }),
      /* @__PURE__ */ jsxs32("div", { className: "pt-1 flex items-center justify-between", children: [
        /* @__PURE__ */ jsx46("span", { className: "text-[8px] font-bold uppercase text-sky-300", children: c.status || "CONNECTED" }),
        /* @__PURE__ */ jsxs32("button", { type: "button", disabled: Boolean(syncing), onClick: () => handleSync(c.id), className: "px-2 py-0.5 text-[9px] border rounded", children: [
          /* @__PURE__ */ jsx46(RefreshCw3, { size: 9, className: syncing === c.id ? "animate-spin" : "" }),
          " SYNC"
        ] })
      ] })
    ] }, c.id)) }) : /* @__PURE__ */ jsx46("div", { className: "p-2 border border-dashed text-[10px] text-center text-[var(--skipo-text-muted)]", children: "No secondary clones configured." }),
    addingClone && /* @__PURE__ */ jsxs32("form", { onSubmit: handleAdd, className: "p-3 border rounded space-y-2", children: [
      /* @__PURE__ */ jsx46("input", { type: "text", required: true, value: newLabel, onChange: (e) => setNewLabel(e.target.value), placeholder: "Clone Label", className: "w-full border rounded px-2 py-1 text-xs bg-transparent" }),
      /* @__PURE__ */ jsxs32("select", { value: newProvider, onChange: (e) => setNewProvider(e.target.value), className: "w-full border rounded px-2 py-1 text-xs bg-transparent", children: [
        /* @__PURE__ */ jsx46("option", { value: "backblaze_b2", children: "Backblaze B2" }),
        /* @__PURE__ */ jsx46("option", { value: "local_fs", children: "Local Disk Folder" })
      ] }),
      newProvider === "backblaze_b2" && /* @__PURE__ */ jsx46("input", { type: "text", value: newBucket, onChange: (e) => setNewBucket(e.target.value), placeholder: "Bucket Name", className: "w-full border rounded px-2 py-1 text-xs bg-transparent" }),
      /* @__PURE__ */ jsxs32("div", { className: "flex justify-end gap-2", children: [
        /* @__PURE__ */ jsx46("button", { type: "button", onClick: () => setAddingClone(false), className: "px-2 py-1 text-[9px] border rounded", children: "CANCEL" }),
        /* @__PURE__ */ jsx46("button", { type: "submit", className: "px-2 py-1 text-[9px] font-bold bg-sky-500 text-black rounded", children: "SAVE" })
      ] })
    ] })
  ] });
};

// src/components/workspace/WorkspaceTilesMenu.tsx
import React39 from "react";
import { jsx as jsx47, jsxs as jsxs33 } from "react/jsx-runtime";
var WorkspaceTilesMenu = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onDeleteWorkspace,
  appName = "app",
  currentUser = null,
  mode = "working-workspace"
}) => {
  const [isCreating, setIsCreating] = React39.useState(false);
  const [newWsName, setNewWsName] = React39.useState("");
  const [storageConfig, setStorageConfig] = React39.useState({
    provider: "backblaze_b2",
    b2BucketName: "ultrst-apps"
  });
  const [activeTab, setActiveTab] = React39.useState("workspaces");
  const [activeWorkspaceForClones, setActiveWorkspaceForClones] = React39.useState(null);
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    await onCreateWorkspace(newWsName.trim(), storageConfig);
    setNewWsName("");
    setIsCreating(false);
  };
  return /* @__PURE__ */ jsxs33("div", { style: { display: "flex", flexDirection: "column", height: "100%", background: "var(--skipo-bg-app, #0f172a)", color: "var(--skipo-text-primary, #f8fafc)", padding: "24px" }, children: [
    /* @__PURE__ */ jsxs33("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }, children: [
      /* @__PURE__ */ jsxs33("div", { children: [
        /* @__PURE__ */ jsxs33("h2", { style: { fontSize: "18px", fontWeight: 600, margin: 0 }, children: [
          "Workspaces (",
          mode,
          ")"
        ] }),
        /* @__PURE__ */ jsxs33("span", { style: { fontSize: "12px", color: "var(--skipo-text-muted, #94a3b8)" }, children: [
          currentUser?.email || "user",
          " \u2022 ",
          appName
        ] })
      ] }),
      /* @__PURE__ */ jsxs33("div", { style: { display: "flex", gap: "8px" }, children: [
        /* @__PURE__ */ jsx47(
          "button",
          {
            onClick: () => setActiveTab("workspaces"),
            style: { padding: "6px 14px", borderRadius: "6px", border: "1px solid #334155", background: activeTab === "workspaces" ? "#38bdf8" : "transparent", color: activeTab === "workspaces" ? "#0f172a" : "inherit", cursor: "pointer" },
            children: "List"
          }
        ),
        activeWs && /* @__PURE__ */ jsxs33(
          "button",
          {
            onClick: () => {
              setActiveWorkspaceForClones(activeWs);
              setActiveTab("clones");
            },
            style: { padding: "6px 14px", borderRadius: "6px", border: "1px solid #334155", background: activeTab === "clones" ? "#38bdf8" : "transparent", color: activeTab === "clones" ? "#0f172a" : "inherit", cursor: "pointer" },
            children: [
              "Clones (",
              activeWs.secondaryClones?.length || 0,
              ")"
            ]
          }
        ),
        /* @__PURE__ */ jsx47(
          "button",
          {
            onClick: () => setIsCreating(!isCreating),
            style: { padding: "6px 14px", borderRadius: "6px", border: "1px solid #38bdf8", background: isCreating ? "transparent" : "#38bdf8", color: isCreating ? "#38bdf8" : "#0f172a", cursor: "pointer" },
            children: isCreating ? "Cancel" : "+ New Workspace"
          }
        )
      ] })
    ] }),
    isCreating ? /* @__PURE__ */ jsxs33("form", { onSubmit: handleCreate, style: { display: "flex", flexDirection: "column", gap: "16px", background: "#1e293b", padding: "20px", borderRadius: "8px" }, children: [
      /* @__PURE__ */ jsxs33("div", { children: [
        /* @__PURE__ */ jsx47("label", { style: { display: "block", fontSize: "12px", marginBottom: "6px", color: "#94a3b8" }, children: "Workspace Name" }),
        /* @__PURE__ */ jsx47(
          "input",
          {
            type: "text",
            value: newWsName,
            onChange: (e) => setNewWsName(e.target.value),
            placeholder: "e.g. Production Vault",
            style: { width: "100%", padding: "8px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", color: "#fff" },
            autoFocus: true
          }
        )
      ] }),
      /* @__PURE__ */ jsx47(StorageOptionTiles, { currentUser, onSelectStorage: setStorageConfig }),
      /* @__PURE__ */ jsx47("button", { type: "submit", style: { padding: "10px", background: "#38bdf8", color: "#0f172a", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }, children: "Create Workspace" })
    ] }) : activeTab === "clones" && activeWorkspaceForClones ? /* @__PURE__ */ jsx47(
      WorkspaceSecondaryClonesPanel,
      {
        workspace: activeWorkspaceForClones,
        onClose: () => setActiveTab("workspaces")
      }
    ) : /* @__PURE__ */ jsx47("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", overflowY: "auto" }, children: workspaces.map((ws) => {
      const isActive = ws.id === activeWorkspaceId;
      return /* @__PURE__ */ jsxs33(
        "div",
        {
          onClick: () => onSelectWorkspace(ws),
          style: { padding: "16px", borderRadius: "8px", background: isActive ? "rgba(56, 189, 248, 0.08)" : "#1e293b", border: isActive ? "1px solid #38bdf8" : "1px solid #334155", cursor: "pointer" },
          children: [
            /* @__PURE__ */ jsxs33("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
              /* @__PURE__ */ jsx47("span", { style: { fontWeight: 600, fontSize: "14px" }, children: ws.name }),
              /* @__PURE__ */ jsxs33("div", { style: { display: "flex", gap: "6px" }, children: [
                ws.secondaryClones && ws.secondaryClones.length > 0 && /* @__PURE__ */ jsxs33("span", { style: { fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8" }, children: [
                  "+",
                  ws.secondaryClones.length,
                  " CLONES"
                ] }),
                isActive && /* @__PURE__ */ jsx47("span", { style: { fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "#38bdf8", color: "#0f172a", fontWeight: 600 }, children: "ACTIVE" })
              ] })
            ] }),
            /* @__PURE__ */ jsx47("div", { style: { marginTop: "10px" }, children: /* @__PURE__ */ jsx47(WorkspaceStorageReadonlyPanel, { workspace: ws }) }),
            onDeleteWorkspace && /* @__PURE__ */ jsx47("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: "12px" }, children: /* @__PURE__ */ jsx47(
              "button",
              {
                onClick: (e) => {
                  e.stopPropagation();
                  if (confirm(`Delete workspace "${ws.name}"?`)) onDeleteWorkspace(ws.id);
                },
                style: { background: "transparent", border: "none", color: "#f87171", fontSize: "11px", cursor: "pointer" },
                children: "Delete"
              }
            ) })
          ]
        },
        ws.id
      );
    }) })
  ] });
};
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
  BlockquoteStyleSchema,
  BottomStrip,
  BottomStripProvider,
  BreadcrumbNav,
  CANONICAL_ELEMENTS,
  CodeStyleSchema,
  ConfirmDialog,
  CopyableErrorAlert,
  CopyableLogViewer,
  CredentialField,
  DEFAULT_DARK_THEME_PACK,
  DEFAULT_LIGHT_THEME_PACK,
  DEFAULT_PANEL_GEOMETRY,
  DEPM_THEME_PACKS,
  DOCUSTACK_CYBERPUNK_PACK,
  DOCUSTACK_DARK_GOLD_PACK,
  DOCUSTACK_WARM_COFFEE_PACK,
  docustack_cyberpunk_neon_default as DocuStackCyberpunkPack,
  docustack_dark_gold_default as DocuStackDarkGoldPack,
  docustack_warm_coffee_default as DocuStackWarmCoffeePack,
  DrawerContainer,
  EmptyState,
  FloatingDetailsPanel,
  HeaderBar,
  HeadingLevelSchema,
  HorizontalRuleStyleSchema,
  IconOnlyButton,
  KNOWN_CREDENTIAL_URLS,
  LinkStyleSchema,
  ListStyleSchema,
  LoadingOverlay,
  LoginModal,
  MarkdownSectionStylesSchema,
  ModalContainer,
  ModularThemePackSchema,
  PageContainer,
  PanelContainer,
  ParagraphStyleSchema,
  ResizeHandles,
  SearchInput,
  SearchableList,
  SectionContainer,
  SettingsTab,
  SidebarContainer,
  SkipoSemanticTokensSchema,
  SkipoThemeMetadataSchema,
  SkipoThemeProvider,
  SplitContainer,
  SrklBackblazeTile,
  StatusIndicator,
  StatusLight,
  StorageOptionTiles,
  StoragePresetTile,
  SystemMessageDisplay,
  TabContainer,
  TableStyleSchema,
  ThemeEngine,
  ThemeSettingsSection,
  ThemeTypographySchema,
  ThemeVariantDefinitionSchema,
  TopToolbar,
  UIElementThemeValueSchema,
  WorkspaceSecondaryClonesPanel,
  WorkspaceStorageReadonlyPanel,
  WorkspaceTilesMenu,
  appThemeEngine,
  applyThemePack,
  centralLedger,
  createAppThemeSocket,
  depmThemeSocket,
  getAllUIElements,
  getThemeEngineStatus,
  getUIElement,
  palettes,
  registerUIElement,
  resolveTypographyCascade,
  safeValidateModularThemePack,
  tokensToCssVariables,
  useBottomStrip,
  usePanelGeometry,
  usePanelInteraction,
  useSearchKeyboardNavigation,
  useSkipoTheme,
  validateModularThemePack,
  validateSocketElements,
  validateThemePack
};
