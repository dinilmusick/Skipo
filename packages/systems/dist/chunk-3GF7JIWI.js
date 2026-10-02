// src/node-graph/Viewport.ts
function screenToCanvas(clientX, clientY, viewport) {
  return {
    x: (clientX - viewport.panX) / viewport.zoom,
    y: (clientY - viewport.panY) / viewport.zoom
  };
}
function canvasToScreen(canvasX, canvasY, viewport) {
  return {
    x: canvasX * viewport.zoom + viewport.panX,
    y: canvasY * viewport.zoom + viewport.panY
  };
}
function zoomAtPoint(mouseX, mouseY, delta, viewport, config = {}) {
  const currentZoom = viewport.zoom;
  let newZoom = currentZoom + delta;
  newZoom = clampZoom(newZoom, config);
  const graphX = (mouseX - viewport.panX) / currentZoom;
  const graphY = (mouseY - viewport.panY) / currentZoom;
  const panX = mouseX - graphX * newZoom;
  const panY = mouseY - graphY * newZoom;
  return { zoom: newZoom, panX, panY };
}
function clampZoom(zoom, config = {}) {
  const minZoom = config.minZoom ?? 0.25;
  const maxZoom = config.maxZoom ?? 2.5;
  return Math.max(minZoom, Math.min(maxZoom, zoom));
}
function fitToView(nodes, containerWidth, containerHeight, padding = 50) {
  if (nodes.length === 0) {
    return { panX: containerWidth / 2, panY: containerHeight / 2, zoom: 1 };
  }
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    const width = node.width ?? 150;
    const height = node.height ?? 100;
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }
  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;
  const zoomX = (containerWidth - padding * 2) / graphWidth;
  const zoomY = (containerHeight - padding * 2) / graphHeight;
  const targetZoom = Math.min(zoomX, zoomY, 1);
  const panX = (containerWidth - graphWidth * targetZoom) / 2 - minX * targetZoom;
  const panY = (containerHeight - graphHeight * targetZoom) / 2 - minY * targetZoom;
  return { zoom: targetZoom, panX, panY };
}
function isNodeInCenterDeadZone(node, viewport, containerWidth, containerHeight, deadZoneRatio = 0.35) {
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  const nodeW = node.width ?? 130;
  const nodeH = node.height ?? 130;
  const nodeCenterX = node.position.x + nodeW / 2;
  const nodeCenterY = node.position.y + nodeH / 2;
  const screenNodeX = nodeCenterX * viewport.zoom + viewport.panX;
  const screenNodeY = nodeCenterY * viewport.zoom + viewport.panY;
  const dist = Math.hypot(screenNodeX - centerX, screenNodeY - centerY);
  const deadZoneRadius = Math.min(containerWidth, containerHeight) * deadZoneRatio;
  return dist <= deadZoneRadius;
}
function getCenterPanForNode(node, viewport, containerWidth, containerHeight) {
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  const nodeW = node.width ?? 130;
  const nodeH = node.height ?? 130;
  const nodeCenterX = node.position.x + nodeW / 2;
  const nodeCenterY = node.position.y + nodeH / 2;
  return {
    panX: Math.round(centerX - nodeCenterX * viewport.zoom),
    panY: Math.round(centerY - nodeCenterY * viewport.zoom)
  };
}

// src/node-graph/WireRenderer.tsx
import { useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function WireRenderer({ edges, nodesData, config: _config, onDeleteEdge, connecting }) {
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const getSocketPosition = (nodeId, socketId, type) => {
    const node = nodesData[nodeId];
    if (!node) return { x: 0, y: 0 };
    const sockets = type === "input" ? node.inputs : node.outputs;
    const socket = sockets?.find((s) => s.id === socketId);
    const socketIndex = sockets && socket ? sockets.indexOf(socket) : 0;
    const total = sockets?.length ?? 1;
    const zoom = node.zoom ?? 1;
    const nodeHeight = node.height ?? 130 * zoom;
    let x = type === "input" ? node.x : node.x + (node.width ?? 150 * zoom);
    const baseOffset = total === 1 ? nodeHeight * 0.5 : nodeHeight * 0.25 + Math.max(0, socketIndex) * 24 * zoom;
    let y = node.y + baseOffset;
    if (socket?.offset) {
      x += socket.offset.x * zoom;
      y += socket.offset.y * zoom;
    }
    return { x, y };
  };
  const renderBezier = (startX, startY, endX, endY) => {
    const delta = Math.max(Math.abs(endX - startX) * 0.5, 50);
    return `M ${startX},${startY} C ${startX + delta},${startY} ${endX - delta},${endY} ${endX},${endY}`;
  };
  return /* @__PURE__ */ jsxs("svg", { style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }, children: [
    edges.map((edge) => {
      const start = getSocketPosition(edge.source, edge.sourceSocket, "output");
      const end = getSocketPosition(edge.target, edge.targetSocket, "input");
      const path = renderBezier(start.x, start.y, end.x, end.y);
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const color = edge.color || "#61afef";
      const isHovered = hoveredEdgeId === edge.id;
      return /* @__PURE__ */ jsxs(
        "g",
        {
          style: { pointerEvents: "auto" },
          onMouseEnter: () => setHoveredEdgeId(edge.id),
          onMouseLeave: () => setHoveredEdgeId(null),
          children: [
            /* @__PURE__ */ jsx(
              "path",
              {
                d: path,
                fill: "none",
                stroke: "transparent",
                strokeWidth: 20,
                style: { pointerEvents: "stroke", cursor: "pointer" }
              }
            ),
            /* @__PURE__ */ jsx(
              "path",
              {
                d: path,
                fill: "none",
                stroke: color,
                strokeWidth: isHovered ? 3.5 : 3,
                opacity: isHovered ? 1 : 0.8
              }
            ),
            isHovered && onDeleteEdge && /* @__PURE__ */ jsxs(
              "g",
              {
                transform: `translate(${midX}, ${midY})`,
                onClick: (e) => {
                  e.stopPropagation();
                  onDeleteEdge(edge.id);
                },
                style: { cursor: "pointer", pointerEvents: "auto" },
                children: [
                  /* @__PURE__ */ jsx("circle", { r: 14, fill: "transparent" }),
                  /* @__PURE__ */ jsx("circle", { r: 8, fill: "#ff4d4f" }),
                  /* @__PURE__ */ jsx("text", { x: 0, y: 0, fontSize: 10, fill: "white", textAnchor: "middle", dominantBaseline: "central", children: "\u2715" })
                ]
              }
            )
          ]
        },
        edge.id
      );
    }),
    connecting && /* @__PURE__ */ jsx(
      "path",
      {
        d: renderBezier(connecting.startX, connecting.startY, connecting.endX, connecting.endY),
        fill: "none",
        stroke: connecting.color || "#61afef",
        strokeWidth: 3,
        strokeDasharray: "5,5",
        opacity: 0.8
      }
    )
  ] });
}

// src/node-graph/NodeCard.tsx
import { useRef as useRef2, useState as useState3, useLayoutEffect, useEffect } from "react";

// src/node-graph/MovableSocketView.tsx
import { useState as useState2, useRef } from "react";

// src/node-graph/spatial/socketCoordinates.ts
function calculateSocketCoordinates(baseY, options) {
  const clearance = options.clearance ?? 12;
  const nudge = options.nudge ?? { x: 0, y: 0 };
  const baseX = options.isOutput ? options.cardWidth / 2 + clearance : -(options.cardWidth / 2) - clearance;
  return {
    baseX,
    effectiveX: baseX + nudge.x,
    effectiveY: baseY + nudge.y,
    nudge
  };
}
var getBeamPoints = (nudge, baseW = 5, headW = 1.2) => {
  const vx = -nudge.x;
  const vy = -nudge.y;
  const d = Math.sqrt(vx * vx + vy * vy);
  if (d < 1) return "";
  const px = -vy / d;
  const py = vx / d;
  const hL_x = -px * headW;
  const hL_y = -py * headW;
  const hR_x = px * headW;
  const hR_y = py * headW;
  const bR_x = vx + px * baseW;
  const bR_y = vy + py * baseW;
  const bL_x = vx - px * baseW;
  const bL_y = vy - py * baseW;
  return `${hL_x},${hL_y} ${hR_x},${hR_y} ${bR_x},${bR_y} ${bL_x},${bL_y}`;
};

// src/node-graph/MovableSocketView.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function MovableSocketView({
  nodeId,
  socket,
  isRight = false,
  topOffset = 50,
  onMouseDown,
  onMouseUp,
  onSocketNudgeChange
}) {
  const [isHovered, setIsHovered] = useState2(false);
  const isDraggingGizmo = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, origX: 0, origY: 0 });
  const nudge = socket.offset ?? { x: 0, y: 0 };
  const isDisplaced = nudge.x !== 0 || nudge.y !== 0;
  const themeColor = isRight ? "var(--skipo-accent, #61afef)" : "#98c379";
  const beamPoints = isDisplaced ? getBeamPoints(nudge, 6, 1.5) : "";
  const handleGizmoMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingGizmo.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, origX: nudge.x, origY: nudge.y };
    const handleMouseMove = (ev) => {
      if (!isDraggingGizmo.current) return;
      const updated = {
        x: Math.round(dragStart.current.origX + (ev.clientX - dragStart.current.x)),
        y: Math.round(dragStart.current.origY + (ev.clientY - dragStart.current.y))
      };
      onSocketNudgeChange?.(nodeId, socket.id, updated);
    };
    const handleMouseUpDoc = () => {
      isDraggingGizmo.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUpDoc);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUpDoc);
  };
  return /* @__PURE__ */ jsxs2(
    "div",
    {
      style: {
        position: "absolute",
        left: isRight ? "100%" : "0",
        top: `${topOffset}px`,
        transform: "translate(-50%, -50%)",
        zIndex: 10,
        userSelect: "none"
      },
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      children: [
        isDisplaced && /* @__PURE__ */ jsxs2(
          "svg",
          {
            style: {
              position: "absolute",
              left: nudge.x + 6,
              top: nudge.y + 6,
              overflow: "visible",
              pointerEvents: "none",
              zIndex: 1
            },
            children: [
              /* @__PURE__ */ jsx2("polygon", { points: beamPoints, fill: themeColor, opacity: 0.5 }),
              /* @__PURE__ */ jsx2("polygon", { points: beamPoints, fill: "#ffffff", opacity: 0.8, transform: "scale(0.5)" })
            ]
          }
        ),
        /* @__PURE__ */ jsx2(
          "div",
          {
            style: {
              position: "absolute",
              left: nudge.x - 6,
              top: nudge.y - 6,
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: themeColor,
              cursor: "crosshair",
              border: "2px solid var(--skipo-surface, #222)",
              boxShadow: isHovered ? `0 0 8px ${themeColor}` : "0 2px 4px rgba(0,0,0,0.5)",
              zIndex: 4,
              transition: "box-shadow 0.15s ease"
            },
            title: `${socket.label} (${socket.type})`,
            onMouseDown: (e) => {
              e.stopPropagation();
              onMouseDown?.(e, nodeId, socket.id, isRight ? "output" : "input");
            },
            onMouseUp: (e) => {
              e.stopPropagation();
              onMouseUp?.(e, nodeId, socket.id, isRight ? "output" : "input");
            }
          }
        ),
        isHovered && /* @__PURE__ */ jsx2(
          "div",
          {
            title: "Drag gizmo to move handle without moving node",
            style: {
              position: "absolute",
              left: nudge.x + (isRight ? 10 : -22),
              top: nudge.y - 7,
              width: "14px",
              height: "14px",
              borderRadius: "3px",
              backgroundColor: "var(--skipo-surface, #222)",
              border: "1px solid var(--skipo-accent, #d4af37)",
              cursor: "grab",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 6
            },
            onMouseDown: handleGizmoMouseDown,
            children: /* @__PURE__ */ jsxs2("svg", { width: "8", height: "8", viewBox: "0 0 24 24", fill: "none", stroke: "var(--skipo-accent, #d4af37)", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round", children: [
              /* @__PURE__ */ jsx2("polyline", { points: "5 9 2 12 5 15" }),
              /* @__PURE__ */ jsx2("polyline", { points: "9 5 12 2 15 5" }),
              /* @__PURE__ */ jsx2("polyline", { points: "15 19 12 22 9 19" }),
              /* @__PURE__ */ jsx2("polyline", { points: "19 9 22 12 19 15" }),
              /* @__PURE__ */ jsx2("line", { x1: "2", y1: "12", x2: "22", y2: "12" }),
              /* @__PURE__ */ jsx2("line", { x1: "12", y1: "2", x2: "12", y2: "22" })
            ] })
          }
        )
      ]
    }
  );
}

// src/node-graph/NodeEmblem.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function NodeEmblem({ type, size = 38 }) {
  const t = (type || "").toLowerCase();
  const strokeWidth = 1.8;
  if (t.includes("entity") || t.includes("system")) {
    return /* @__PURE__ */ jsxs3("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "var(--skipo-accent, #d4af37)", strokeWidth, children: [
      /* @__PURE__ */ jsx3("path", { d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" }),
      /* @__PURE__ */ jsx3("polyline", { points: "3.27 6.96 12 12.01 20.73 6.96" }),
      /* @__PURE__ */ jsx3("line", { x1: "12", y1: "22.08", x2: "12", y2: "12" })
    ] });
  }
  if (t.includes("func") || t.includes("logic")) {
    return /* @__PURE__ */ jsx3("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "var(--skipo-accent, #61afef)", strokeWidth, children: /* @__PURE__ */ jsx3("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }) });
  }
  if (t.includes("data") || t.includes("state") || t.includes("db")) {
    return /* @__PURE__ */ jsxs3("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "#98c379", strokeWidth, children: [
      /* @__PURE__ */ jsx3("ellipse", { cx: "12", cy: "5", rx: "9", ry: "3" }),
      /* @__PURE__ */ jsx3("path", { d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" }),
      /* @__PURE__ */ jsx3("path", { d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" })
    ] });
  }
  if (t.includes("number") || t.includes("math")) {
    return /* @__PURE__ */ jsxs3("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "var(--skipo-accent, #61afef)", strokeWidth, children: [
      /* @__PURE__ */ jsx3("line", { x1: "4", y1: "9", x2: "20", y2: "9" }),
      /* @__PURE__ */ jsx3("line", { x1: "4", y1: "15", x2: "20", y2: "15" }),
      /* @__PURE__ */ jsx3("line", { x1: "10", y1: "3", x2: "8", y2: "21" }),
      /* @__PURE__ */ jsx3("line", { x1: "16", y1: "3", x2: "14", y2: "21" })
    ] });
  }
  if (t.includes("string") || t.includes("text")) {
    return /* @__PURE__ */ jsxs3("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "#98c379", strokeWidth, children: [
      /* @__PURE__ */ jsx3("polyline", { points: "4 7 4 4 20 4 20 7" }),
      /* @__PURE__ */ jsx3("line", { x1: "9", y1: "20", x2: "15", y2: "20" }),
      /* @__PURE__ */ jsx3("line", { x1: "12", y1: "4", x2: "12", y2: "20" })
    ] });
  }
  if (t.includes("bool") || t.includes("toggle")) {
    return /* @__PURE__ */ jsxs3("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "#e5c07b", strokeWidth, children: [
      /* @__PURE__ */ jsx3("rect", { x: "1", y: "5", width: "22", height: "14", rx: "7", ry: "7" }),
      /* @__PURE__ */ jsx3("circle", { cx: "16", cy: "12", r: "3", fill: "#e5c07b" })
    ] });
  }
  if (t.includes("vector") || t.includes("vec")) {
    return /* @__PURE__ */ jsxs3("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "#56b6c2", strokeWidth, children: [
      /* @__PURE__ */ jsx3("path", { d: "M5 19L19 5" }),
      /* @__PURE__ */ jsx3("polyline", { points: "9 5 19 5 19 15" })
    ] });
  }
  if (t.includes("color")) {
    return /* @__PURE__ */ jsx3("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "#e06c75", strokeWidth, children: /* @__PURE__ */ jsx3("path", { d: "M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" }) });
  }
  if (t.includes("display") || t.includes("view") || t.includes("out")) {
    return /* @__PURE__ */ jsxs3("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "#c678dd", strokeWidth, children: [
      /* @__PURE__ */ jsx3("rect", { x: "2", y: "3", width: "20", height: "14", rx: "2" }),
      /* @__PURE__ */ jsx3("line", { x1: "8", y1: "21", x2: "16", y2: "21" }),
      /* @__PURE__ */ jsx3("line", { x1: "12", y1: "17", x2: "12", y2: "21" })
    ] });
  }
  return /* @__PURE__ */ jsxs3("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "var(--skipo-accent, #61afef)", strokeWidth, children: [
    /* @__PURE__ */ jsx3("rect", { x: "3", y: "3", width: "18", height: "18", rx: "3" }),
    /* @__PURE__ */ jsx3("circle", { cx: "12", cy: "12", r: "4" })
  ] });
}

