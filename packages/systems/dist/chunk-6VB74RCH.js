// src/dock/DockItem.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function DockItem({ item, isActive, onClick }) {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "48px",
        height: "48px",
        borderRadius: "12px",
        cursor: "pointer",
        backgroundColor: isActive ? "rgba(255, 255, 255, 0.15)" : "transparent",
        transition: "background-color 0.2s, transform 0.1s",
        color: "#fff"
      },
      onClick: () => {
        onClick?.();
        item.onClick?.();
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
        e.currentTarget.style.transform = "scale(1.05)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.backgroundColor = isActive ? "rgba(255, 255, 255, 0.15)" : "transparent";
        e.currentTarget.style.transform = "scale(1)";
      },
      title: item.label,
      children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: "24px" }, children: item.icon }),
        item.badge && /* @__PURE__ */ jsx("div", { style: {
          position: "absolute",
          top: "0",
          right: "0",
          backgroundColor: "#ff4d4f",
          color: "white",
          fontSize: "10px",
          fontWeight: "bold",
          padding: "2px 6px",
          borderRadius: "10px",
          transform: "translate(25%, -25%)",
          border: "2px solid #1e1e1e"
        }, children: item.badge }),
        isActive && /* @__PURE__ */ jsx("div", { style: {
          position: "absolute",
          bottom: "-6px",
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: "#d4af37"
        } })
      ]
    }
  );
}

// src/dock/DockBar.tsx
import { useState } from "react";
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function DockBar({ items, position = "bottom", activeId, onItemClick, autoHide = false }) {
  const [isHovered, setIsHovered] = useState(false);
  const isVertical = position === "left" || position === "right";
  const positionStyles = {
    position: "fixed",
    ...position === "bottom" ? { bottom: "16px", left: "50%", transform: "translateX(-50%)" } : {},
    ...position === "top" ? { top: "16px", left: "50%", transform: "translateX(-50%)" } : {},
    ...position === "left" ? { left: "16px", top: "50%", transform: "translateY(-50%)" } : {},
    ...position === "right" ? { right: "16px", top: "50%", transform: "translateY(-50%)" } : {}
  };
  const hiddenTransform = position === "bottom" ? "translate(-50%, 150%)" : position === "top" ? "translate(-50%, -150%)" : position === "left" ? "translate(-150%, -50%)" : "translate(150%, -50%)";
  const baseTransform = position === "bottom" || position === "top" ? "translateX(-50%)" : "translateY(-50%)";
  const containerStyle = {
    ...positionStyles,
    display: "flex",
    flexDirection: isVertical ? "column" : "row",
    gap: "8px",
    padding: "8px",
    backgroundColor: "rgba(25, 25, 25, 0.7)",
    backdropFilter: "blur(16px)",
    border: "1px solid rgba(212, 175, 55, 0.3)",
    borderRadius: "16px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
    zIndex: 9999,
    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    transform: autoHide && !isHovered ? hiddenTransform : baseTransform
  };
  return /* @__PURE__ */ jsxs2(Fragment, { children: [
    autoHide && /* @__PURE__ */ jsx2(
      "div",
      {
        style: {
          position: "fixed",
          ...position === "bottom" ? { bottom: 0, left: 0, right: 0, height: "24px" } : {},
          ...position === "top" ? { top: 0, left: 0, right: 0, height: "24px" } : {},
          ...position === "left" ? { left: 0, top: 0, bottom: 0, width: "24px" } : {},
          ...position === "right" ? { right: 0, top: 0, bottom: 0, width: "24px" } : {},
          zIndex: 9998
        },
        onMouseEnter: () => setIsHovered(true)
      }
    ),
    /* @__PURE__ */ jsx2(
      "div",
      {
        style: containerStyle,
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        children: items.map((item) => /* @__PURE__ */ jsx2(
          DockItem,
          {
            item,
            isActive: activeId === item.id,
            onClick: () => onItemClick?.(item.id)
          },
          item.id
        ))
      }
    )
  ] });
}

// src/dock/useDock.ts
import { useState as useState2, useCallback } from "react";
function useDock(initialItems = []) {
  const [items, setItems] = useState2(initialItems);
  const [activeId, setActiveId] = useState2();
  const updateBadge = useCallback((id, badge) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, badge } : item));
  }, []);
  return {
    items,
    activeId,
    setActiveId,
    updateBadge,
    setItems
  };
}

export {
  DockItem,
  DockBar,
  useDock
};