// src/node-graph/NodeCard.tsx
import { useBottomStrip } from "@skipo/ui";
import { Fragment, jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function NodeCard({
  node,
  selected,
  onMouseDown,
  onDoubleClick,
  onSocketMouseDown,
  onSocketMouseUp,
  onSocketNudgeChange,
  onToggleMinimize
}) {
  const cardRef = useRef2(null);
  const [isMinimized, setIsMinimized] = useState3(node.minimized ?? false);
  const [measuredHeight, setMeasuredHeight] = useState3(isMinimized ? 40 : node.height ?? 130);
  const { setInspectionText } = useBottomStrip();
  useEffect(() => {
    if (node.minimized !== void 0 && node.minimized !== isMinimized) {
      setIsMinimized(node.minimized);
    }
  }, [node.minimized]);
  useLayoutEffect(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      if (rect.height && Math.abs(rect.height - measuredHeight) > 1) {
        setMeasuredHeight(rect.height);
      }
    }
  });
  const toggleMinimize = (e) => {
    e?.stopPropagation();
    const next = !isMinimized;
    setIsMinimized(next);
    onToggleMinimize?.(node.id, next);
  };
  const handleMouseEnter = () => {
    const desc = node.data?.description || `System: ${node.type} \u2022 Title: ${node.label}`;
    setInspectionText(node.type, desc);
  };
  const minWidth = node.width ?? 150;
  const minHeight = isMinimized ? 40 : node.height ?? 130;
  const isLongText = (node.label || "").length > 11;
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      ref: cardRef,
      style: {
        position: "absolute",
        left: node.position.x,
        top: node.position.y,
        minWidth,
        width: node.width ? `${node.width}px` : "max-content",
        minHeight,
        height: isMinimized ? "40px" : "auto",
        userSelect: "none"
      },
      onMouseDown: (e) => onMouseDown?.(e, node.id),
      onDoubleClick: (e) => {
        e.stopPropagation();
        toggleMinimize();
        onDoubleClick?.(node.id);
      },
      onMouseEnter: handleMouseEnter,
      onMouseLeave: () => setInspectionText(null),
      children: [
        /* @__PURE__ */ jsx4("style", { children: `
        @keyframes skipo-marquee-rtl { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
      ` }),
        /* @__PURE__ */ jsx4(
          "div",
          {
            style: {
              width: "100%",
              minHeight,
              height: "100%",
              position: "relative",
              display: "flex",
              flexDirection: isMinimized ? "row" : "column",
              backgroundColor: "var(--skipo-surface, rgba(25, 25, 25, 0.92))",
              backdropFilter: "blur(10px)",
              border: `2px solid ${selected ? "var(--skipo-accent, #d4af37)" : "var(--skipo-border, #333)"}`,
              borderRadius: "8px",
              boxShadow: selected ? "0 0 16px rgba(212, 175, 55, 0.45)" : "0 4px 10px rgba(0,0,0,0.4)",
              overflow: "visible",
              boxSizing: "border-box"
            },
            children: isMinimized ? (
              /* Minimized View: Exactly 1/3 Icon and 2/3 Title (Custom Name) */
              /* @__PURE__ */ jsxs4(Fragment, { children: [
                /* @__PURE__ */ jsx4("div", { style: {
                  width: "33.333%",
                  flex: "0 0 33.333%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, transparent 72%)",
                  borderRight: "1px solid var(--skipo-border, #333)",
                  boxSizing: "border-box"
                }, children: /* @__PURE__ */ jsx4(NodeEmblem, { type: node.type, size: 20 }) }),
                /* @__PURE__ */ jsx4("div", { style: {
                  width: "66.667%",
                  flex: "0 0 66.667%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isLongText ? "flex-start" : "center",
                  padding: "0 8px",
                  boxSizing: "border-box",
                  overflow: "hidden"
                }, children: /* @__PURE__ */ jsxs4("div", { style: {
                  display: "inline-flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--skipo-text, #fff)",
                  letterSpacing: "0.02em",
                  animation: isLongText ? "skipo-marquee-rtl 6s linear infinite" : "none"
                }, children: [
                  /* @__PURE__ */ jsx4("span", { children: node.label }),
                  isLongText && /* @__PURE__ */ jsxs4("span", { style: { paddingLeft: "16px", opacity: 0.8 }, children: [
                    "\u2022 ",
                    node.label
                  ] })
                ] }) })
              ] })
            ) : (
              /* Expanded View: Full Emblem Top + Bottom Title Strip */
              /* @__PURE__ */ jsxs4(Fragment, { children: [
                /* @__PURE__ */ jsxs4("div", { style: {
                  flex: "1 0 auto",
                  minHeight: "84px",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  background: "radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, transparent 72%)",
                  padding: "12px",
                  boxSizing: "border-box"
                }, children: [
                  /* @__PURE__ */ jsx4(NodeEmblem, { type: node.type, size: 38 }),
                  /* @__PURE__ */ jsx4(
                    "button",
                    {
                      type: "button",
                      onClick: toggleMinimize,
                      title: "Minimize Node",
                      style: {
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid var(--skipo-border, #444)",
                        color: "var(--skipo-text-muted, #aaa)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontSize: 11,
                        lineHeight: 1,
                        padding: 0
                      },
                      children: "\u2212"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsx4("div", { style: {
                  flex: "0 0 auto",
                  minHeight: "38px",
                  width: "100%",
                  borderTop: "1px solid var(--skipo-border, #333)",
                  backgroundColor: "rgba(0, 0, 0, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "6px 8px",
                  boxSizing: "border-box"
                }, children: /* @__PURE__ */ jsx4("div", { style: { width: "100%", overflow: "hidden", display: "flex", justifyContent: isLongText ? "flex-start" : "center" }, children: /* @__PURE__ */ jsxs4("div", { style: {
                  display: "inline-flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--skipo-text, #fff)",
                  letterSpacing: "0.02em",
                  animation: isLongText ? "skipo-marquee-rtl 6s linear infinite" : "none"
                }, children: [
                  /* @__PURE__ */ jsx4("span", { children: node.label }),
                  isLongText && /* @__PURE__ */ jsxs4("span", { style: { paddingLeft: "16px", opacity: 0.8 }, children: [
                    "\u2022 ",
                    node.label
                  ] })
                ] }) }) })
              ] })
            )
          }
        ),
        node.inputs?.map((socket, idx) => {
          const total = node.inputs?.length ?? 1;
          const topOffset = total === 1 ? measuredHeight * 0.5 : measuredHeight * 0.25 + idx * 24;
          return /* @__PURE__ */ jsx4(
            MovableSocketView,
            {
              nodeId: node.id,
              socket,
              topOffset,
              onMouseDown: onSocketMouseDown,
              onMouseUp: onSocketMouseUp,
              onSocketNudgeChange
            },
            socket.id
          );
        }),
        node.outputs?.map((socket, idx) => {
          const total = node.outputs?.length ?? 1;
          const topOffset = total === 1 ? measuredHeight * 0.5 : measuredHeight * 0.25 + idx * 24;
          return /* @__PURE__ */ jsx4(
            MovableSocketView,
            {
              nodeId: node.id,
              socket,
              isRight: true,
              topOffset,
              onMouseDown: onSocketMouseDown,
              onMouseUp: onSocketMouseUp,
              onSocketNudgeChange
            },
            socket.id
          );
        })
      ]
    }
  );
}

// src/node-graph/BoxSelection.ts
function getNodesInSelection(startX, startY, endX, endY, nodes, viewport) {
  const canvasStartX = (startX - viewport.panX) / viewport.zoom;
  const canvasStartY = (startY - viewport.panY) / viewport.zoom;
  const canvasEndX = (endX - viewport.panX) / viewport.zoom;
  const canvasEndY = (endY - viewport.panY) / viewport.zoom;
  const minX = Math.min(canvasStartX, canvasEndX);
  const maxX = Math.max(canvasStartX, canvasEndX);
  const minY = Math.min(canvasStartY, canvasEndY);
  const maxY = Math.max(canvasStartY, canvasEndY);
  return nodes.filter((node) => {
    const nodeWidth = node.width ?? 150;
    const nodeHeight = node.height ?? 100;
    const intersectX = node.position.x < maxX && node.position.x + nodeWidth > minX;
    const intersectY = node.position.y < maxY && node.position.y + nodeHeight > minY;
    return intersectX && intersectY;
  }).map((node) => node.id);
}

// src/node-graph/useNodeGraph.ts
import { useState as useState4, useCallback } from "react";
function useNodeGraph(initialNodes = [], initialEdges = []) {
  const [nodes, setNodes] = useState4(initialNodes);
  const [edges, setEdges] = useState4(initialEdges);
  const [viewport, setViewport] = useState4({ panX: 0, panY: 0, zoom: 1 });
  const [selectedNodeIds, setSelectedNodeIds] = useState4(/* @__PURE__ */ new Set());
  const addNode = useCallback((node) => {
    setNodes((prev) => [...prev, node]);
  }, []);
  const removeNode = useCallback((nodeId) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);
  const addEdge = useCallback((edge) => {
    setEdges((prev) => [...prev, edge]);
  }, []);
  const removeEdge = useCallback((edgeId) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  }, []);
  const moveNode = useCallback((nodeId, x, y) => {
    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, position: { x, y } } : n));
  }, []);
  const updateViewport = useCallback((updates) => {
    setViewport((prev) => ({ ...prev, ...updates }));
  }, []);
  const handleZoom = useCallback((clientX, clientY, deltaY, config) => {
    const zoomDelta = deltaY * -1e-3;
    setViewport((prev) => zoomAtPoint(clientX, clientY, zoomDelta, prev, config));
  }, []);
  const toJSON = useCallback(() => {
    return { nodes, edges, viewport };
  }, [nodes, edges, viewport]);
  const fromJSON = useCallback((data) => {
    setNodes(data.nodes || []);
    setEdges(data.edges || []);
    setViewport(data.viewport || { panX: 0, panY: 0, zoom: 1 });
    setSelectedNodeIds(/* @__PURE__ */ new Set());
  }, []);
  const [focusedNodeId, setFocusedNodeId] = useState4(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState4(false);
  const [isDetailsPinned, setIsDetailsPinned] = useState4(false);
  const openDetails = useCallback((nodeId) => {
    setFocusedNodeId(nodeId);
    setIsDetailsOpen(true);
  }, []);
  const closeDetails = useCallback(() => setIsDetailsOpen(false), []);
  const togglePinDetails = useCallback(() => setIsDetailsPinned((p) => !p), []);
  const selectNode = useCallback((nodeId) => {
    setSelectedNodeIds(/* @__PURE__ */ new Set([nodeId]));
    if (!isDetailsPinned) setFocusedNodeId(nodeId);
  }, [isDetailsPinned]);
  const updateNode = useCallback((nodeId, updates) => {
    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, ...updates } : n));
  }, []);
  return {
    nodes,
    edges,
    viewport,
    selectedNodeIds,
    focusedNodeId,
    isDetailsOpen,
    isDetailsPinned,
    setNodes,
    setEdges,
    setSelectedNodeIds,
    setFocusedNodeId,
    setIsDetailsOpen,
    setIsDetailsPinned,
    openDetails,
    closeDetails,
    togglePinDetails,
    selectNode,
    updateNode,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    moveNode,
    updateViewport,
    handleZoom,
    toJSON,
    fromJSON
  };
}

// src/node-graph/NodeGraphCanvas.tsx
import { useRef as useRef4, useState as useState8, useEffect as useEffect3, useCallback as useCallback4 } from "react";

// src/node-graph/ui/widgets/CompatibleNodePicker.tsx
import { useState as useState5, useMemo } from "react";

// src/node-graph/rules/CompatibilityMatrix.ts
var CompatibilityMatrix = class {
  static rules = [];
  static registerRule(rule) {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }
  static clear() {
    this.rules = [];
  }
  static resolve(sourceHandle, targetHandle) {
    if (sourceHandle.direction === targetHandle.direction) {
      return { allowed: false, reason: "Cannot connect handles of the same direction" };
    }
    const isViewConnection = sourceHandle.handleCategory === "VIEW" || targetHandle.handleCategory === "VIEW";
    if (isViewConnection) {
      return { allowed: false, reason: "View handles do not connect via data compatibility matrix" };
    }
    const sType = sourceHandle.dataType.toUpperCase();
    const tType = targetHandle.dataType.toUpperCase();
    for (const rule of this.rules) {
      const matchSource = rule.sourceDataType === "*" || rule.sourceDataType.toUpperCase() === sType;
      const matchTarget = rule.targetDataType === "*" || rule.targetDataType.toUpperCase() === tType;
      const matchCategory = rule.sourceCategory === sourceHandle.handleCategory && rule.targetCategory === targetHandle.handleCategory;
      if (matchCategory && matchSource && matchTarget) {
        return {
          allowed: rule.allowed,
          wireType: rule.wireType,
          priority: rule.priority,
          reason: rule.allowed ? "Compatible" : "Explicitly rejected by rule"
        };
      }
    }
    if (sType === tType && sType !== "UNKNOWN") {
      return {
        allowed: true,
        wireType: sType,
        priority: 0,
        reason: "Implicit matching data type"
      };
    }
    return { allowed: false, reason: `Incompatible types: ${sType} -> ${tType}` };
  }
};

// src/node-graph/rules/HandleTypeRegistry.ts
var HandleTypeRegistry = class {
  static types = /* @__PURE__ */ new Map();
  static register(typeDef) {
    this.types.set(typeDef.dataType.toUpperCase(), typeDef);
  }
  static get(dataType) {
    return this.types.get(dataType.toUpperCase());
  }
  static has(dataType) {
    return this.types.has(dataType.toUpperCase());
  }
  static list() {
    return Array.from(this.types.values());
  }
  static clear() {
    this.types.clear();
  }
};

// src/node-graph/rules/WireTypeRegistry.ts
var WireTypeRegistry = class {
  static wireTypes = /* @__PURE__ */ new Map();
  static register(def) {
    this.wireTypes.set(def.wireType.toUpperCase(), def);
  }
  static get(wireType) {
    return this.wireTypes.get(wireType.toUpperCase());
  }
  static list() {
    return Array.from(this.wireTypes.values());
  }
  static clear() {
    this.wireTypes.clear();
  }
};

// src/node-graph/rules/DefaultRules.ts
function initializeDefaultGraphRules() {
  const types = ["STRING", "NUMBER", "BOOLEAN", "VECTOR2", "COLOR", "OBJECT", "ARRAY", "ANY"];
  for (const t of types) {
    HandleTypeRegistry.register({ dataType: t, category: "DATA" });
  }
  HandleTypeRegistry.register({ dataType: "VIEW", category: "VIEW" });
  WireTypeRegistry.register({ wireType: "DEFAULT", color: "#61afef", strokeWidth: 2.5, style: "bezier" });
  WireTypeRegistry.register({ wireType: "STRING", color: "#98c379", strokeWidth: 2.5, style: "bezier" });
  WireTypeRegistry.register({ wireType: "NUMBER", color: "#61afef", strokeWidth: 2.5, style: "bezier" });
  WireTypeRegistry.register({ wireType: "BOOLEAN", color: "#e5c07b", strokeWidth: 2.5, style: "bezier" });
  WireTypeRegistry.register({ wireType: "VECTOR2", color: "#56b6c2", strokeWidth: 2.5, style: "bezier" });
  WireTypeRegistry.register({ wireType: "COLOR", color: "#e06c75", strokeWidth: 2.5, style: "bezier" });
  WireTypeRegistry.register({ wireType: "OBJECT", color: "#c678dd", strokeWidth: 2.5, style: "bezier" });
  WireTypeRegistry.register({ wireType: "ARRAY", color: "#e06c75", strokeWidth: 2.5, style: "bezier" });
  WireTypeRegistry.register({ wireType: "VIEW", color: "#c678dd", strokeWidth: 2, dashArray: "5,5", style: "bezier" });
  for (const t of types) {
    CompatibilityMatrix.registerRule({
      sourceCategory: "DATA",
      sourceDataType: t,
      targetCategory: "DATA",
      targetDataType: t,
      allowed: true,
      wireType: t,
      priority: 10
    });
  }
  CompatibilityMatrix.registerRule({
    sourceCategory: "DATA",
    sourceDataType: "ANY",
    targetCategory: "DATA",
    targetDataType: "*",
    allowed: true,
    wireType: "DEFAULT",
    priority: 1
  });
  CompatibilityMatrix.registerRule({
    sourceCategory: "DATA",
    sourceDataType: "*",
    targetCategory: "DATA",
    targetDataType: "ANY",
    allowed: true,
    wireType: "DEFAULT",
    priority: 1
  });
}

// src/node-graph/domain/primitives/PrimitiveNodeDefs.ts
var PRIMITIVE_NODE_DEFINITIONS = [
  {
    type: "primitive-number",
    label: "Number",
    description: "Outputs a numerical constant or variable",
    inputs: [
      { id: "in", label: "Val", category: "DATA", dataType: "NUMBER", direction: "INPUT", connectionMode: "SINGLE" }
    ],
    outputs: [
      { id: "out", label: "Num", category: "DATA", dataType: "NUMBER", direction: "OUTPUT", connectionMode: "MULTI" }
    ],
    metadata: { isPrimitive: true, defaultValue: 0 }
  },
  {
    type: "primitive-string",
    label: "String",
    description: "Outputs a text string constant",
    inputs: [
      { id: "in", label: "Val", category: "DATA", dataType: "STRING", direction: "INPUT", connectionMode: "SINGLE" }
    ],
    outputs: [
      { id: "out", label: "Str", category: "DATA", dataType: "STRING", direction: "OUTPUT", connectionMode: "MULTI" }
    ],
    metadata: { isPrimitive: true, defaultValue: "" }
  },
  {
    type: "primitive-boolean",
    label: "Boolean",
    description: "Outputs a boolean true/false toggle state",
    inputs: [
      { id: "in", label: "Toggle", category: "DATA", dataType: "BOOLEAN", direction: "INPUT", connectionMode: "SINGLE" }
    ],
    outputs: [
      { id: "out", label: "Bool", category: "DATA", dataType: "BOOLEAN", direction: "OUTPUT", connectionMode: "MULTI" }
    ],
    metadata: { isPrimitive: true, defaultValue: false }
  },
  {
    type: "primitive-vector2",
    label: "Vector2",
    description: "2D coordinates (X, Y)",
    inputs: [
      { id: "x", label: "X", category: "DATA", dataType: "NUMBER", direction: "INPUT", connectionMode: "SINGLE" },
      { id: "y", label: "Y", category: "DATA", dataType: "NUMBER", direction: "INPUT", connectionMode: "SINGLE" }
    ],
    outputs: [
      { id: "vec", label: "Vec2", category: "DATA", dataType: "VECTOR2", direction: "OUTPUT", connectionMode: "MULTI" }
    ],
    metadata: { isPrimitive: true, defaultValue: { x: 0, y: 0 } }
  },
  {
    type: "primitive-color",
    label: "Color",
    description: "Color swatch or hex code",
    outputs: [
      { id: "color", label: "Color", category: "DATA", dataType: "COLOR", direction: "OUTPUT", connectionMode: "MULTI" }
    ],
    metadata: { isPrimitive: true, defaultValue: "#61afef" }
  },
  {
    type: "primitive-math",
    label: "Math",
    description: "Arithmetic operator on two numbers",
    inputs: [
      { id: "a", label: "A", category: "DATA", dataType: "NUMBER", direction: "INPUT", connectionMode: "SINGLE" },
      { id: "b", label: "B", category: "DATA", dataType: "NUMBER", direction: "INPUT", connectionMode: "SINGLE" }
    ],
    outputs: [
      { id: "result", label: "Out", category: "DATA", dataType: "NUMBER", direction: "OUTPUT", connectionMode: "MULTI" }
    ],
    metadata: { isPrimitive: true, operation: "add" }
  },
  {
    type: "primitive-display",
    label: "Display",
    description: "Displays input value in realtime",
    inputs: [
      { id: "in", label: "In", category: "DATA", dataType: "ANY", direction: "INPUT", connectionMode: "SINGLE" }
    ],
    metadata: { isPrimitive: true }
  }
];

// src/node-graph/rules/ConnectionRuleStore.ts
var ConnectionRuleStore = class {
  static nodeTypes = /* @__PURE__ */ new Map();
  static listeners = /* @__PURE__ */ new Set();
  static initialized = false;
  static initializeDefaults() {
    initializeDefaultGraphRules();
    this.registerNodeTypes(PRIMITIVE_NODE_DEFINITIONS);
    this.initialized = true;
    this.notify();
  }
  static isInitialized() {
    return this.initialized;
  }
  static subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  static notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
  // ---------------------------------------------------------------------------
  // Node Types
  // ---------------------------------------------------------------------------
  static registerNodeType(def) {
    this.nodeTypes.set(def.type, def);
    this.notify();
  }
  static registerNodeTypes(defs) {
    for (const def of defs) {
      this.nodeTypes.set(def.type, def);
    }
    this.notify();
  }
  static getNodeType(type) {
    return this.nodeTypes.get(type);
  }
  static listNodeTypes() {
    return Array.from(this.nodeTypes.values());
  }
  static hasNodeType(type) {
    return this.nodeTypes.has(type);
  }
  // ---------------------------------------------------------------------------
  // Handle Types
  // ---------------------------------------------------------------------------
  static registerHandleType(def) {
    HandleTypeRegistry.register(def);
    this.notify();
  }
  static getHandleType(dataType) {
    return HandleTypeRegistry.get(dataType);
  }
  static listHandleTypes() {
    return HandleTypeRegistry.list();
  }
  static hasHandleType(dataType) {
    return HandleTypeRegistry.has(dataType);
  }
  // ---------------------------------------------------------------------------
  // Wire Types
  // ---------------------------------------------------------------------------
  static registerWireType(def) {
    WireTypeRegistry.register(def);
    this.notify();
  }
  static getWireType(wireType) {
    return WireTypeRegistry.get(wireType);
  }
  static listWireTypes() {
    return WireTypeRegistry.list();
  }
  // ---------------------------------------------------------------------------
  // Compatibility & Rules
  // ---------------------------------------------------------------------------
  static registerRule(rule) {
    CompatibilityMatrix.registerRule(rule);
    this.notify();
  }
  static resolve(sourceHandle, targetHandle) {
    return CompatibilityMatrix.resolve(sourceHandle, targetHandle);
  }
  static canConnect(sourceHandle, targetHandle) {
    return CompatibilityMatrix.resolve(sourceHandle, targetHandle).allowed;
  }
  /**
   * Returns all node definitions that have at least one socket compatible with the dragged handle.
   * If source handle is OUTPUT, checks candidate node INPUT sockets.
   * If source handle is INPUT, checks candidate node OUTPUT sockets.
   */
  static getCompatibleNodeTypes(sourceHandle, candidateNodes) {
    const nodes = candidateNodes && candidateNodes.length > 0 ? candidateNodes : this.listNodeTypes();
    const sDataType = (sourceHandle.dataType || "ANY").toUpperCase();
    const isSourceOutput = sourceHandle.direction === "OUTPUT" || sourceHandle.direction === "output";
    const sourceCategory = sourceHandle.handleCategory ?? "DATA";
    return nodes.filter((node) => {
      const targetHandles = isSourceOutput ? node.inputs : node.outputs;
      if (!targetHandles || targetHandles.length === 0) {
        return sDataType === "ANY" || sDataType === "*";
      }
      return targetHandles.some((targetH) => {
        const tCat = targetH.category || "DATA";
        const tDataType = (targetH.dataType || "ANY").toUpperCase();
        const resolution = isSourceOutput ? CompatibilityMatrix.resolve(
          { handleCategory: sourceCategory, dataType: sDataType, direction: "OUTPUT" },
          { handleCategory: tCat, dataType: tDataType, direction: "INPUT" }
        ) : CompatibilityMatrix.resolve(
          { handleCategory: tCat, dataType: tDataType, direction: "OUTPUT" },
          { handleCategory: sourceCategory, dataType: sDataType, direction: "INPUT" }
        );
        return resolution.allowed;
      });
    });
  }
  /**
   * Find compatible sockets on a given target node for a dragged source handle.
   */
  static findCompatibleSockets(sourceHandle, targetNode) {
    const sDataType = (sourceHandle.dataType || "ANY").toUpperCase();
    const isSourceOutput = sourceHandle.direction === "OUTPUT" || sourceHandle.direction === "output";
    const sourceCategory = sourceHandle.handleCategory ?? "DATA";
    const targetHandles = isSourceOutput ? targetNode.inputs : targetNode.outputs;
    if (!targetHandles) return [];
    return targetHandles.filter((targetH) => {
      const tCat = targetH.category || "DATA";
      const tDataType = (targetH.dataType || "ANY").toUpperCase();
      const resolution = isSourceOutput ? CompatibilityMatrix.resolve(
        { handleCategory: sourceCategory, dataType: sDataType, direction: "OUTPUT" },
        { handleCategory: tCat, dataType: tDataType, direction: "INPUT" }
      ) : CompatibilityMatrix.resolve(
        { handleCategory: tCat, dataType: tDataType, direction: "OUTPUT" },
        { handleCategory: sourceCategory, dataType: sDataType, direction: "INPUT" }
      );
      return resolution.allowed;
    });
  }
  static clear() {
    this.nodeTypes.clear();
    HandleTypeRegistry.clear();
    WireTypeRegistry.clear();
    CompatibilityMatrix.clear();
    this.initialized = false;
    this.notify();
  }
};

// src/node-graph/ui/widgets/CompatibleNodePicker.tsx
import { useSearchKeyboardNavigation, BaseButton, BaseInput } from "@skipo/ui";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function CompatibleNodePicker({
  x,
  y,
  sourceHandle,
  availableNodeTypes,
  onSelect,
  onClose
}) {
  const [selectedTypes, setSelectedTypes] = useState5(/* @__PURE__ */ new Set());
  const [searchTerm, setSearchTerm] = useState5("");
  const compatibleNodes = useMemo(() => {
    const isOut = sourceHandle.direction === "output";
    return ConnectionRuleStore.getCompatibleNodeTypes(
      { dataType: sourceHandle.dataType || "ANY", direction: isOut ? "OUTPUT" : "INPUT", handleCategory: "DATA" },
      availableNodeTypes
    );
  }, [sourceHandle, availableNodeTypes]);
  const filteredNodes = useMemo(() => {
    if (!searchTerm.trim()) return compatibleNodes;
    const term = searchTerm.toLowerCase();
    return compatibleNodes.filter((n) => n.type.toLowerCase().includes(term) || n.label.toLowerCase().includes(term));
  }, [compatibleNodes, searchTerm]);
  const handleQuickSelect = (type) => onSelect([type]);
  const { highlightedIndex, setHighlightedIndex, handleKeyDown, listContainerRef } = useSearchKeyboardNavigation({
    items: filteredNodes,
    onSelect: (node) => handleQuickSelect(node.type),
    onClose
  });
  const toggleSelect = (type) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };
  return /* @__PURE__ */ jsxs5(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, 0)",
        width: "270px",
        maxHeight: "360px",
        backgroundColor: "var(--skipo-surface)",
        border: "var(--skipo-border)",
        borderRadius: "var(--skipo-radius)",
        boxShadow: "var(--skipo-shadow)",
        color: "var(--skipo-text)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--skipo-font)"
      },
      onClick: (e) => e.stopPropagation(),
      onMouseDown: (e) => e.stopPropagation(),
      children: [
        /* @__PURE__ */ jsxs5("div", { style: { padding: "8px 12px", borderBottom: "var(--skipo-border)", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--skipo-matte-bg)" }, children: [
          /* @__PURE__ */ jsxs5("div", { style: { display: "flex", flexDirection: "column" }, children: [
            /* @__PURE__ */ jsx5("span", { style: { fontSize: "11px", fontWeight: 600, color: "var(--skipo-accent)" }, children: "Compatible Nodes" }),
            /* @__PURE__ */ jsxs5("span", { style: { fontSize: "9px", color: "var(--skipo-text-muted)" }, children: [
              "For ",
              sourceHandle.dataType || "ANY",
              " (",
              sourceHandle.direction,
              ")"
            ] })
          ] }),
          /* @__PURE__ */ jsx5(BaseButton, { variant: "ghost", size: "sm", onClick: onClose, "aria-label": "Close picker", style: { padding: "2px 6px" }, children: "\u2715" })
        ] }),
        /* @__PURE__ */ jsx5("div", { style: { padding: "6px 8px", borderBottom: "var(--skipo-border)" }, children: /* @__PURE__ */ jsx5(BaseInput, { autoFocus: true, placeholder: "Filter nodes... (\u2191\u2193 navigate, \u21B5 spawn)", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), onKeyDown: handleKeyDown }) }),
        /* @__PURE__ */ jsx5("div", { ref: listContainerRef, style: { flex: 1, overflowY: "auto", maxHeight: "180px", padding: "4px" }, children: filteredNodes.length === 0 ? /* @__PURE__ */ jsx5("div", { style: { padding: "16px", textAlign: "center", fontSize: "11px", color: "var(--skipo-text-muted)" }, children: "No compatible nodes found" }) : filteredNodes.map((node, idx) => {
          const isSelected = selectedTypes.has(node.type);
          const isHighlighted = idx === highlightedIndex;
          return /* @__PURE__ */ jsxs5(
            "div",
            {
              onMouseEnter: () => setHighlightedIndex(idx),
              onClick: () => toggleSelect(node.type),
              onDoubleClick: () => handleQuickSelect(node.type),
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 8px",
                borderRadius: "var(--skipo-radius-sm)",
                cursor: "pointer",
                backgroundColor: isHighlighted ? "var(--skipo-surface-hover)" : isSelected ? "var(--skipo-matte-bg)" : "transparent",
                border: isHighlighted ? "var(--skipo-border)" : "1px solid transparent",
                marginBottom: "2px",
                transition: "background-color 0.1s ease"
              },
              children: [
                /* @__PURE__ */ jsx5("input", { type: "checkbox", checked: isSelected, onChange: () => toggleSelect(node.type), onClick: (e) => e.stopPropagation(), style: { cursor: "pointer" } }),
                /* @__PURE__ */ jsxs5("div", { style: { flex: 1, minWidth: 0 }, children: [
                  /* @__PURE__ */ jsx5("div", { style: { fontSize: "11px", fontWeight: isHighlighted ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isHighlighted ? "var(--skipo-accent)" : "inherit" }, children: node.label || node.type }),
                  node.description && /* @__PURE__ */ jsx5("div", { style: { fontSize: "9px", color: "var(--skipo-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: node.description })
                ] }),
                isHighlighted && /* @__PURE__ */ jsx5("span", { style: { fontSize: "8px", fontWeight: 600, color: "var(--skipo-accent)", padding: "1px 4px", borderRadius: "var(--skipo-radius-sm)", backgroundColor: "var(--skipo-matte-bg)", border: "var(--skipo-border)", whiteSpace: "nowrap" }, children: "\u21B5 Enter" })
              ]
            },
            node.type
          );
        }) }),
        /* @__PURE__ */ jsxs5("div", { style: { padding: "6px 8px", borderTop: "var(--skipo-border)", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--skipo-matte-bg)" }, children: [
          /* @__PURE__ */ jsx5("span", { style: { fontSize: "10px", color: "var(--skipo-text-muted)" }, children: selectedTypes.size > 0 ? `${selectedTypes.size} selected` : "\u21B5 Spawn top match" }),
          /* @__PURE__ */ jsxs5("div", { style: { display: "flex", gap: "6px" }, children: [
            /* @__PURE__ */ jsx5(BaseButton, { variant: "secondary", size: "sm", onClick: onClose, style: { padding: "2px 8px", fontSize: "10px" }, children: "Cancel" }),
            /* @__PURE__ */ jsx5(
              BaseButton,
              {
                variant: "accent",
                size: "sm",
                disabled: selectedTypes.size === 0 && filteredNodes.length === 0,
                onClick: () => {
                  if (selectedTypes.size > 0) onSelect(Array.from(selectedTypes));
                  else if (filteredNodes.length > 0) handleQuickSelect(filteredNodes[highlightedIndex >= 0 ? highlightedIndex : 0].type);
                },
                style: { padding: "2px 10px", fontSize: "10px" },
                children: "Spawn & Solidify"
              }
            )
          ] })
        ] })
      ]
    }
  );
}

// src/node-graph/ui/widgets/NodeSearchPalette.tsx
import { useState as useState6, useMemo as useMemo2 } from "react";
import { useSearchKeyboardNavigation as useSearchKeyboardNavigation2, BaseButton as BaseButton2, BaseInput as BaseInput2 } from "@skipo/ui";
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
function NodeSearchPalette({
  x,
  y,
  availableNodeTypes = [],
  onSpawnNode,
  onClose
}) {
  const [query, setQuery] = useState6("");
  const filteredNodes = useMemo2(() => {
    if (!availableNodeTypes || availableNodeTypes.length === 0) {
      return [{ type: "default", label: "Default Node", description: "Standard dual-port node" }];
    }
    if (!query.trim()) return availableNodeTypes;
    const q = query.toLowerCase();
    return availableNodeTypes.filter(
      (n) => n.type.toLowerCase().includes(q) || n.label.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q)
    );
  }, [availableNodeTypes, query]);
  const {
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown,
    listContainerRef
  } = useSearchKeyboardNavigation2({
    items: filteredNodes,
    onSelect: (node) => {
      onSpawnNode(node.type);
      onClose();
    },
    onClose
  });
  return /* @__PURE__ */ jsxs6(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, 0)",
        width: "290px",
        maxHeight: "380px",
        backgroundColor: "var(--skipo-surface)",
        border: "var(--skipo-border)",
        borderRadius: "var(--skipo-radius)",
        boxShadow: "var(--skipo-shadow)",
        color: "var(--skipo-text)",
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--skipo-font)"
      },
      onClick: (e) => e.stopPropagation(),
      onMouseDown: (e) => e.stopPropagation(),
      children: [
        /* @__PURE__ */ jsxs6("div", { style: {
          padding: "10px 12px",
          borderBottom: "var(--skipo-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "var(--skipo-matte-bg)"
        }, children: [
          /* @__PURE__ */ jsxs6("div", { style: { display: "flex", alignItems: "center", gap: "6px" }, children: [
            /* @__PURE__ */ jsx6("span", { style: { fontSize: "11px", fontWeight: 600, color: "var(--skipo-accent)" }, children: "Spawn Node" }),
            /* @__PURE__ */ jsx6("span", { style: { fontSize: "9px", color: "var(--skipo-text-muted)", fontFamily: "var(--skipo-font-mono)", backgroundColor: "var(--skipo-surface)", padding: "1px 4px", borderRadius: "var(--skipo-radius-sm)" }, children: "hotkey [N]" })
          ] }),
          /* @__PURE__ */ jsx6(
            BaseButton2,
            {
              variant: "ghost",
              size: "sm",
              onClick: onClose,
              "aria-label": "Close search",
              style: { padding: "2px 6px", fontSize: "12px" },
              children: "\u2715"
            }
          )
        ] }),
        /* @__PURE__ */ jsx6("div", { style: { padding: "8px", borderBottom: "var(--skipo-border)" }, children: /* @__PURE__ */ jsx6(
          BaseInput2,
          {
            autoFocus: true,
            placeholder: "Search nodes... (\u2191\u2193 navigate, \u21B5 spawn)",
            value: query,
            onChange: (e) => setQuery(e.target.value),
            onKeyDown: handleKeyDown
          }
        ) }),
        /* @__PURE__ */ jsx6("div", { ref: listContainerRef, style: { flex: 1, overflowY: "auto", maxHeight: "220px", padding: "4px 6px" }, children: filteredNodes.length === 0 ? /* @__PURE__ */ jsx6("div", { style: { padding: "20px", textAlign: "center", fontSize: "11px", color: "var(--skipo-text-muted)" }, children: "No matching nodes" }) : filteredNodes.map((node, idx) => {
          const isHighlighted = idx === highlightedIndex;
          return /* @__PURE__ */ jsxs6(
            "div",
            {
              onMouseEnter: () => setHighlightedIndex(idx),
              onClick: () => {
                onSpawnNode(node.type);
                onClose();
              },
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "7px 10px",
                borderRadius: "var(--skipo-radius-sm)",
                cursor: "pointer",
                backgroundColor: isHighlighted ? "var(--skipo-surface-hover)" : "transparent",
                border: isHighlighted ? "var(--skipo-border)" : "1px solid transparent",
                marginBottom: "2px",
                transition: "background-color 0.1s ease"
              },
              children: [
                /* @__PURE__ */ jsxs6("div", { style: { minWidth: 0, flex: 1 }, children: [
                  /* @__PURE__ */ jsx6("div", { style: { fontSize: "11px", fontWeight: isHighlighted ? 600 : 500, color: isHighlighted ? "var(--skipo-accent)" : "inherit" }, children: node.label || node.type }),
                  node.description && /* @__PURE__ */ jsx6("div", { style: { fontSize: "9px", color: "var(--skipo-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: node.description })
                ] }),
                isHighlighted && /* @__PURE__ */ jsx6("span", { style: { fontSize: "9px", fontWeight: 600, color: "var(--skipo-accent)", padding: "2px 5px", borderRadius: "var(--skipo-radius-sm)", backgroundColor: "var(--skipo-matte-bg)", border: "var(--skipo-border)", whiteSpace: "nowrap", marginLeft: "6px" }, children: "\u21B5 Spawn" })
              ]
            },
            node.type
          );
        }) }),
        /* @__PURE__ */ jsxs6("div", { style: {
          padding: "6px 10px",
          borderTop: "var(--skipo-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--skipo-matte-bg)",
          fontSize: "9px",
          color: "var(--skipo-text-muted)"
        }, children: [
          /* @__PURE__ */ jsxs6("span", { children: [
            filteredNodes.length,
            " nodes available"
          ] }),
          /* @__PURE__ */ jsxs6("span", { children: [
            "Press ",
            /* @__PURE__ */ jsx6("strong", { children: "Enter \u21B5" }),
            " to spawn"
          ] })
        ] })
      ]
    }
  );
}

// src/node-graph/ui/widgets/CanvasContextMenu.tsx
import { Fragment as Fragment2, jsx as jsx7, jsxs as jsxs7 } from "react/jsx-runtime";
function CanvasContextMenu({
  x,
  y,
  availableNodeTypes,
  hasSelection,
  onSpawnNode,
  onOpenSpawnMenu,
  onSelectAll,
  onDeleteSelected,
  onClearSelection,
  onClose
}) {
  const itemStyle = {
    padding: "6px 12px",
    fontSize: "11px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    color: "var(--skipo-text, #fff)",
    borderRadius: "4px",
    userSelect: "none"
  };
  const shortcutStyle = {
    fontSize: "9px",
    color: "var(--skipo-text-muted, #888)",
    fontFamily: "monospace"
  };
  return /* @__PURE__ */ jsxs7(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        minWidth: "180px",
        backgroundColor: "var(--skipo-surface, #1e1e1e)",
        border: "1px solid var(--skipo-border, #333)",
        borderRadius: "6px",
        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.6)",
        padding: "4px",
        zIndex: 60,
        fontFamily: "Inter, system-ui, sans-serif"
      },
      onClick: (e) => e.stopPropagation(),
      onMouseDown: (e) => e.stopPropagation(),
      children: [
        onOpenSpawnMenu && /* @__PURE__ */ jsxs7(
          "div",
          {
            style: {
              ...itemStyle,
              fontWeight: 600,
              color: "var(--skipo-accent, #61afef)",
              backgroundColor: "rgba(97, 175, 239, 0.08)"
            },
            onMouseEnter: (e) => e.currentTarget.style.backgroundColor = "rgba(97, 175, 239, 0.16)",
            onMouseLeave: (e) => e.currentTarget.style.backgroundColor = "rgba(97, 175, 239, 0.08)",
            onClick: () => {
              onOpenSpawnMenu();
              onClose();
            },
            children: [
              /* @__PURE__ */ jsx7("span", { children: "Spawn Node Menu..." }),
              /* @__PURE__ */ jsx7("span", { style: shortcutStyle, children: "N" })
            ]
          }
        ),
        /* @__PURE__ */ jsx7("div", { style: { padding: "4px 8px", fontSize: "9px", textTransform: "uppercase", color: "var(--skipo-text-muted, #888)", fontWeight: 600 }, children: "Quick Spawn" }),
        /* @__PURE__ */ jsx7("div", { style: { maxHeight: "140px", overflowY: "auto" }, children: !availableNodeTypes || availableNodeTypes.length === 0 ? /* @__PURE__ */ jsx7(
          "div",
          {
            style: itemStyle,
            onClick: () => {
              onSpawnNode("default");
              onClose();
            },
            children: /* @__PURE__ */ jsx7("span", { children: "Default Node" })
          }
        ) : availableNodeTypes.map((def) => /* @__PURE__ */ jsx7(
          "div",
          {
            style: itemStyle,
            onMouseEnter: (e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)",
            onMouseLeave: (e) => e.currentTarget.style.backgroundColor = "transparent",
            onClick: () => {
              onSpawnNode(def.type);
              onClose();
            },
            children: /* @__PURE__ */ jsx7("span", { children: def.label || def.type })
          },
          def.type
        )) }),
        /* @__PURE__ */ jsx7("div", { style: { height: "1px", backgroundColor: "var(--skipo-border, #333)", margin: "4px 0" } }),
        /* @__PURE__ */ jsxs7(
          "div",
          {
            style: itemStyle,
            onMouseEnter: (e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)",
            onMouseLeave: (e) => e.currentTarget.style.backgroundColor = "transparent",
            onClick: () => {
              onSelectAll();
              onClose();
            },
            children: [
              /* @__PURE__ */ jsx7("span", { children: "Select All" }),
              /* @__PURE__ */ jsx7("span", { style: shortcutStyle, children: "\u2318A" })
            ]
          }
        ),
        hasSelection && /* @__PURE__ */ jsxs7(Fragment2, { children: [
          /* @__PURE__ */ jsxs7(
            "div",
            {
              style: { ...itemStyle, color: "#e06c75" },
              onMouseEnter: (e) => e.currentTarget.style.backgroundColor = "rgba(224, 108, 117, 0.15)",
              onMouseLeave: (e) => e.currentTarget.style.backgroundColor = "transparent",
              onClick: () => {
                onDeleteSelected();
                onClose();
              },
              children: [
                /* @__PURE__ */ jsx7("span", { children: "Delete Selected" }),
                /* @__PURE__ */ jsx7("span", { style: shortcutStyle, children: "Del" })
              ]
            }
          ),
          /* @__PURE__ */ jsx7(
            "div",
            {
              style: itemStyle,
              onMouseEnter: (e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)",
              onMouseLeave: (e) => e.currentTarget.style.backgroundColor = "transparent",
              onClick: () => {
                onClearSelection();
                onClose();
              },
              children: /* @__PURE__ */ jsx7("span", { children: "Clear Selection" })
            }
          )
        ] })
      ]
    }
  );
}

// src/node-graph/useGhostRouting.ts
import { useEffect as useEffect2, useState as useState7, useCallback as useCallback2, useRef as useRef3 } from "react";

// src/node-graph/store/GhostStore.ts
var GhostStore = class _GhostStore {
  static instance = null;
  isActive = false;
  ghostNodes = [];
  ghostTraces = [];
  scenarioIndex = 0;
  hoveredGhostId = null;
  sourceNodeIds = [];
  listeners = /* @__PURE__ */ new Set();
  static getInstance() {
    if (!this.instance) {
      this.instance = new _GhostStore();
    }
    return this.instance;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
  setPredictions(nodes, traces, sourceNodeIds) {
    this.ghostNodes = nodes;
    this.ghostTraces = traces;
    this.sourceNodeIds = [...sourceNodeIds];
    this.isActive = nodes.length > 0;
    this.scenarioIndex = 0;
    this.hoveredGhostId = null;
    this.notify();
  }
  cycleScenario(maxScenarios = 3) {
    if (this.ghostNodes.length === 0) return;
    const available = new Set(this.ghostNodes.map((n) => n.scenarioIndex));
    const count = Math.max(available.size, maxScenarios);
    this.scenarioIndex = (this.scenarioIndex + 1) % count;
    this.notify();
  }
  setHoveredGhostId(id) {
    if (this.hoveredGhostId !== id) {
      this.hoveredGhostId = id;
      this.notify();
    }
  }
  getActiveGhostNodes() {
    return this.ghostNodes.filter((n) => n.scenarioIndex === this.scenarioIndex);
  }
  getActiveGhostTraces() {
    return this.ghostTraces.filter((t) => t.scenarioIndex === this.scenarioIndex);
  }
  clear() {
    this.isActive = false;
    this.ghostNodes = [];
    this.ghostTraces = [];
    this.scenarioIndex = 0;
    this.hoveredGhostId = null;
    this.sourceNodeIds = [];
    this.notify();
  }
};

// src/node-graph/spatial/prediction/GhostInferenceEngine.ts
var GhostInferenceEngine = class {
  static inferNextNodes(selectedNodes, allNodeDefs, options = {}) {
    if (selectedNodes.length === 0 || allNodeDefs.length === 0) {
      return [];
    }
    const scenarioCount = Math.max(1, options.scenarioCount ?? 3);
    const maxSuggestions = options.maxSuggestionsPerNode ?? 2;
    const candidates = [];
    for (const sourceNode of selectedNodes) {
      const outputSockets = sourceNode.outputs ?? [];
      if (outputSockets.length === 0) continue;
      const scoredDefs = [];
      for (const def of allNodeDefs) {
        if (def.type === sourceNode.type) continue;
        const mappings = this.resolveSocketMappings(outputSockets, def);
        if (mappings.length === 0) continue;
        let score = mappings.length * 10;
        if (options.customScorer) {
          score += options.customScorer(sourceNode.type, def.type);
        } else {
          score += this.computeAffinityScore(sourceNode.type, def.type);
        }
        scoredDefs.push({ def, mappings, score });
      }
      scoredDefs.sort((a, b) => b.score - a.score);
      for (let sIdx = 0; sIdx < scenarioCount; sIdx++) {
        const slice = scoredDefs.slice(sIdx * maxSuggestions, (sIdx + 1) * maxSuggestions);
        for (let i = 0; i < slice.length; i++) {
          const match = slice[i];
          const yOffset = (i - (slice.length - 1) / 2) * 140;
          candidates.push({
            id: `ghost-${sourceNode.id}-${match.def.type}-s${sIdx}-${i}`,
            nodeType: match.def.type,
            label: match.def.label || match.def.type,
            scenarioIndex: sIdx,
            score: match.score,
            sourceNodeId: sourceNode.id,
            socketMappings: match.mappings,
            relativeOffset: { x: 260, y: yOffset }
          });
        }
      }
    }
    return candidates;
  }
  static resolveSocketMappings(sourceOutputs, targetDef) {
    const mappings = [];
    const targetInputs = targetDef.inputs ?? [];
    for (const outSocket of sourceOutputs) {
      const matchingInput = targetInputs.find((inp) => {
        return ConnectionRuleStore.canConnect(
          { dataType: outSocket.dataType || "ANY", direction: "OUTPUT", handleCategory: "DATA" },
          { dataType: inp.dataType || "ANY", direction: "INPUT", handleCategory: "DATA" }
        );
      });
      if (matchingInput) {
        const resolution = ConnectionRuleStore.resolve(
          { dataType: outSocket.dataType || "ANY", direction: "OUTPUT", handleCategory: "DATA" },
          { dataType: matchingInput.dataType || "ANY", direction: "INPUT", handleCategory: "DATA" }
        );
        mappings.push({
          sourceSocketId: outSocket.id,
          targetSocketId: matchingInput.id,
          wireType: resolution.wireType || "DEFAULT"
        });
      }
    }
    return mappings;
  }
  static computeAffinityScore(sourceType, targetType) {
    const s = sourceType.toLowerCase();
    const t = targetType.toLowerCase();
    if ((s.includes("source") || s.includes("input")) && (t.includes("process") || t.includes("filter"))) return 15;
    if ((s.includes("process") || s.includes("filter")) && (t.includes("sink") || t.includes("output"))) return 15;
    if (s.includes("audio") && t.includes("audio")) return 12;
    if (s.includes("data") && t.includes("data")) return 10;
    return 5;
  }
};

// src/node-graph/spatial/prediction/GhostLayoutResolver.ts
var GhostLayoutResolver = class {
  static resolveLayout(candidates, existingNodes, allNodeDefs) {
    const nodeMap = new Map(existingNodes.map((n) => [n.id, n]));
    const defMap = new Map(allNodeDefs.map((d) => [d.type, d]));
    const occupiedRects = existingNodes.map((n) => ({
      x: n.position.x,
      y: n.position.y,
      width: n.width ?? 180,
      height: n.height ?? 120
    }));
    const resolved = [];
    for (const cand of candidates) {
      const source = nodeMap.get(cand.sourceNodeId);
      const def = defMap.get(cand.nodeType);
      const width = 180;
      const height = 120;
      const baseX = (source ? source.position.x + (source.width ?? 180) : 0) + 80;
      const baseY = (source ? source.position.y : 0) + cand.relativeOffset.y;
      const placedRect = this.findNonOverlappingPosition(
        { x: baseX, y: baseY, width, height },
        occupiedRects
      );
      occupiedRects.push(placedRect);
      const inputs = (def?.inputs ?? []).map((h) => ({
        id: h.id,
        label: h.label || h.id,
        type: "input",
        dataType: h.dataType,
        direction: "INPUT"
      }));
      const outputs = (def?.outputs ?? []).map((h) => ({
        id: h.id,
        label: h.label || h.id,
        type: "output",
        dataType: h.dataType,
        direction: "OUTPUT"
      }));
      resolved.push({
        id: cand.id,
        nodeType: cand.nodeType,
        label: cand.label,
        position: { x: placedRect.x, y: placedRect.y },
        size: { width, height },
        scenarioIndex: cand.scenarioIndex,
        sourceNodeId: cand.sourceNodeId,
        socketMappings: cand.socketMappings,
        inputs,
        outputs
      });
    }
    return resolved;
  }
  static findNonOverlappingPosition(ideal, existing) {
    let curr = { ...ideal };
    let collision = true;
    let attempts = 0;
    const padding = 20;
    while (collision && attempts < 15) {
      collision = false;
      for (const box of existing) {
        if (this.intersects(curr, box, padding)) {
          collision = true;
          curr.y = box.y + box.height + padding;
          curr.x = ideal.x + (attempts % 2 === 1 ? 24 : 0);
          break;
        }
      }
      attempts++;
    }
    return curr;
  }
  static intersects(a, b, pad) {
    return !(a.x + a.width + pad <= b.x || b.x + b.width + pad <= a.x || a.y + a.height + pad <= b.y || b.y + b.height + pad <= a.y);
  }
};

// src/node-graph/spatial/prediction/GhostTracePathBuilder.ts
var GhostTracePathBuilder = class {
  static buildGhostTraces(ghostNodes, existingNodes) {
    const nodeMap = new Map(existingNodes.map((n) => [n.id, n]));
    const traces = [];
    for (const ghost of ghostNodes) {
      const source = nodeMap.get(ghost.sourceNodeId);
      if (!source) continue;
      for (const mapping of ghost.socketMappings) {
        const start = this.getRealSocketPosition(source, mapping.sourceSocketId, "output");
        const end = this.getGhostSocketPosition(ghost, mapping.targetSocketId, "input");
        const pathD = this.renderBezier(start.x, start.y, end.x, end.y);
        traces.push({
          id: `trace-ghost-${source.id}-${mapping.sourceSocketId}->${ghost.id}-${mapping.targetSocketId}`,
          sourceNodeId: source.id,
          sourceSocketId: mapping.sourceSocketId,
          targetGhostNodeId: ghost.id,
          targetSocketId: mapping.targetSocketId,
          wireType: mapping.wireType,
          pathD,
          scenarioIndex: ghost.scenarioIndex
        });
      }
    }
    return traces;
  }
  static getRealSocketPosition(node, socketId, type) {
    const sockets = type === "input" ? node.inputs : node.outputs;
    const socket = sockets?.find((s) => s.id === socketId);
    const index = sockets && socket ? sockets.indexOf(socket) : 0;
    const w = node.width ?? 180;
    const count = Math.max(1, sockets?.length ?? 1);
    const x = type === "input" ? node.position.x : node.position.x + w;
    const y = node.position.y + (index + 1) * (node.height ?? 120) / (count + 1);
    return {
      x: x + (socket?.offset?.x ?? 0),
      y: y + (socket?.offset?.y ?? 0)
    };
  }
  static getGhostSocketPosition(ghost, socketId, type) {
    const sockets = type === "input" ? ghost.inputs : ghost.outputs;
    const socket = sockets?.find((s) => s.id === socketId);
    const index = sockets && socket ? sockets.indexOf(socket) : 0;
    const w = ghost.size.width;
    const count = Math.max(1, sockets?.length ?? 1);
    const x = type === "input" ? ghost.position.x : ghost.position.x + w;
    const y = ghost.position.y + (index + 1) * ghost.size.height / (count + 1);
    return { x, y };
  }
  static renderBezier(startX, startY, endX, endY) {
    const delta = Math.max(Math.abs(endX - startX) * 0.5, 45);
    return `M ${startX},${startY} C ${startX + delta},${startY} ${endX - delta},${endY} ${endX},${endY}`;
  }
};

// src/node-graph/useGhostRouting.ts
function useGhostRouting({
  nodes,
  edges,
  selectedNodeIds,
  config,
  availableNodeTypes,
  onNodesChange,
  onEdgesChange
}) {
  const ghostStore = useRef3(GhostStore.getInstance()).current;
  const [activeGhostNodes, setActiveGhostNodes] = useState7([]);
  const [activeGhostTraces, setActiveGhostTraces] = useState7([]);
  const [scenarioIndex, setScenarioIndex] = useState7(0);
  const [hoveredGhostId, setHoveredGhostId] = useState7(null);
  const debounceTimerRef = useRef3(null);
  useEffect2(() => {
    const unsubscribe = ghostStore.subscribe(() => {
      setActiveGhostNodes(ghostStore.getActiveGhostNodes());
      setActiveGhostTraces(ghostStore.getActiveGhostTraces());
      setScenarioIndex(ghostStore.scenarioIndex);
      setHoveredGhostId(ghostStore.hoveredGhostId);
    });
    return () => unsubscribe();
  }, [ghostStore]);
  useEffect2(() => {
    if (config?.ghostRoutingEnabled === false) {
      ghostStore.clear();
      return;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (selectedNodeIds.size === 0) {
      ghostStore.clear();
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      const selected = nodes.filter((n) => selectedNodeIds.has(n.id));
      const defs = availableNodeTypes && availableNodeTypes.length > 0 ? availableNodeTypes : ConnectionRuleStore.listNodeTypes();
      const candidates = GhostInferenceEngine.inferNextNodes(selected, defs, {
        scenarioCount: config?.ghostScenarioCount ?? 3
      });
      const layoutNodes = GhostLayoutResolver.resolveLayout(candidates, nodes, defs);
      const traces = GhostTracePathBuilder.buildGhostTraces(layoutNodes, nodes);
      ghostStore.setPredictions(layoutNodes, traces, Array.from(selectedNodeIds));
    }, 250);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [nodes, selectedNodeIds, config?.ghostRoutingEnabled, config?.ghostScenarioCount, availableNodeTypes, ghostStore]);
  const solidifyOne = useCallback2((ghostId) => {
    const ghost = ghostStore.ghostNodes.find((g) => g.id === ghostId);
    if (!ghost) return;
    const realNodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const realNode = {
      id: realNodeId,
      type: ghost.nodeType,
      label: ghost.label,
      position: { ...ghost.position },
      width: ghost.size.width,
      height: ghost.size.height,
      inputs: ghost.inputs,
      outputs: ghost.outputs
    };
    const newEdges = ghost.socketMappings.map((m) => ({
      id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      source: ghost.sourceNodeId,
      sourceSocket: m.sourceSocketId,
      target: realNodeId,
      targetSocket: m.targetSocketId,
      wireType: m.wireType
    }));
    onNodesChange?.([...nodes, realNode]);
    onEdgesChange?.([...edges, ...newEdges]);
    ghostStore.clear();
  }, [nodes, edges, onNodesChange, onEdgesChange, ghostStore]);
  const solidifyAll = useCallback2(() => {
    const activeNodes = ghostStore.getActiveGhostNodes();
    if (activeNodes.length === 0) return;
    const newRealNodes = [];
    const newRealEdges = [];
    for (const ghost of activeNodes) {
      const realNodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      newRealNodes.push({
        id: realNodeId,
        type: ghost.nodeType,
        label: ghost.label,
        position: { ...ghost.position },
        width: ghost.size.width,
        height: ghost.size.height,
        inputs: ghost.inputs,
        outputs: ghost.outputs
      });
      for (const m of ghost.socketMappings) {
        newRealEdges.push({
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          source: ghost.sourceNodeId,
          sourceSocket: m.sourceSocketId,
          target: realNodeId,
          targetSocket: m.targetSocketId,
          wireType: m.wireType
        });
      }
    }
    onNodesChange?.([...nodes, ...newRealNodes]);
    onEdgesChange?.([...edges, ...newRealEdges]);
    ghostStore.clear();
  }, [nodes, edges, onNodesChange, onEdgesChange, ghostStore]);
  const cycleScenario = useCallback2(() => {
    ghostStore.cycleScenario(config?.ghostScenarioCount ?? 3);
  }, [ghostStore, config?.ghostScenarioCount]);
  const dismiss = useCallback2(() => {
    ghostStore.clear();
  }, [ghostStore]);
  return {
    isActive: ghostStore.isActive,
    activeGhostNodes,
    activeGhostTraces,
    scenarioIndex,
    hoveredGhostId,
    setHoveredGhostId: (id) => ghostStore.setHoveredGhostId(id),
    solidifyOne,
    solidifyAll,
    cycleScenario,
    dismiss
  };
}

// src/node-graph/spatial/useMagneticTraces.ts
import { useMemo as useMemo3, useCallback as useCallback3 } from "react";
function getSocketCanvasPos(node, socket, isOut, idx, total) {
  const h = node.height ?? 130;
  const w = node.width ?? 130;
  const topOffset = total === 1 ? h * 0.5 : h * 0.25 + idx * 24;
  const nudge = socket.offset ?? { x: 0, y: 0 };
  const baseX = isOut ? node.position.x + w : node.position.x;
  return {
    x: baseX + nudge.x,
    y: node.position.y + topOffset + nudge.y
  };
}
function useMagneticTraces({
  nodes,
  edges,
  config,
  onEdgesChange
}) {
  const isEnabled = config?.magneticTracesEnabled !== false && config?.tracingEnabled !== false;
  const cutoff = config?.traceCutoffDistance ?? 220;
  const traces = useMemo3(() => {
    if (!isEnabled || nodes.length < 2) return [];
    const existingEdgeKeys = new Set(
      edges.map((e) => `${e.source}:${e.sourceSocket}->${e.target}:${e.targetSocket}`)
    );
    const candidates = [];
    for (let i = 0; i < nodes.length; i++) {
      const srcNode = nodes[i];
      const outputs = srcNode.outputs ?? [];
      if (outputs.length === 0) continue;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const tgtNode = nodes[j];
        const inputs = tgtNode.inputs ?? [];
        if (inputs.length === 0) continue;
        outputs.forEach((outSock, outIdx) => {
          const outPos = getSocketCanvasPos(srcNode, outSock, true, outIdx, outputs.length);
          inputs.forEach((inSock, inIdx) => {
            const edgeKey = `${srcNode.id}:${outSock.id}->${tgtNode.id}:${inSock.id}`;
            if (existingEdgeKeys.has(edgeKey)) return;
            const inPos = getSocketCanvasPos(tgtNode, inSock, false, inIdx, inputs.length);
            const dist = Math.hypot(inPos.x - outPos.x, inPos.y - outPos.y);
            if (dist <= cutoff) {
              const canConnect = ConnectionRuleStore.canConnect(
                { dataType: outSock.dataType || "ANY", direction: "OUTPUT", handleCategory: "DATA" },
                { dataType: inSock.dataType || "ANY", direction: "INPUT", handleCategory: "DATA" }
              );
              if (canConnect) {
                const resolution = ConnectionRuleStore.resolve(
                  { dataType: outSock.dataType || "ANY", direction: "OUTPUT", handleCategory: "DATA" },
                  { dataType: inSock.dataType || "ANY", direction: "INPUT", handleCategory: "DATA" }
                );
                const wireType = resolution.wireType || "DEFAULT";
                const wireDef = WireTypeRegistry.get(wireType);
                const color = wireDef?.color || "#61afef";
                const delta = Math.max(Math.abs(inPos.x - outPos.x) * 0.5, 40);
                const pathD = `M ${outPos.x},${outPos.y} C ${outPos.x + delta},${outPos.y} ${inPos.x - delta},${inPos.y} ${inPos.x},${inPos.y}`;
                candidates.push({
                  id: `mag-${srcNode.id}-${outSock.id}->${tgtNode.id}-${inSock.id}`,
                  sourceNodeId: srcNode.id,
                  sourceSocketId: outSock.id,
                  targetNodeId: tgtNode.id,
                  targetSocketId: inSock.id,
                  wireType,
                  color,
                  pathD,
                  midpoint: { x: (outPos.x + inPos.x) / 2, y: (outPos.y + inPos.y) / 2 },
                  distance: dist
                });
              }
            }
          });
        });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const claimedOutputs = /* @__PURE__ */ new Set();
    const claimedInputs = /* @__PURE__ */ new Set();
    const filtered = [];
    for (const c of candidates) {
      const outKey = `${c.sourceNodeId}:${c.sourceSocketId}`;
      const inKey = `${c.targetNodeId}:${c.targetSocketId}`;
      if (!claimedOutputs.has(outKey) && !claimedInputs.has(inKey)) {
        claimedOutputs.add(outKey);
        claimedInputs.add(inKey);
        filtered.push(c);
      }
    }
    return filtered;
  }, [nodes, edges, isEnabled, cutoff]);
  const solidifyTrace = useCallback3((traceId) => {
    const trace = traces.find((t) => t.id === traceId);
    if (!trace || !onEdgesChange) return;
    const newEdge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      source: trace.sourceNodeId,
      sourceSocket: trace.sourceSocketId,
      target: trace.targetNodeId,
      targetSocket: trace.targetSocketId,
      wireType: trace.wireType,
      color: trace.color,
      locked: true
    };
    onEdgesChange([...edges, newEdge]);
  }, [traces, edges, onEdgesChange]);
  const solidifyAll = useCallback3(() => {
    if (traces.length === 0 || !onEdgesChange) return;
    const newEdges = traces.map((t, idx) => ({
      id: `edge-${Date.now()}-${idx}`,
      source: t.sourceNodeId,
      sourceSocket: t.sourceSocketId,
      target: t.targetNodeId,
      targetSocket: t.targetSocketId,
      wireType: t.wireType,
      color: t.color,
      locked: true
    }));
    onEdgesChange([...edges, ...newEdges]);
  }, [traces, edges, onEdgesChange]);
  return {
    traces,
    isEnabled,
    solidifyTrace,
    solidifyAll
  };
}

// src/node-graph/ui/ghost/GhostTraceLayer.tsx
import { jsx as jsx8 } from "react/jsx-runtime";
function GhostTraceLayer({ traces, hoveredGhostId }) {
  if (traces.length === 0) return null;
  return /* @__PURE__ */ jsx8(
    "svg",
    {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 3
      },
      children: traces.map((trace) => {
        const isHovered = hoveredGhostId === trace.targetGhostNodeId;
        const color = "var(--skipo-ghost, #00d9ff)";
        return /* @__PURE__ */ jsx8("g", { children: /* @__PURE__ */ jsx8(
          "path",
          {
            d: trace.pathD,
            fill: "none",
            stroke: color,
            strokeWidth: isHovered ? 2.5 : 2,
            strokeDasharray: "6,4",
            opacity: isHovered ? 0.9 : 0.6,
            style: {
              transition: "opacity 0.15s ease, stroke-width 0.15s ease"
            }
          }
        ) }, trace.id);
      })
    }
  );
}

// src/node-graph/ui/ghost/GhostNodeCard.tsx
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
function GhostNodeCard({
  ghostNode,
  isHovered = false,
  onHover,
  onSolidify
}) {
  const width = ghostNode.size.width;
  const height = ghostNode.size.height;
  const ghostColor = "var(--skipo-ghost, #00d9ff)";
  return /* @__PURE__ */ jsxs8(
    "div",
    {
      style: {
        position: "absolute",
        left: ghostNode.position.x,
        top: ghostNode.position.y,
        width,
        height,
        pointerEvents: "auto",
        zIndex: 4,
        userSelect: "none"
      },
      onMouseEnter: () => onHover?.(ghostNode.id),
      onMouseLeave: () => onHover?.(null),
      children: [
        /* @__PURE__ */ jsxs8(
          "div",
          {
            style: {
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              backgroundColor: "rgba(20, 25, 30, 0.75)",
              border: `2px dashed ${ghostColor}`,
              borderRadius: "8px",
              opacity: isHovered ? 0.95 : 0.65,
              display: "flex",
              flexDirection: "column",
              position: "relative",
              transition: "opacity 0.15s ease, box-shadow 0.15s ease",
              boxShadow: isHovered ? "0 0 14px rgba(0, 217, 255, 0.4)" : "none"
            },
            children: [
              /* @__PURE__ */ jsx9(
                "div",
                {
                  style: {
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0.8
                  },
                  children: /* @__PURE__ */ jsx9("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: ghostColor, strokeWidth: "1.8", children: /* @__PURE__ */ jsx9("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }) })
                }
              ),
              /* @__PURE__ */ jsxs8(
                "div",
                {
                  style: {
                    height: "32px",
                    borderTop: "1px dashed rgba(0, 217, 255, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 8px",
                    backgroundColor: "rgba(0, 0, 0, 0.3)"
                  },
                  children: [
                    /* @__PURE__ */ jsx9(
                      "span",
                      {
                        style: {
                          fontSize: "11px",
                          fontWeight: 600,
                          color: ghostColor,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        },
                        children: ghostNode.label
                      }
                    ),
                    onSolidify && /* @__PURE__ */ jsx9(
                      "button",
                      {
                        type: "button",
                        title: "Solidify Node",
                        "aria-label": "Solidify Node",
                        style: {
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          backgroundColor: ghostColor,
                          border: "none",
                          color: "#0b1318",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          pointerEvents: "auto"
                        },
                        onClick: (e) => {
                          e.stopPropagation();
                          onSolidify(ghostNode.id);
                        },
                        children: /* @__PURE__ */ jsx9("svg", { width: "10", height: "10", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsx9("polyline", { points: "20 6 9 17 4 12" }) })
                      }
                    )
                  ]
                }
              )
            ]
          }
        ),
        ghostNode.inputs?.map((s, idx) => /* @__PURE__ */ jsx9(
          "div",
          {
            style: {
              position: "absolute",
              left: 0,
              top: `${(idx + 1) * height / ((ghostNode.inputs?.length ?? 1) + 1)}px`,
              transform: "translate(-50%, -50%)",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: ghostColor,
              border: "1px solid #14191e"
            }
          },
          s.id
        )),
        ghostNode.outputs?.map((s, idx) => /* @__PURE__ */ jsx9(
          "div",
          {
            style: {
              position: "absolute",
              left: "100%",
              top: `${(idx + 1) * height / ((ghostNode.outputs?.length ?? 1) + 1)}px`,
              transform: "translate(-50%, -50%)",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: ghostColor,
              border: "1px solid #14191e"
            }
          },
          s.id
        ))
      ]
    }
  );
}

// src/node-graph/ui/ghost/GhostSolidifyBar.tsx
import { jsx as jsx10, jsxs as jsxs9 } from "react/jsx-runtime";
function GhostSolidifyBar({
  ghostNodes,
  scenarioIndex,
  maxScenarios = 3,
  onCycleScenario,
  onSolidifyAll,
  onDismiss
}) {
  if (ghostNodes.length === 0) return null;
  const minX = Math.min(...ghostNodes.map((n) => n.position.x));
  const minY = Math.min(...ghostNodes.map((n) => n.position.y));
  const barX = minX;
  const barY = Math.max(10, minY - 44);
  const ghostColor = "var(--skipo-ghost, #00d9ff)";
  return /* @__PURE__ */ jsxs9(
    "div",
    {
      style: {
        position: "absolute",
        left: barX,
        top: barY,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 8px",
        backgroundColor: "rgba(20, 25, 30, 0.92)",
        border: "1px solid rgba(0, 217, 255, 0.4)",
        borderRadius: "6px",
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.5)",
        pointerEvents: "auto",
        userSelect: "none"
      },
      onClick: (e) => e.stopPropagation(),
      children: [
        /* @__PURE__ */ jsxs9(
          "button",
          {
            type: "button",
            title: "Cycle Scenario",
            "aria-label": "Cycle Scenario",
            style: {
              background: "none",
              border: "1px solid rgba(0, 217, 255, 0.3)",
              borderRadius: "4px",
              color: ghostColor,
              padding: "2px 6px",
              fontSize: "10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            },
            onClick: onCycleScenario,
            children: [
              /* @__PURE__ */ jsxs9("span", { children: [
                "Branch ",
                scenarioIndex + 1,
                "/",
                maxScenarios
              ] }),
              /* @__PURE__ */ jsx10("svg", { width: "10", height: "10", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: /* @__PURE__ */ jsx10("polyline", { points: "9 18 15 12 9 6" }) })
            ]
          }
        ),
        /* @__PURE__ */ jsxs9(
          "button",
          {
            type: "button",
            title: "Solidify All",
            "aria-label": "Solidify All",
            style: {
              backgroundColor: ghostColor,
              border: "none",
              borderRadius: "4px",
              color: "#0b1318",
              padding: "3px 8px",
              fontSize: "10px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            },
            onClick: onSolidifyAll,
            children: [
              /* @__PURE__ */ jsx10("svg", { width: "11", height: "11", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3", children: /* @__PURE__ */ jsx10("polyline", { points: "20 6 9 17 4 12" }) }),
              /* @__PURE__ */ jsx10("span", { children: "Solidify" })
            ]
          }
        ),
        /* @__PURE__ */ jsx10(
          "button",
          {
            type: "button",
            title: "Dismiss",
            "aria-label": "Dismiss",
            style: {
              background: "none",
              border: "none",
              color: "#888",
              cursor: "pointer",
              padding: "2px 4px",
              display: "flex",
              alignItems: "center"
            },
            onClick: onDismiss,
            children: /* @__PURE__ */ jsxs9("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
              /* @__PURE__ */ jsx10("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
              /* @__PURE__ */ jsx10("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
            ] })
          }
        )
      ]
    }
  );
}

// src/node-graph/ui/widgets/SolidifyWidget.tsx
import { jsx as jsx11 } from "react/jsx-runtime";
function SolidifyWidget({ x, y, onSolidify }) {
  return /* @__PURE__ */ jsx11(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        zIndex: 7,
        pointerEvents: "auto"
      },
      onClick: (e) => e.stopPropagation(),
      children: /* @__PURE__ */ jsx11(
        "button",
        {
          type: "button",
          title: "Solidify Connection",
          "aria-label": "Solidify Connection",
          style: {
            backgroundColor: "var(--skipo-accent, #61afef)",
            border: "1px solid var(--skipo-border, #61afef)",
            borderRadius: "50%",
            width: "22px",
            height: "22px",
            color: "var(--skipo-text, #ffffff)",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.4)",
            transition: "transform 0.1s ease"
          },
          onClick: onSolidify,
          children: /* @__PURE__ */ jsx11("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsx11("polyline", { points: "20 6 9 17 4 12" }) })
        }
      )
    }
  );
}

// src/node-graph/ui/widgets/MagneticTraceLayer.tsx
import { Fragment as Fragment3, jsx as jsx12, jsxs as jsxs10 } from "react/jsx-runtime";
function MagneticTraceLayer({ traces, onSolidify }) {
  if (traces.length === 0) return null;
  return /* @__PURE__ */ jsxs10(Fragment3, { children: [
    /* @__PURE__ */ jsx12("style", { children: `
        @keyframes skipo-magnetic-flow {
          0% { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
      ` }),
    /* @__PURE__ */ jsx12(
      "svg",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          overflow: "visible",
          zIndex: 4
        },
        children: traces.map((trace) => {
          return /* @__PURE__ */ jsxs10("g", { style: { pointerEvents: "auto" }, children: [
            /* @__PURE__ */ jsx12(
              "path",
              {
                d: trace.pathD,
                fill: "none",
                stroke: "transparent",
                strokeWidth: 20,
                style: { cursor: "pointer" },
                onClick: () => onSolidify(trace.id)
              }
            ),
            /* @__PURE__ */ jsx12(
              "path",
              {
                d: trace.pathD,
                fill: "none",
                stroke: trace.color,
                strokeWidth: 5,
                opacity: 0.25
              }
            ),
            /* @__PURE__ */ jsx12(
              "path",
              {
                d: trace.pathD,
                fill: "none",
                stroke: trace.color,
                strokeWidth: 2.2,
                strokeDasharray: "6,4",
                opacity: 0.85,
                style: {
                  animation: "skipo-magnetic-flow 0.8s linear infinite",
                  cursor: "pointer"
                },
                onClick: () => onSolidify(trace.id)
              }
            )
          ] }, trace.id);
        })
      }
    ),
    traces.map((trace) => /* @__PURE__ */ jsx12(
      SolidifyWidget,
      {
        x: trace.midpoint.x,
        y: trace.midpoint.y,
        onSolidify: () => onSolidify(trace.id)
      },
      `widget-${trace.id}`
    ))
  ] });
}

// src/node-graph/NodeGraphCanvas.tsx
import { Fragment as Fragment4, jsx as jsx13, jsxs as jsxs11 } from "react/jsx-runtime";
function NodeGraphCanvas({
  nodes,
  edges,
  viewport,
  config,
  selectedNodeIds,
  availableNodeTypes,
  onNodesChange,
  onEdgesChange,
  onNodeDoubleClick,
  onViewportChange,
  onSelectionChange
}) {
  const containerRef = useRef4(null);
  useEffect3(() => {
    if (!ConnectionRuleStore.isInitialized()) ConnectionRuleStore.initializeDefaults();
  }, []);
  const effectiveNodeTypes = availableNodeTypes && availableNodeTypes.length > 0 ? availableNodeTypes : ConnectionRuleStore.listNodeTypes();
  const magnetic = useMagneticTraces({
    nodes,
    edges,
    config,
    onEdgesChange
  });
  const ghost = useGhostRouting({
    nodes,
    edges,
    selectedNodeIds,
    config,
    availableNodeTypes: effectiveNodeTypes,
    onNodesChange,
    onEdgesChange
  });
  const [isPanning, setIsPanning] = useState8(false);
  const [dragNodeId, setDragNodeId] = useState8(null);
  const nodeMouseDownPos = useRef4(null);
  const hasDraggedNode = useRef4(false);
  const animFrameRef = useRef4(null);
  const smoothPanTo = useCallback4((targetX, targetY) => {
    if (!onViewportChange) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const startX = viewport.panX;
    const startY = viewport.panY;
    const startTime = performance.now();
    const duration = 220;
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      onViewportChange({
        ...viewport,
        panX: Math.round(startX + (targetX - startX) * ease),
        panY: Math.round(startY + (targetY - startY) * ease)
      });
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        animFrameRef.current = null;
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, [viewport, onViewportChange]);
  useEffect3(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);
  const [boxSelection, setBoxSelection] = useState8(null);
  const [connecting, setConnecting] = useState8(null);
  const [pickerState, setPickerState] = useState8(null);
  const [contextMenu, setContextMenu] = useState8(null);
  const [spawnMenuState, setSpawnMenuState] = useState8(null);
  const lastMousePos = useRef4({ screenX: 0, screenY: 0 });
  useEffect3(() => {
    if (!ConnectionRuleStore.isInitialized()) ConnectionRuleStore.initializeDefaults();
  }, []);
  useEffect3(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const activeEl = document.activeElement;
        const isInput = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.getAttribute("contenteditable") === "true");
        if (!isInput) {
          e.preventDefault();
          const rect = containerRef.current?.getBoundingClientRect();
          const screenX = lastMousePos.current.screenX || (rect ? rect.width / 2 : 250);
          const screenY = lastMousePos.current.screenY || (rect ? rect.height / 2 : 200);
          const graphX = (screenX - viewport.panX) / viewport.zoom;
          const graphY = (screenY - viewport.panY) / viewport.zoom;
          setContextMenu(null);
          setPickerState(null);
          setSpawnMenuState({ x: screenX, y: screenY, graphX, graphY });
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        onSelectionChange?.(new Set(nodes.map((n) => n.id)));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeIds.size > 0 && onNodesChange) {
          const remainingNodes = nodes.filter((n) => !selectedNodeIds.has(n.id));
          onNodesChange(remainingNodes);
          onEdgesChange?.(edges.filter((ed) => !selectedNodeIds.has(ed.source) && !selectedNodeIds.has(ed.target)));
          onSelectionChange?.(/* @__PURE__ */ new Set());
        }
      } else if (e.key === "Tab" && ghost.isActive) {
        e.preventDefault();
        ghost.cycleScenario();
      } else if (e.key === "Enter" && e.shiftKey && ghost.isActive) {
        e.preventDefault();
        ghost.solidifyAll();
      } else if (e.key === "Escape") {
        setContextMenu(null);
        setPickerState(null);
        setSpawnMenuState(null);
        setConnecting(null);
        ghost.dismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nodes, edges, selectedNodeIds, viewport, ghost, onNodesChange, onEdgesChange, onSelectionChange]);
  const handleWheel = (e) => {
    e.preventDefault();
    if (!onViewportChange) return;
    const zoomDelta = e.deltaY * -1e-3;
    const minZoom = config?.minZoom ?? 0.25;
    const maxZoom = config?.maxZoom ?? 2.5;
    const newZoom = Math.max(minZoom, Math.min(maxZoom, viewport.zoom + zoomDelta));
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const graphX = (mouseX - viewport.panX) / viewport.zoom;
    const graphY = (mouseY - viewport.panY) / viewport.zoom;
    onViewportChange({ zoom: newZoom, panX: mouseX - graphX * newZoom, panY: mouseY - graphY * newZoom });
  };
  const handleMouseDown = (e) => {
    setContextMenu(null);
    setSpawnMenuState(null);
    if (e.button === 1) {
      setIsPanning(true);
      return;
    }
    if (e.button === 0 && e.target === containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setBoxSelection({ startX: x, startY: y, endX: x, endY: y });
      onSelectionChange?.(/* @__PURE__ */ new Set());
    }
  };
  const handleMouseMove = (e) => {
    if (containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      lastMousePos.current = { screenX: e.clientX - r.left, screenY: e.clientY - r.top };
    }
    if (isPanning && onViewportChange) {
      onViewportChange({ ...viewport, panX: viewport.panX + e.movementX, panY: viewport.panY + e.movementY });
      return;
    }
    if (boxSelection && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setBoxSelection((prev) => prev ? { ...prev, endX: e.clientX - rect.left, endY: e.clientY - rect.top } : null);
      return;
    }
    if (dragNodeId && onNodesChange) {
      if (nodeMouseDownPos.current) {
        const dist = Math.hypot(e.clientX - nodeMouseDownPos.current.x, e.clientY - nodeMouseDownPos.current.y);
        if (dist > 4) {
          hasDraggedNode.current = true;
        }
      }
      const dx = e.movementX / viewport.zoom;
      const dy = e.movementY / viewport.zoom;
      onNodesChange(nodes.map((n) => n.id === dragNodeId ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n));
      return;
    }
    if (connecting && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setConnecting((prev) => prev ? { ...prev, endX: e.clientX - rect.left, endY: e.clientY - rect.top } : null);
    }
  };
  const handleMouseUp = (e) => {
    setIsPanning(false);
    if (nodeMouseDownPos.current && !hasDraggedNode.current) {
      const clickedId = nodeMouseDownPos.current.nodeId;
      const clickedNode = nodes.find((n) => n.id === clickedId);
      if (clickedNode && containerRef.current && onViewportChange) {
        const rect = containerRef.current.getBoundingClientRect();
        if (!isNodeInCenterDeadZone(clickedNode, viewport, rect.width, rect.height)) {
          const targetPan = getCenterPanForNode(clickedNode, viewport, rect.width, rect.height);
          smoothPanTo(targetPan.panX, targetPan.panY);
        }
      }
    }
    if (hasDraggedNode.current && config?.autoSolidify) {
      magnetic.solidifyAll();
    }
    nodeMouseDownPos.current = null;
    hasDraggedNode.current = false;
    setDragNodeId(null);
    if (boxSelection) {
      const selected = getNodesInSelection(boxSelection.startX, boxSelection.startY, boxSelection.endX, boxSelection.endY, nodes, viewport);
      onSelectionChange?.(new Set(selected));
      setBoxSelection(null);
    }
    if (connecting && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const dropY = e.clientY - rect.top;
      const graphX = (dropX - viewport.panX) / viewport.zoom;
      const graphY = (dropY - viewport.panY) / viewport.zoom;
      setPickerState({
        x: dropX,
        y: dropY,
        graphX,
        graphY,
        sourceHandle: { nodeId: connecting.nodeId, socketId: connecting.socketId, direction: connecting.type, dataType: connecting.dataType }
      });
      setConnecting(null);
    }
  };
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setContextMenu({ x, y, graphX: (x - viewport.panX) / viewport.zoom, graphY: (y - viewport.panY) / viewport.zoom });
  };
  const handleNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    if (e.button === 0) {
      nodeMouseDownPos.current = { x: e.clientX, y: e.clientY, nodeId };
      hasDraggedNode.current = false;
      setDragNodeId(nodeId);
      if (e.metaKey || e.ctrlKey) {
        const next = new Set(selectedNodeIds);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        onSelectionChange?.(next);
      } else if (!selectedNodeIds.has(nodeId)) {
        onSelectionChange?.(/* @__PURE__ */ new Set([nodeId]));
      }
    }
  };
  const handleSocketMouseDown = (e, nodeId, socketId, type) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const node = nodes.find((n) => n.id === nodeId);
    const socket = (type === "input" ? node?.inputs : node?.outputs)?.find((s) => s.id === socketId);
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setConnecting({ nodeId, socketId, type, dataType: socket?.dataType, startX: x, startY: y, endX: x, endY: y });
  };
  const handleSocketMouseUp = (e, targetNodeId, targetSocketId, targetType) => {
    e.stopPropagation();
    if (!connecting || connecting.nodeId === targetNodeId || connecting.type === targetType) {
      setConnecting(null);
      return;
    }
    const sourceNode = nodes.find((n) => n.id === connecting.nodeId);
    const targetNode = nodes.find((n) => n.id === targetNodeId);
    const sourceSocket = (connecting.type === "output" ? sourceNode?.outputs : sourceNode?.inputs)?.find((s) => s.id === connecting.socketId);
    const targetSocket = (targetType === "input" ? targetNode?.inputs : targetNode?.outputs)?.find((s) => s.id === targetSocketId);
    const canConnect = ConnectionRuleStore.canConnect(
      { handleCategory: "DATA", dataType: sourceSocket?.dataType || "ANY", direction: connecting.type === "output" ? "OUTPUT" : "INPUT" },
      { handleCategory: "DATA", dataType: targetSocket?.dataType || "ANY", direction: targetType === "input" ? "INPUT" : "OUTPUT" }
    );
    if (canConnect) {
      const isOut = connecting.type === "output";
      const newEdge = {
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: isOut ? connecting.nodeId : targetNodeId,
        sourceSocket: isOut ? connecting.socketId : targetSocketId,
        target: isOut ? targetNodeId : connecting.nodeId,
        targetSocket: isOut ? targetSocketId : connecting.socketId,
        locked: true
      };
      onEdgesChange?.([...edges, newEdge]);
    }
    setConnecting(null);
  };
  const handlePickerSelect = useCallback4((selectedTypes) => {
    if (!pickerState || !onNodesChange) return;
    const { graphX, graphY, sourceHandle } = pickerState;
    const newNodes = [];
    const newEdges = [];
    selectedTypes.forEach((type, idx) => {
      const id = `node-${Date.now()}-${idx}`;
      const posX = graphX + idx * 200;
      const posY = graphY + idx * 40;
      const def = effectiveNodeTypes.find((d) => d.type === type) || ConnectionRuleStore.getNodeType(type);
      const isSourceOut = sourceHandle.direction === "output";
      const inputs = def?.inputs?.map((i) => ({ id: i.id, label: i.label || i.id, type: "input", dataType: i.dataType })) ?? [{ id: "in-1", label: "In", type: "input", dataType: sourceHandle.dataType || "ANY" }];
      const outputs = def?.outputs?.map((o) => ({ id: o.id, label: o.label || o.id, type: "output", dataType: o.dataType })) ?? [{ id: "out-1", label: "Out", type: "output", dataType: sourceHandle.dataType || "ANY" }];
      newNodes.push({ id, type, label: def?.label || type, position: { x: posX, y: posY }, inputs, outputs });
      const targetSocket = isSourceOut ? inputs[0] : outputs[0];
      if (targetSocket) {
        newEdges.push({
          id: `edge-${Date.now()}-${idx}`,
          source: isSourceOut ? sourceHandle.nodeId : id,
          sourceSocket: isSourceOut ? sourceHandle.socketId : targetSocket.id,
          target: isSourceOut ? id : sourceHandle.nodeId,
          targetSocket: isSourceOut ? targetSocket.id : sourceHandle.socketId,
          locked: true
        });
      }
    });
    onNodesChange([...nodes, ...newNodes]);
    if (newEdges.length > 0) onEdgesChange?.([...edges, ...newEdges]);
    setPickerState(null);
  }, [pickerState, nodes, edges, effectiveNodeTypes, onNodesChange, onEdgesChange]);
  const handleSocketNudgeChange = (nodeId, socketId, nudge) => {
    if (!onNodesChange) return;
    const updatedNodes = nodes.map((n) => {
      if (n.id !== nodeId) return n;
      const updateList = (list) => list?.map((s) => s.id === socketId ? { ...s, offset: nudge } : s);
      return {
        ...n,
        inputs: updateList(n.inputs),
        outputs: updateList(n.outputs)
      };
    });
    onNodesChange(updatedNodes);
  };
  const nodesData = nodes.reduce((acc, node) => {
    const p = canvasToScreen(node.position.x, node.position.y, viewport);
    acc[node.id] = {
      x: p.x,
      y: p.y,
      width: (node.width ?? 150) * viewport.zoom,
      height: (node.minimized ? 40 : node.height ?? 100) * viewport.zoom,
      inputs: node.inputs || [],
      outputs: node.outputs || [],
      zoom: viewport.zoom
    };
    return acc;
  }, {});
  return /* @__PURE__ */ jsxs11(
    "div",
    {
      ref: containerRef,
      style: { width: "100%", height: "100%", position: "relative", overflow: "hidden", backgroundColor: "var(--skipo-surface-dark, #181a1f)" },
      onWheel: handleWheel,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onContextMenu: handleContextMenu,
      children: [
        /* @__PURE__ */ jsx13(
          WireRenderer,
          {
            edges,
            nodesData,
            onDeleteEdge: (edgeId) => onEdgesChange?.(edges.filter((e) => e.id !== edgeId)),
            connecting: connecting ? { startX: connecting.startX, startY: connecting.startY, endX: connecting.endX, endY: connecting.endY } : null
          }
        ),
        /* @__PURE__ */ jsxs11("div", { style: { position: "absolute", top: 0, left: 0, transformOrigin: "0 0", transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` }, children: [
          magnetic.isEnabled && /* @__PURE__ */ jsx13(MagneticTraceLayer, { traces: magnetic.traces, onSolidify: magnetic.solidifyTrace }),
          ghost.isActive && /* @__PURE__ */ jsxs11(Fragment4, { children: [
            /* @__PURE__ */ jsx13(GhostTraceLayer, { traces: ghost.activeGhostTraces, hoveredGhostId: ghost.hoveredGhostId }),
            ghost.activeGhostNodes.map((g) => /* @__PURE__ */ jsx13(
              GhostNodeCard,
              {
                ghostNode: g,
                isHovered: ghost.hoveredGhostId === g.id,
                onHover: ghost.setHoveredGhostId,
                onSolidify: ghost.solidifyOne
              },
              g.id
            )),
            /* @__PURE__ */ jsx13(
              GhostSolidifyBar,
              {
                ghostNodes: ghost.activeGhostNodes,
                scenarioIndex: ghost.scenarioIndex,
                maxScenarios: config?.ghostScenarioCount ?? 3,
                onCycleScenario: ghost.cycleScenario,
                onSolidifyAll: ghost.solidifyAll,
                onDismiss: ghost.dismiss
              }
            )
          ] }),
          nodes.map((node) => /* @__PURE__ */ jsx13(
            NodeCard,
            {
              node,
              selected: selectedNodeIds.has(node.id),
              onMouseDown: handleNodeMouseDown,
              onDoubleClick: onNodeDoubleClick,
              onSocketMouseDown: handleSocketMouseDown,
              onSocketMouseUp: handleSocketMouseUp,
              onSocketNudgeChange: handleSocketNudgeChange,
              onToggleMinimize: (nodeId, isMin) => {
                onNodesChange?.(nodes.map((n) => n.id === nodeId ? { ...n, minimized: isMin } : n));
              }
            },
            node.id
          ))
        ] }),
        boxSelection && /* @__PURE__ */ jsx13("div", { style: { position: "absolute", left: Math.min(boxSelection.startX, boxSelection.endX), top: Math.min(boxSelection.startY, boxSelection.endY), width: Math.abs(boxSelection.endX - boxSelection.startX), height: Math.abs(boxSelection.endY - boxSelection.startY), backgroundColor: "rgba(97, 175, 239, 0.18)", border: "1px solid var(--skipo-accent, #61afef)", pointerEvents: "none" } }),
        pickerState && /* @__PURE__ */ jsx13(CompatibleNodePicker, { x: pickerState.x, y: pickerState.y, sourceHandle: pickerState.sourceHandle, availableNodeTypes: effectiveNodeTypes, onSelect: handlePickerSelect, onClose: () => setPickerState(null) }),
        contextMenu && /* @__PURE__ */ jsx13(
          CanvasContextMenu,
          {
            x: contextMenu.x,
            y: contextMenu.y,
            availableNodeTypes: effectiveNodeTypes,
            hasSelection: selectedNodeIds.size > 0,
            onSpawnNode: (type) => {
              const def = effectiveNodeTypes.find((d) => d.type === type) || ConnectionRuleStore.getNodeType(type);
              const id = `node-${Date.now()}`;
              const inputs = def?.inputs?.map((i) => ({ id: i.id, label: i.label || i.id, type: "input", dataType: i.dataType })) ?? [{ id: "in-1", label: "In", type: "input" }];
              const outputs = def?.outputs?.map((o) => ({ id: o.id, label: o.label || o.id, type: "output", dataType: o.dataType })) ?? [{ id: "out-1", label: "Out", type: "output" }];
              onNodesChange?.([...nodes, { id, type, label: def?.label || type, position: { x: contextMenu.graphX, y: contextMenu.graphY }, inputs, outputs }]);
            },
            onOpenSpawnMenu: () => {
              setSpawnMenuState({
                x: contextMenu.x,
                y: contextMenu.y,
                graphX: contextMenu.graphX,
                graphY: contextMenu.graphY
              });
            },
            onSelectAll: () => onSelectionChange?.(new Set(nodes.map((n) => n.id))),
            onDeleteSelected: () => {
              onNodesChange?.(nodes.filter((n) => !selectedNodeIds.has(n.id)));
              onEdgesChange?.(edges.filter((ed) => !selectedNodeIds.has(ed.source) && !selectedNodeIds.has(ed.target)));
              onSelectionChange?.(/* @__PURE__ */ new Set());
            },
            onClearSelection: () => onSelectionChange?.(/* @__PURE__ */ new Set()),
            onClose: () => setContextMenu(null)
          }
        ),
        spawnMenuState && /* @__PURE__ */ jsx13(
          NodeSearchPalette,
          {
            x: spawnMenuState.x,
            y: spawnMenuState.y,
            availableNodeTypes: effectiveNodeTypes,
            onSpawnNode: (type) => {
              const def = effectiveNodeTypes.find((d) => d.type === type) || ConnectionRuleStore.getNodeType(type);
              const id = `node-${Date.now()}`;
              const inputs = def?.inputs?.map((i) => ({ id: i.id, label: i.label || i.id, type: "input", dataType: i.dataType })) ?? [{ id: "in-1", label: "In", type: "input" }];
              const outputs = def?.outputs?.map((o) => ({ id: o.id, label: o.label || o.id, type: "output", dataType: o.dataType })) ?? [{ id: "out-1", label: "Out", type: "output" }];
              onNodesChange?.([...nodes, { id, type, label: def?.label || type, position: { x: spawnMenuState.graphX, y: spawnMenuState.graphY }, inputs, outputs }]);
              setSpawnMenuState(null);
            },
            onClose: () => setSpawnMenuState(null)
          }
        )
      ]
    }
  );
}

// src/node-graph/NodeDetailsPanel.tsx
import { FloatingDetailsPanel, BaseInput as BaseInput3, BaseBadge } from "@skipo/ui";
import { jsx as jsx14, jsxs as jsxs12 } from "react/jsx-runtime";
function renderSockets(sockets, type) {
  if (!sockets || sockets.length === 0) return null;
  return /* @__PURE__ */ jsxs12("div", { style: { marginBottom: "12px" }, children: [
    /* @__PURE__ */ jsxs12("div", { style: { fontSize: "11px", color: "var(--skipo-text-muted)", marginBottom: "4px", textTransform: "uppercase" }, children: [
      type,
      " Sockets (",
      sockets.length,
      ")"
    ] }),
    /* @__PURE__ */ jsx14("div", { style: { display: "flex", flexDirection: "column", gap: "4px" }, children: sockets.map((s) => /* @__PURE__ */ jsxs12("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", background: "var(--skipo-surface)", borderRadius: "var(--skipo-radius-sm)", fontSize: "12px" }, children: [
      /* @__PURE__ */ jsx14("span", { children: s.label || s.id }),
      s.dataType && /* @__PURE__ */ jsx14(BaseBadge, { variant: "neutral", children: s.dataType })
    ] }, s.id)) })
  ] });
}
function renderNodeContent(node, onUpdateNode) {
  return /* @__PURE__ */ jsxs12("div", { style: { display: "flex", flexDirection: "column", gap: "12px" }, children: [
    /* @__PURE__ */ jsxs12("div", { children: [
      /* @__PURE__ */ jsx14("label", { style: { display: "block", fontSize: "11px", color: "var(--skipo-text-muted)", marginBottom: "4px" }, children: "Label" }),
      /* @__PURE__ */ jsx14(
        BaseInput3,
        {
          value: node.label,
          onChange: (e) => onUpdateNode?.(node.id, { label: e.target.value })
        }
      )
    ] }),
    /* @__PURE__ */ jsx14("div", { style: { display: "flex", gap: "16px", fontSize: "12px", color: "var(--skipo-text-muted)" }, children: /* @__PURE__ */ jsxs12("div", { children: [
      "Position: X: ",
      Math.round(node.position.x),
      ", Y: ",
      Math.round(node.position.y)
    ] }) }),
    renderSockets(node.inputs, "Input"),
    renderSockets(node.outputs, "Output"),
    node.data && Object.keys(node.data).length > 0 && /* @__PURE__ */ jsxs12("div", { children: [
      /* @__PURE__ */ jsx14("div", { style: { fontSize: "11px", color: "var(--skipo-text-muted)", marginBottom: "4px", textTransform: "uppercase" }, children: "Custom Data" }),
      /* @__PURE__ */ jsx14("pre", { style: { margin: 0, padding: "8px", background: "var(--skipo-surface)", borderRadius: "var(--skipo-radius-sm)", fontSize: "11px", color: "var(--skipo-text)", overflowX: "auto" }, children: JSON.stringify(node.data, null, 2) })
    ] })
  ] });
}
function NodeDetailsPanel({
  node,
  isOpen,
  onClose,
  isPinned = false,
  onTogglePin,
  onUpdateNode,
  storageKey = "skipo:node-graph:details-panel"
}) {
  if (!isOpen || !node) return null;
  return /* @__PURE__ */ jsx14(
    FloatingDetailsPanel,
    {
      title: node.label || "Node Details",
      subtitle: `Type: ${node.type} \u2022 ID: ${node.id}`,
      isOpen,
      onClose,
      isPinned,
      onTogglePin,
      storageKey,
      children: renderNodeContent(node, onUpdateNode)
    }
  );
}

// src/node-graph/domain/BaseHandle.ts
var BaseHandle = class {
  id;
  nodeId;
  direction;
  dataType;
  connectionMode;
  basePosition;
  offset;
  label;
  constructor(props) {
    this.id = props.id;
    this.nodeId = props.nodeId;
    this.direction = props.direction;
    this.dataType = props.dataType;
    this.connectionMode = props.connectionMode ?? "SINGLE";
    this.basePosition = props.basePosition ?? { x: 0, y: 0 };
    this.offset = props.offset ?? { x: 0, y: 0 };
    this.label = props.label;
  }
  get effectivePosition() {
    return {
      x: this.basePosition.x + this.offset.x,
      y: this.basePosition.y + this.offset.y
    };
  }
};
var DataHandle = class extends BaseHandle {
  handleCategory = "DATA";
};
var ViewHandle = class extends BaseHandle {
  handleCategory = "VIEW";
  icon = "EYE";
  constructor(props) {
    super({
      ...props,
      direction: props.direction ?? "OUTPUT",
      dataType: props.dataType ?? "VIEW"
    });
  }
};

// src/node-graph/domain/BaseNode.ts
var BaseNode = class {
  id;
  type;
  label;
  position;
  size;
  handles;
  state;
  metadata;
  settings;
  positionLocked;
  minimized;
  constructor(props) {
    this.id = props.id;
    this.type = props.type;
    this.label = props.label ?? props.type;
    this.position = { ...props.position };
    this.size = props.size ?? { width: 180, height: 120 };
    this.handles = props.handles ? [...props.handles] : [];
    this.state = props.state ? { ...props.state } : {};
    this.metadata = props.metadata ? { ...props.metadata } : {};
    this.settings = props.settings ? { ...props.settings } : {};
    this.positionLocked = props.positionLocked ?? false;
    this.minimized = props.minimized ?? false;
  }
  getHandle(handleId) {
    return this.handles.find((h) => h.id === handleId);
  }
  addHandle(handle) {
    const existingIndex = this.handles.findIndex((h) => h.id === handle.id);
    if (existingIndex >= 0) {
      this.handles[existingIndex] = handle;
    } else {
      this.handles.push(handle);
    }
  }
  lockPosition() {
    this.positionLocked = true;
  }
  unlockPosition() {
    this.positionLocked = false;
  }
};
var CustomNode = class extends BaseNode {
  customDefinition;
};

// src/node-graph/domain/BaseConnection.ts
var BaseConnection = class {
  id;
  sourceNodeId;
  sourceHandleId;
  targetNodeId;
  targetHandleId;
  constructor(props) {
    this.id = props.id;
    this.sourceNodeId = props.sourceNodeId;
    this.sourceHandleId = props.sourceHandleId;
    this.targetNodeId = props.targetNodeId;
    this.targetHandleId = props.targetHandleId;
  }
};
var SolidConnection = class extends BaseConnection {
  wireType;
  locked;
  lastSignal;
  widgets;
  constructor(props) {
    super(props);
    this.wireType = props.wireType ?? "DEFAULT";
    this.locked = props.locked ?? false;
    this.lastSignal = props.lastSignal;
    this.widgets = props.widgets ?? ["DELETE", "INSPECT", "LOCK"];
  }
  toggleLock() {
    this.locked = !this.locked;
    return this.locked;
  }
};
var ViewLink = class extends BaseConnection {
  sourceViewHandleId;
  targetViewWindowId;
  widgets = [];
  constructor(props) {
    super({
      id: props.id,
      sourceNodeId: props.sourceNodeId,
      sourceHandleId: props.sourceViewHandleId,
      targetNodeId: props.targetViewWindowId,
      targetHandleId: "window-in"
    });
    this.sourceViewHandleId = props.sourceViewHandleId;
    this.targetViewWindowId = props.targetViewWindowId;
  }
};

// src/node-graph/domain/BaseViewWindow.ts
var BaseViewWindow = class {
  id;
  viewType;
  sourceNodeId;
  position;
  size;
  selected;
  pinnedLive;
  snapshot;
  constructor(props) {
    this.id = props.id;
    this.viewType = props.viewType;
    this.sourceNodeId = props.sourceNodeId;
    this.position = { ...props.position };
    this.size = props.size ?? { width: 480, height: 360 };
    this.selected = props.selected ?? false;
    this.pinnedLive = props.pinnedLive ?? false;
    this.snapshot = props.snapshot;
  }
  get dynamicState() {
    if (this.pinnedLive) return "PINNED_LIVE";
    return this.selected ? "ACTIVE" : "INACTIVE";
  }
  setPinnedLive(pinned) {
    this.pinnedLive = pinned;
  }
  setSelected(selected) {
    this.selected = selected;
  }
  captureSnapshot(data) {
    this.snapshot = data;
  }
};
var CustomViewWindow = class extends BaseViewWindow {
  appSpecificContent;
};

// src/node-graph/domain/BaseGraph.ts
var DEFAULT_GRAPH_SETTINGS = {
  tracingEnabled: true,
  autoSolidify: false,
  traceCutoffDistance: 250,
  attractionEnabled: false,
  attractionSpeed: 1,
  attractionStrength: 1
};
var BaseGraph = class {
  id;
  type;
  nodes;
  connections;
  groups;
  viewWindows;
  landmarks;
  views;
  settings;
  theme;
  constructor(id, type = "default") {
    this.id = id;
    this.type = type;
    this.nodes = [];
    this.connections = [];
    this.groups = [];
    this.viewWindows = [];
    this.landmarks = [];
    this.views = [];
    this.settings = { ...DEFAULT_GRAPH_SETTINGS };
    this.theme = "default";
  }
};
var CustomGraph = class extends BaseGraph {
  customGraphDefinition;
};

// src/node-graph/spatial/SpatialEngine.ts
var SpatialEngine = class {
  static calculateEffectiveHandlePosition(node, handle) {
    let baseX = handle.basePosition.x;
    if (baseX === 0 && node.size?.width) {
      baseX = handle.direction === "OUTPUT" ? node.size.width / 2 + 12 : -(node.size.width / 2) - 12;
    }
    return {
      x: node.position.x + baseX + handle.offset.x,
      y: node.position.y + handle.basePosition.y + handle.offset.y
    };
  }
  static calculateDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  static calculateOffsetMagnitude(handle) {
    return Math.sqrt(handle.offset.x * handle.offset.x + handle.offset.y * handle.offset.y);
  }
};

// src/node-graph/spatial/TraceEngine.ts
var TraceEngine = class {
  static computeTraces(nodes, cutoffDistance) {
    const traces = [];
    const outputPairs = [];
    const inputPairs = [];
    for (const node of nodes) {
      for (const handle of node.handles) {
        if (handle.handleCategory !== "DATA") continue;
        if (handle.direction === "OUTPUT") {
          outputPairs.push({ node, handle });
        } else if (handle.direction === "INPUT") {
          inputPairs.push({ node, handle });
        }
      }
    }
    for (const out of outputPairs) {
      const outPos = SpatialEngine.calculateEffectiveHandlePosition(out.node, out.handle);
      for (const inp of inputPairs) {
        if (out.node.id === inp.node.id) continue;
        const resolution = CompatibilityMatrix.resolve(out.handle, inp.handle);
        if (!resolution.allowed) continue;
        const inpPos = SpatialEngine.calculateEffectiveHandlePosition(inp.node, inp.handle);
        const distance = SpatialEngine.calculateDistance(outPos, inpPos);
        if (distance <= cutoffDistance) {
          traces.push({
            id: `trace-${out.handle.id}->${inp.handle.id}`,
            sourceNodeId: out.node.id,
            sourceHandleId: out.handle.id,
            targetNodeId: inp.node.id,
            targetHandleId: inp.handle.id,
            wireType: resolution.wireType ?? "DEFAULT",
            compatibility: resolution,
            spatialScore: distance
          });
        }
      }
    }
    return traces;
  }
};

// src/node-graph/spatial/AutoSolidify.ts
var AutoSolidify = class {
  static resolve(nodes, traces, existingConnections) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const lockedConnections = existingConnections.filter((c) => c.locked);
    const resultConnections = [...lockedConnections];
    const lockedEndpoints = /* @__PURE__ */ new Set();
    for (const c of lockedConnections) {
      lockedEndpoints.add(`out:${c.sourceNodeId}:${c.sourceHandleId}`);
      lockedEndpoints.add(`in:${c.targetNodeId}:${c.targetHandleId}`);
    }
    const candidates = [];
    for (const trace of traces) {
      const sourceNode = nodeMap.get(trace.sourceNodeId);
      const targetNode = nodeMap.get(trace.targetNodeId);
      if (!sourceNode || !targetNode) continue;
      const sourceHandle = sourceNode.getHandle(trace.sourceHandleId);
      const targetHandle = targetNode.getHandle(trace.targetHandleId);
      if (!sourceHandle || !targetHandle) continue;
      const outKey = `out:${sourceNode.id}:${sourceHandle.id}`;
      const inKey = `in:${targetNode.id}:${targetHandle.id}`;
      if (lockedEndpoints.has(outKey) || lockedEndpoints.has(inKey)) {
        continue;
      }
      const offsetDist = SpatialEngine.calculateOffsetMagnitude(sourceHandle) + SpatialEngine.calculateOffsetMagnitude(targetHandle);
      candidates.push({
        trace,
        sourceNode,
        targetNode,
        exactDistance: trace.spatialScore,
        offsetDistance: offsetDist
      });
    }
    candidates.sort((a, b) => {
      if (Math.abs(a.exactDistance - b.exactDistance) > 1e-4) {
        return a.exactDistance - b.exactDistance;
      }
      if (Math.abs(a.offsetDistance - b.offsetDistance) > 1e-4) {
        return a.offsetDistance - b.offsetDistance;
      }
      const sComp = a.sourceNode.id.localeCompare(b.sourceNode.id);
      if (sComp !== 0) return sComp;
      return a.targetNode.id.localeCompare(b.targetNode.id);
    });
    const claimedOutputs = /* @__PURE__ */ new Set();
    const claimedInputs = /* @__PURE__ */ new Set();
    for (const cand of candidates) {
      const sHandle = cand.sourceNode.getHandle(cand.trace.sourceHandleId);
      const tHandle = cand.targetNode.getHandle(cand.trace.targetHandleId);
      const outKey = `${cand.sourceNode.id}:${sHandle.id}`;
      const inKey = `${cand.targetNode.id}:${tHandle.id}`;
      const outAvailable = sHandle.connectionMode === "MULTI" || !claimedOutputs.has(outKey);
      const inAvailable = tHandle.connectionMode === "MULTI" || !claimedInputs.has(inKey);
      if (outAvailable && inAvailable) {
        claimedOutputs.add(outKey);
        claimedInputs.add(inKey);
        resultConnections.push(new SolidConnection({
          id: `conn-${cand.sourceNode.id}-${sHandle.id}-${cand.targetNode.id}-${tHandle.id}`,
          sourceNodeId: cand.sourceNode.id,
          sourceHandleId: sHandle.id,
          targetNodeId: cand.targetNode.id,
          targetHandleId: tHandle.id,
          wireType: cand.trace.wireType,
          locked: false
        }));
      }
    }
    return resultConnections;
  }
};

// src/node-graph/spatial/AttractionEngine.ts
var AttractionEngine = class {
  static computeSimilarity(nodeA, nodeB) {
    if (nodeA.id === nodeB.id) return 1;
    let score = 0;
    let factors = 0;
    factors += 1;
    if (nodeA.type === nodeB.type) {
      score += 1;
    }
    factors += 1;
    const inTypesA = new Set(nodeA.handles.filter((h) => h.direction === "INPUT").map((h) => h.dataType));
    const inTypesB = new Set(nodeB.handles.filter((h) => h.direction === "INPUT").map((h) => h.dataType));
    const sharedIn = [...inTypesA].filter((t) => inTypesB.has(t)).length;
    const totalIn = Math.max(1, (/* @__PURE__ */ new Set([...inTypesA, ...inTypesB])).size);
    score += sharedIn / totalIn;
    factors += 1;
    const outTypesA = new Set(nodeA.handles.filter((h) => h.direction === "OUTPUT").map((h) => h.dataType));
    const outTypesB = new Set(nodeB.handles.filter((h) => h.direction === "OUTPUT").map((h) => h.dataType));
    const sharedOut = [...outTypesA].filter((t) => outTypesB.has(t)).length;
    const totalOut = Math.max(1, (/* @__PURE__ */ new Set([...outTypesA, ...outTypesB])).size);
    score += sharedOut / totalOut;
    return factors > 0 ? score / factors : 0;
  }
  static calculateStep(nodes, strength = 1, speed = 1) {
    const updatedPositions = /* @__PURE__ */ new Map();
    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i];
      if (nodeA.positionLocked) {
        updatedPositions.set(nodeA.id, { ...nodeA.position });
        continue;
      }
      let forceX = 0;
      let forceY = 0;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const nodeB = nodes[j];
        const similarity = this.computeSimilarity(nodeA, nodeB);
        if (similarity <= 0.1) continue;
        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const dist = Math.max(20, Math.sqrt(dx * dx + dy * dy));
        const f = similarity * strength * speed;
        forceX += dx / dist * f;
        forceY += dy / dist * f;
      }
      updatedPositions.set(nodeA.id, {
        x: nodeA.position.x + forceX,
        y: nodeA.position.y + forceY
      });
    }
    return updatedPositions;
  }
};

// src/node-graph/management/GroupSettingsResolver.ts
var GroupSettingsResolver = class {
  static resolveEffectiveSetting(settingKey, rootSettings, targetOverrides, groupId, groups = []) {
    if (targetOverrides && targetOverrides[settingKey] !== void 0) {
      return targetOverrides[settingKey];
    }
    if (groupId) {
      const groupMap = new Map(groups.map((g) => [g.id, g]));
      let currentGroup = groupMap.get(groupId);
      while (currentGroup) {
        if (currentGroup.settingsOverrides && currentGroup.settingsOverrides[settingKey] !== void 0) {
          return currentGroup.settingsOverrides[settingKey];
        }
        currentGroup = groups.find((g) => g.childGroups && g.childGroups.includes(currentGroup.id));
      }
    }
    return rootSettings[settingKey];
  }
  static resolveAllSettings(rootSettings, targetOverrides, groupId, groups = []) {
    const keys = Object.keys(rootSettings);
    const resolved = {};
    for (const key of keys) {
      resolved[key] = this.resolveEffectiveSetting(key, rootSettings, targetOverrides, groupId, groups);
    }
    return resolved;
  }
};

// src/node-graph/management/LandmarkManager.ts
var LandmarkManager = class {
  landmarks = /* @__PURE__ */ new Map();
  constructor(initialLandmarks = []) {
    for (const lm of initialLandmarks) {
      this.landmarks.set(lm.id, { ...lm });
    }
  }
  createLandmark(number, name, cameraPosition, zoom) {
    const id = `landmark-${number}-${Date.now()}`;
    const landmark = { id, number, name, cameraPosition: { ...cameraPosition }, zoom };
    this.landmarks.set(id, landmark);
    return landmark;
  }
  getByNumber(number) {
    return Array.from(this.landmarks.values()).find((lm) => lm.number === number);
  }
  getById(id) {
    return this.landmarks.get(id);
  }
  updateLandmark(id, updates) {
    const lm = this.landmarks.get(id);
    if (!lm) return void 0;
    const updated = { ...lm, ...updates };
    this.landmarks.set(id, updated);
    return updated;
  }
  deleteLandmark(id) {
    return this.landmarks.delete(id);
  }
  list() {
    return Array.from(this.landmarks.values()).sort((a, b) => a.number - b.number);
  }
  clear() {
    this.landmarks.clear();
  }
};

// src/node-graph/management/ViewEngine.ts
var ViewEngine = class {
  views = /* @__PURE__ */ new Map();
  constructor(initialViews = []) {
    for (const v of initialViews) {
      this.views.set(v.id, { ...v });
    }
  }
  captureView(params) {
    const nodePositions = {};
    const nodeSizes = {};
    const handleOffsets = {};
    for (const n of params.nodes) {
      nodePositions[n.id] = { ...n.position };
      nodeSizes[n.id] = { ...n.size };
      for (const h of n.handles) {
        if (h.offset.x !== 0 || h.offset.y !== 0) {
          handleOffsets[`${n.id}:${h.id}`] = { ...h.offset };
        }
      }
    }
    const viewWindowsData = params.viewWindows.map((vw) => ({
      id: vw.id,
      viewType: vw.viewType,
      sourceNodeId: vw.sourceNodeId,
      position: { ...vw.position },
      size: { ...vw.size },
      pinnedLive: vw.pinnedLive
    }));
    const id = params.id ?? `view-${Date.now()}`;
    const graphView = {
      id,
      name: params.name,
      nodePositions,
      nodeSizes,
      handleOffsets,
      groupStates: {},
      viewWindows: viewWindowsData,
      camera: { ...params.camera },
      zoom: params.zoom,
      selectedNodes: [...params.selectedNodeIds],
      graphSettingsOverrides: params.settingsOverrides ? { ...params.settingsOverrides } : {}
    };
    this.views.set(id, graphView);
    return graphView;
  }
  getView(id) {
    return this.views.get(id);
  }
  listViews() {
    return Array.from(this.views.values());
  }
  deleteView(id) {
    return this.views.delete(id);
  }
};

// src/node-graph/management/ViewWindowManager.ts
var ViewWindowManager = class {
  windows = /* @__PURE__ */ new Map();
  links = /* @__PURE__ */ new Map();
  createWindow(params) {
    const id = params.id ?? `vw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const window2 = new CustomViewWindow({
      id,
      viewType: params.viewType,
      sourceNodeId: params.sourceNodeId,
      position: params.position,
      size: params.size,
      selected: true,
      pinnedLive: false
    });
    const link = new ViewLink({
      id: `vlink-${params.sourceNodeId}-${id}`,
      sourceNodeId: params.sourceNodeId,
      sourceViewHandleId: params.sourceViewHandleId,
      targetViewWindowId: id
    });
    this.selectWindow(id);
    this.windows.set(id, window2);
    this.links.set(id, link);
    return { window: window2, link };
  }
  selectWindow(id) {
    for (const [wId, win] of this.windows) {
      win.setSelected(wId === id);
    }
  }
  pinLive(id, pinned) {
    const win = this.windows.get(id);
    if (win) {
      win.setPinnedLive(pinned);
    }
  }
  removeWindow(id) {
    this.links.delete(id);
    return this.windows.delete(id);
  }
  getProcessingWindows() {
    return Array.from(this.windows.values()).filter(
      (w) => w.dynamicState === "ACTIVE" || w.dynamicState === "PINNED_LIVE"
    );
  }
  getWindow(id) {
    return this.windows.get(id);
  }
  getLink(windowId) {
    return this.links.get(windowId);
  }
  listWindows() {
    return Array.from(this.windows.values());
  }
  listLinks() {
    return Array.from(this.links.values());
  }
};

// src/node-graph/store/GraphStore.ts
var GraphStore = class {
  nodes = [];
  connections = [];
  traces = [];
  groups = [];
  settings = { ...DEFAULT_GRAPH_SETTINGS };
  selectedNodeIds = /* @__PURE__ */ new Set();
  viewWindows = new ViewWindowManager();
  landmarks = new LandmarkManager();
  views = new ViewEngine();
  listeners = /* @__PURE__ */ new Set();
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
  refreshTraces() {
    if (!this.settings.tracingEnabled) {
      this.traces = [];
      this.notify();
      return;
    }
    this.traces = TraceEngine.computeTraces(this.nodes, this.settings.traceCutoffDistance);
    if (this.settings.autoSolidify) {
      this.connections = AutoSolidify.resolve(this.nodes, this.traces, this.connections);
    }
    this.notify();
  }
  solidifyTrace(traceId) {
    const trace = this.traces.find((t) => t.id === traceId);
    if (!trace) return void 0;
    const sourceNode = this.nodes.find((n) => n.id === trace.sourceNodeId);
    const targetNode = this.nodes.find((n) => n.id === trace.targetNodeId);
    if (!sourceNode || !targetNode) return void 0;
    const conn = new SolidConnection({
      id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceNodeId: trace.sourceNodeId,
      sourceHandleId: trace.sourceHandleId,
      targetNodeId: trace.targetNodeId,
      targetHandleId: trace.targetHandleId,
      wireType: trace.wireType
    });
    this.connections.push(conn);
    this.refreshTraces();
    return conn;
  }
  lockAllConnections() {
    for (const conn of this.connections) {
      conn.locked = true;
    }
    this.notify();
  }
};

// src/node-graph/store/CommandApi.ts
var CommandApi = class {
  constructor(store) {
    this.store = store;
  }
  store;
  get nodes() {
    return {
      create: (props) => {
        const node = new CustomNode(props);
        this.store.nodes.push(node);
        this.store.refreshTraces();
        return node;
      },
      delete: (nodeId) => {
        this.store.nodes = this.store.nodes.filter((n) => n.id !== nodeId);
        this.store.connections = this.store.connections.filter(
          (c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
        );
        this.store.selectedNodeIds.delete(nodeId);
        this.store.refreshTraces();
      },
      move: (nodeId, x, y) => {
        const node = this.store.nodes.find((n) => n.id === nodeId);
        if (node && !node.positionLocked) {
          node.position = { x, y };
          this.store.refreshTraces();
        }
      },
      lockPosition: (nodeId) => {
        const node = this.store.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.lockPosition();
          this.store.notify();
        }
      },
      unlockPosition: (nodeId) => {
        const node = this.store.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.unlockPosition();
          this.store.notify();
        }
      }
    };
  }
  get handles() {
    return {
      move: (nodeId, handleId, offset) => {
        const node = this.store.nodes.find((n) => n.id === nodeId);
        const handle = node?.getHandle(handleId);
        if (handle) {
          handle.offset = { ...offset };
          this.store.refreshTraces();
        }
      },
      resetOffset: (nodeId, handleId) => {
        const node = this.store.nodes.find((n) => n.id === nodeId);
        const handle = node?.getHandle(handleId);
        if (handle) {
          handle.offset = { x: 0, y: 0 };
          this.store.refreshTraces();
        }
      }
    };
  }
  get traces() {
    return {
      refresh: () => this.store.refreshTraces(),
      enable: () => {
        this.store.settings.tracingEnabled = true;
        this.store.refreshTraces();
      },
      disable: () => {
        this.store.settings.tracingEnabled = false;
        this.store.refreshTraces();
      },
      solidify: (traceId) => this.store.solidifyTrace(traceId)
    };
  }
  get connections() {
    return {
      create: (sourceNodeId, sourceHandleId, targetNodeId, targetHandleId, wireType) => {
        const conn = new SolidConnection({
          id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sourceNodeId,
          sourceHandleId,
          targetNodeId,
          targetHandleId,
          wireType
        });
        this.store.connections.push(conn);
        this.store.refreshTraces();
        return conn;
      },
      delete: (connectionId) => {
        this.store.connections = this.store.connections.filter((c) => c.id !== connectionId);
        this.store.refreshTraces();
      },
      lock: (connectionId) => {
        const conn = this.store.connections.find((c) => c.id === connectionId);
        if (conn) {
          conn.locked = true;
          this.store.notify();
        }
      },
      unlock: (connectionId) => {
        const conn = this.store.connections.find((c) => c.id === connectionId);
        if (conn) {
          conn.locked = false;
          this.store.notify();
        }
      },
      lockAll: () => this.store.lockAllConnections()
    };
  }
  get groups() {
    return {
      create: (group) => {
        this.store.groups.push(group);
        this.store.notify();
      },
      delete: (groupId) => {
        this.store.groups = this.store.groups.filter((g) => g.id !== groupId);
        this.store.notify();
      }
    };
  }
  get landmarks() {
    return {
      create: (num, name, camera, zoom) => {
        const lm = this.store.landmarks.createLandmark(num, name, camera, zoom);
        this.store.notify();
        return lm;
      },
      delete: (id) => {
        const res = this.store.landmarks.deleteLandmark(id);
        this.store.notify();
        return res;
      },
      list: () => this.store.landmarks.list()
    };
  }
  get viewWindows() {
    return {
      create: (params) => {
        const res = this.store.viewWindows.createWindow(params);
        this.store.notify();
        return res;
      },
      close: (id) => {
        const res = this.store.viewWindows.removeWindow(id);
        this.store.notify();
        return res;
      },
      select: (id) => {
        this.store.viewWindows.selectWindow(id);
        this.store.notify();
      },
      pinLive: (id, pinned) => {
        this.store.viewWindows.pinLive(id, pinned);
        this.store.notify();
      }
    };
  }
};

// src/node-graph/ui/widgets/MidpointWidgets.tsx
import { Fragment as Fragment5, jsx as jsx15, jsxs as jsxs13 } from "react/jsx-runtime";
function MidpointWidgets({ x, y, locked, onDelete, onInspect, onToggleLock }) {
  return /* @__PURE__ */ jsxs13(
    "div",
    {
      style: {
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        backgroundColor: "var(--skipo-surface, #1e1e1e)",
        border: "1px solid var(--skipo-border, #333)",
        borderRadius: "12px",
        padding: "2px 6px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
        zIndex: 7,
        // Below node bodies (z-index 10) per Skipo invariant
        pointerEvents: "auto"
      },
      onClick: (e) => e.stopPropagation(),
      children: [
        onToggleLock && /* @__PURE__ */ jsx15(
          "button",
          {
            type: "button",
            title: locked ? "Unlock Connection" : "Lock Connection",
            style: {
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              color: locked ? "var(--skipo-accent, #d4af37)" : "var(--skipo-text-muted, #888)",
              display: "flex",
              alignItems: "center"
            },
            onClick: onToggleLock,
            children: /* @__PURE__ */ jsx15("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: locked ? /* @__PURE__ */ jsxs13(Fragment5, { children: [
              /* @__PURE__ */ jsx15("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }),
              /* @__PURE__ */ jsx15("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })
            ] }) : /* @__PURE__ */ jsxs13(Fragment5, { children: [
              /* @__PURE__ */ jsx15("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }),
              /* @__PURE__ */ jsx15("path", { d: "M7 11V7a5 5 0 0 1 9.9-1" })
            ] }) })
          }
        ),
        onInspect && /* @__PURE__ */ jsx15(
          "button",
          {
            type: "button",
            title: "Inspect Signal",
            style: {
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              color: "var(--skipo-text-muted, #888)",
              display: "flex",
              alignItems: "center"
            },
            onClick: onInspect,
            children: /* @__PURE__ */ jsxs13("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
              /* @__PURE__ */ jsx15("circle", { cx: "12", cy: "12", r: "10" }),
              /* @__PURE__ */ jsx15("line", { x1: "12", y1: "16", x2: "12", y2: "12" }),
              /* @__PURE__ */ jsx15("line", { x1: "12", y1: "8", x2: "12.01", y2: "8" })
            ] })
          }
        ),
        onDelete && !locked && /* @__PURE__ */ jsx15(
          "button",
          {
            type: "button",
            title: "Delete Connection",
            style: {
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              color: "#e06c75",
              display: "flex",
              alignItems: "center"
            },
            onClick: onDelete,
            children: /* @__PURE__ */ jsxs13("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
              /* @__PURE__ */ jsx15("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
              /* @__PURE__ */ jsx15("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
            ] })
          }
        )
      ]
    }
  );
}

// src/node-graph/ui/toolbar/GraphToolbar.tsx
import { jsx as jsx16, jsxs as jsxs14 } from "react/jsx-runtime";
function GraphToolbar({
  settings,
  onUpdateSettings,
  onRefreshTraces,
  onLockAllConnections,
  onSaveView,
  onLoadView,
  className = ""
}) {
  const btnStyle = (active) => ({
    background: active ? "var(--skipo-accent, #d4af37)" : "transparent",
    color: active ? "#000000" : "var(--skipo-text, #ffffff)",
    border: "1px solid var(--skipo-border, #444)",
    borderRadius: "4px",
    padding: "4px 8px",
    fontSize: "11px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px"
  });
  return /* @__PURE__ */ jsxs14(
    "div",
    {
      className,
      style: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        backgroundColor: "var(--skipo-surface, #1e1e1e)",
        border: "1px solid var(--skipo-border, #333)",
        borderRadius: "6px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: 25
      },
      children: [
        /* @__PURE__ */ jsxs14(
          "button",
          {
            type: "button",
            style: btnStyle(settings.tracingEnabled),
            onClick: () => onUpdateSettings({ tracingEnabled: !settings.tracingEnabled }),
            children: [
              "Tracing: ",
              settings.tracingEnabled ? "ON" : "OFF"
            ]
          }
        ),
        /* @__PURE__ */ jsxs14(
          "button",
          {
            type: "button",
            style: btnStyle(settings.autoSolidify),
            onClick: () => onUpdateSettings({ autoSolidify: !settings.autoSolidify }),
            children: [
              "Solidify: ",
              settings.autoSolidify ? "AUTO" : "MANUAL"
            ]
          }
        ),
        /* @__PURE__ */ jsx16(
          "button",
          {
            type: "button",
            style: btnStyle(false),
            onClick: onRefreshTraces,
            children: "Refresh Traces"
          }
        ),
        /* @__PURE__ */ jsxs14(
          "button",
          {
            type: "button",
            style: btnStyle(settings.attractionEnabled),
            onClick: () => onUpdateSettings({ attractionEnabled: !settings.attractionEnabled }),
            children: [
              "Attraction: ",
              settings.attractionEnabled ? "ON" : "OFF"
            ]
          }
        ),
        /* @__PURE__ */ jsx16(
          "button",
          {
            type: "button",
            style: btnStyle(false),
            onClick: onLockAllConnections,
            children: "Lock All"
          }
        ),
        onSaveView && /* @__PURE__ */ jsx16("button", { type: "button", style: btnStyle(false), onClick: onSaveView, children: "Save View" }),
        onLoadView && /* @__PURE__ */ jsx16("button", { type: "button", style: btnStyle(false), onClick: onLoadView, children: "Load View" })
      ]
    }
  );
}

// src/node-graph/ui/react-flow/ReactFlowAdapter.ts
var ReactFlowAdapter = class {
  static toReactFlowNodes(nodes) {
    return nodes.map((node) => ({
      id: node.id,
      type: "magneticNode",
      position: { x: node.position.x, y: node.position.y },
      data: {
        nodeId: node.id,
        label: node.label,
        type: node.type,
        handles: node.handles.map((h) => ({
          id: h.id,
          direction: h.direction,
          category: h.handleCategory,
          dataType: h.dataType,
          offset: { ...h.offset }
        })),
        positionLocked: node.positionLocked,
        customData: node.state
      }
    }));
  }
  static toReactFlowEdges(connections, traces = [], viewLinks = []) {
    const edges = [];
    for (const conn of connections) {
      edges.push({
        id: conn.id,
        source: conn.sourceNodeId,
        sourceHandle: conn.sourceHandleId,
        target: conn.targetNodeId,
        targetHandle: conn.targetHandleId,
        type: "magneticSolidEdge",
        data: {
          connectionId: conn.id,
          sourceNodeId: conn.sourceNodeId,
          sourceHandleId: conn.sourceHandleId,
          targetNodeId: conn.targetNodeId,
          targetHandleId: conn.targetHandleId,
          wireType: conn.wireType,
          locked: conn.locked,
          isTrace: false
        }
      });
    }
    for (const trace of traces) {
      edges.push({
        id: trace.id,
        source: trace.sourceNodeId,
        sourceHandle: trace.sourceHandleId,
        target: trace.targetNodeId,
        targetHandle: trace.targetHandleId,
        type: "magneticTraceEdge",
        animated: true,
        data: {
          connectionId: trace.id,
          sourceNodeId: trace.sourceNodeId,
          sourceHandleId: trace.sourceHandleId,
          targetNodeId: trace.targetNodeId,
          targetHandleId: trace.targetHandleId,
          wireType: trace.wireType,
          locked: false,
          isTrace: true
        }
      });
    }
    for (const link of viewLinks) {
      edges.push({
        id: link.id,
        source: link.sourceNodeId,
        sourceHandle: link.sourceViewHandleId,
        target: link.targetViewWindowId,
        targetHandle: "window-in",
        type: "viewLinkEdge",
        data: {
          connectionId: link.id,
          sourceNodeId: link.sourceNodeId,
          sourceHandleId: link.sourceViewHandleId,
          targetNodeId: link.targetViewWindowId,
          targetHandleId: "window-in",
          wireType: "VIEW",
          locked: true,
          isViewLink: true
        }
      });
    }
    return edges;
  }
  static toReactFlowViewWindows(windows) {
    return windows.map((w) => ({
      id: w.id,
      type: "viewWindowWidget",
      position: { x: w.position.x, y: w.position.y },
      data: {
        windowId: w.id,
        viewType: w.viewType,
        sourceNodeId: w.sourceNodeId,
        dynamicState: w.dynamicState,
        pinnedLive: w.pinnedLive,
        size: { ...w.size }
      }
    }));
  }
};

// src/node-graph/Viewer2DNodes.tsx
import { useState as useState9, useRef as useRef5 } from "react";
import { jsx as jsx17, jsxs as jsxs15 } from "react/jsx-runtime";
function Viewer2DNodes({
  node,
  selected,
  onMouseDown,
  onDoubleClick,
  onSocketMouseDown,
  onSocketNudgeChange
}) {
  const cardWidth = node.width ?? 180;
  const headerHeight = 36;
  const socketSpacing = 36;
  const centerX = cardWidth / 2;
  return /* @__PURE__ */ jsxs15(
    "div",
    {
      style: {
        position: "absolute",
        left: node.position.x,
        top: node.position.y,
        width: cardWidth,
        backgroundColor: "rgba(20, 24, 30, 0.9)",
        backdropFilter: "blur(12px)",
        border: `2px solid ${selected ? "#d4af37" : "rgba(255, 255, 255, 0.12)"}`,
        borderRadius: "10px",
        color: "#f5ede4",
        fontFamily: "Inter, system-ui, sans-serif",
        userSelect: "none",
        boxShadow: selected ? "0 0 20px rgba(212, 175, 55, 0.45)" : "0 8px 16px rgba(0, 0, 0, 0.4)",
        zIndex: selected ? 25 : 15
      },
      onMouseDown: (e) => onMouseDown?.(e, node.id),
      onDoubleClick: () => onDoubleClick?.(node.id),
      children: [
        /* @__PURE__ */ jsxs15(
          "div",
          {
            style: {
              height: `${headerHeight}px`,
              padding: "0 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              backgroundColor: "rgba(0, 0, 0, 0.25)",
              borderTopLeftRadius: "8px",
              borderTopRightRadius: "8px"
            },
            children: [
              /* @__PURE__ */ jsx17("span", { style: { fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em" }, children: node.label }),
              /* @__PURE__ */ jsx17(
                "span",
                {
                  style: {
                    fontSize: "9px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    color: "#a0aec0"
                  },
                  children: node.type
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsx17("div", { style: { position: "relative", minHeight: "60px", padding: "12px 16px" }, children: node.data && /* @__PURE__ */ jsxs15("div", { style: { fontSize: "11px", color: "#94a3b8" }, children: [
          Object.keys(node.data).length,
          " properties"
        ] }) }),
        /* @__PURE__ */ jsxs15("div", { style: { position: "absolute", top: headerHeight + 10, left: centerX, width: 0, height: 0 }, children: [
          node.inputs?.map((socket, idx) => /* @__PURE__ */ jsx17(
            MovableSocketHandle,
            {
              socket,
              nodeId: node.id,
              cardWidth,
              isOutput: false,
              baseY: idx * socketSpacing,
              onSocketMouseDown,
              onSocketNudgeChange
            },
            socket.id
          )),
          node.outputs?.map((socket, idx) => /* @__PURE__ */ jsx17(
            MovableSocketHandle,
            {
              socket,
              nodeId: node.id,
              cardWidth,
              isOutput: true,
              baseY: idx * socketSpacing,
              onSocketMouseDown,
              onSocketNudgeChange
            },
            socket.id
          ))
        ] })
      ]
    }
  );
}
function MovableSocketHandle({
  socket,
  nodeId,
  cardWidth,
  isOutput,
  baseY,
  onSocketMouseDown,
  onSocketNudgeChange
}) {
  const [isHovered, setIsHovered] = useState9(false);
  const [localNudge, setLocalNudge] = useState9(
    socket.offset ?? { x: 0, y: 0 }
  );
  const isDraggingGizmoRef = useRef5(false);
  const dragStartPosRef = useRef5({
    clientX: 0,
    clientY: 0,
    origX: 0,
    origY: 0
  });
  const nudge = socket.offset ?? localNudge;
  const isDisplaced = nudge.x !== 0 || nudge.y !== 0;
  const coords = calculateSocketCoordinates(baseY, {
    cardWidth,
    isOutput,
    clearance: 12,
    nudge
  });
  const handleGizmoMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingGizmoRef.current = true;
    dragStartPosRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: nudge.x,
      origY: nudge.y
    };
    const handleWindowMouseMove = (moveEvt) => {
      if (!isDraggingGizmoRef.current) return;
      const dx = moveEvt.clientX - dragStartPosRef.current.clientX;
      const dy = moveEvt.clientY - dragStartPosRef.current.clientY;
      const updated = {
        x: Math.round(dragStartPosRef.current.origX + dx),
        y: Math.round(dragStartPosRef.current.origY + dy)
      };
      setLocalNudge(updated);
      onSocketNudgeChange?.(nodeId, socket.id, updated);
    };
    const handleWindowMouseUp = () => {
      isDraggingGizmoRef.current = false;
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
  };
  const beamCorePoints = getBeamPoints(nudge, 5, 1.2);
  const beamShroudPoints = getBeamPoints(nudge, 8, 2.5);
  const socketThemeColor = isOutput ? "#61afef" : "#98c379";
  const gizmoOffsetX = isOutput ? 18 : -18;
  return /* @__PURE__ */ jsxs15(
    "div",
    {
      style: {
        position: "absolute",
        left: 0,
        top: 0
      },
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      children: [
        isDisplaced && /* @__PURE__ */ jsxs15(
          "svg",
          {
            style: {
              position: "absolute",
              left: coords.effectiveX,
              top: coords.effectiveY,
              overflow: "visible",
              pointerEvents: "none",
              zIndex: 1
            },
            children: [
              /* @__PURE__ */ jsx17(
                "polygon",
                {
                  points: beamShroudPoints,
                  fill: socketThemeColor,
                  opacity: 0.35
                }
              ),
              /* @__PURE__ */ jsx17(
                "polygon",
                {
                  points: beamCorePoints,
                  fill: "#ffffff",
                  opacity: 0.9
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsx17(
          "div",
          {
            style: {
              position: "absolute",
              left: coords.effectiveX - 14,
              top: coords.effectiveY - 14,
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              backgroundColor: "#181a1f",
              border: `2px solid ${socketThemeColor}`,
              boxShadow: isHovered ? `0 0 12px ${socketThemeColor}, inset 0 0 6px ${socketThemeColor}` : "0 2px 6px rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "crosshair",
              zIndex: 4
            },
            onMouseDown: (e) => {
              e.stopPropagation();
              onSocketMouseDown?.(e, nodeId, socket.id, isOutput ? "output" : "input");
            },
            children: /* @__PURE__ */ jsx17(
              "div",
              {
                style: {
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: socketThemeColor,
                  boxShadow: `0 0 4px ${socketThemeColor}`
                }
              }
            )
          }
        ),
        (isHovered || isDraggingGizmoRef.current) && /* @__PURE__ */ jsx17(
          "div",
          {
            title: "Drag to displace socket handle",
            style: {
              position: "absolute",
              left: coords.effectiveX + gizmoOffsetX - 8,
              top: coords.effectiveY - 8,
              width: "16px",
              height: "16px",
              borderRadius: "4px",
              backgroundColor: "rgba(30, 34, 42, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
              zIndex: 6,
              boxShadow: "0 2px 4px rgba(0,0,0,0.5)"
            },
            onMouseDown: handleGizmoMouseDown,
            children: /* @__PURE__ */ jsxs15("svg", { width: "10", height: "10", viewBox: "0 0 24 24", fill: "none", stroke: "#d4af37", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
              /* @__PURE__ */ jsx17("polyline", { points: "5 9 2 12 5 15" }),
              /* @__PURE__ */ jsx17("polyline", { points: "9 5 12 2 15 5" }),
              /* @__PURE__ */ jsx17("polyline", { points: "15 19 12 22 9 19" }),
              /* @__PURE__ */ jsx17("polyline", { points: "19 9 22 12 19 15" }),
              /* @__PURE__ */ jsx17("line", { x1: "2", y1: "12", x2: "22", y2: "12" }),
              /* @__PURE__ */ jsx17("line", { x1: "12", y1: "2", x2: "12", y2: "22" })
            ] })
          }
        )
      ]
    }
  );
}

export {
  screenToCanvas,
  canvasToScreen,
  zoomAtPoint,
  clampZoom,
  fitToView,
  isNodeInCenterDeadZone,
  getCenterPanForNode,
  WireRenderer,
  calculateSocketCoordinates,
  getBeamPoints,
  MovableSocketView,
  NodeEmblem,
  NodeCard,
  getNodesInSelection,
  useNodeGraph,
  CompatibilityMatrix,
  HandleTypeRegistry,
  WireTypeRegistry,
  initializeDefaultGraphRules,
  PRIMITIVE_NODE_DEFINITIONS,
  ConnectionRuleStore,
  CompatibleNodePicker,
  NodeSearchPalette,
  CanvasContextMenu,
  GhostStore,
  GhostInferenceEngine,
  GhostLayoutResolver,
  GhostTracePathBuilder,
  useGhostRouting,
  useMagneticTraces,
  GhostTraceLayer,
  GhostNodeCard,
  GhostSolidifyBar,
  SolidifyWidget,
  MagneticTraceLayer,
  NodeGraphCanvas,
  NodeDetailsPanel,
  BaseHandle,
  DataHandle,
  ViewHandle,
  BaseNode,
  CustomNode,
  BaseConnection,
  SolidConnection,
  ViewLink,
  BaseViewWindow,
  CustomViewWindow,
  DEFAULT_GRAPH_SETTINGS,
  BaseGraph,
  CustomGraph,
  SpatialEngine,
  TraceEngine,
  AutoSolidify,
  AttractionEngine,
  GroupSettingsResolver,
  LandmarkManager,
  ViewEngine,
  ViewWindowManager,
  GraphStore,
  CommandApi,
  MidpointWidgets,
  GraphToolbar,
  ReactFlowAdapter,
  Viewer2DNodes,
  MovableSocketHandle
};
