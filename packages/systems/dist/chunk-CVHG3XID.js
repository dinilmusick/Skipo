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

// src/node-graph/WireRenderer.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function WireRenderer({ edges, nodesData, config: _config, onDeleteEdge, connecting }) {
  const getSocketPosition = (nodeId, socketId, type) => {
    const node = nodesData[nodeId];
    if (!node) return { x: 0, y: 0 };
    const socketIndex = type === "input" ? node.inputs?.findIndex((s) => s.id === socketId) ?? 0 : node.outputs?.findIndex((s) => s.id === socketId) ?? 0;
    const x = type === "input" ? node.x : node.x + (node.width ?? 150);
    const y = node.y + 40 + socketIndex * 24;
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
      return /* @__PURE__ */ jsxs("g", { style: { pointerEvents: "auto" }, children: [
        /* @__PURE__ */ jsx(
          "path",
          {
            d: path,
            fill: "none",
            stroke: "transparent",
            strokeWidth: 15
          }
        ),
        /* @__PURE__ */ jsx(
          "path",
          {
            d: path,
            fill: "none",
            stroke: color,
            strokeWidth: 3,
            opacity: 0.8
          }
        ),
        onDeleteEdge && /* @__PURE__ */ jsxs(
          "g",
          {
            transform: `translate(${midX}, ${midY})`,
            onClick: () => onDeleteEdge(edge.id),
            style: { cursor: "pointer" },
            children: [
              /* @__PURE__ */ jsx("circle", { r: 8, fill: "#ff4d4f" }),
              /* @__PURE__ */ jsx("text", { x: 0, y: 0, fontSize: 10, fill: "white", textAnchor: "middle", dominantBaseline: "central", children: "\u2715" })
            ]
          }
        )
      ] }, edge.id);
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
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function NodeCard({ node, selected, onMouseDown, onDoubleClick, onSocketMouseDown }) {
  const width = node.width ?? 150;
  return /* @__PURE__ */ jsxs2(
    "div",
    {
      style: {
        position: "absolute",
        left: node.position.x,
        top: node.position.y,
        width,
        backgroundColor: "rgba(25, 25, 25, 0.8)",
        backdropFilter: "blur(10px)",
        border: `2px solid ${selected ? "#d4af37" : "#333"}`,
        borderRadius: "8px",
        color: "#fff",
        fontFamily: "sans-serif",
        userSelect: "none",
        boxShadow: selected ? "0 0 15px rgba(212, 175, 55, 0.4)" : "0 4px 6px rgba(0,0,0,0.3)"
      },
      onMouseDown: (e) => onMouseDown?.(e, node.id),
      onDoubleClick: () => onDoubleClick?.(node.id),
      children: [
        /* @__PURE__ */ jsxs2("div", { style: {
          padding: "8px",
          borderBottom: "1px solid #333",
          backgroundColor: "rgba(0,0,0,0.2)",
          borderTopLeftRadius: "6px",
          borderTopRightRadius: "6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }, children: [
          /* @__PURE__ */ jsx2("strong", { style: { fontSize: "12px" }, children: node.label }),
          /* @__PURE__ */ jsx2("span", { style: { fontSize: "10px", backgroundColor: "#444", padding: "2px 4px", borderRadius: "4px" }, children: node.type })
        ] }),
        /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", padding: "8px 0" }, children: [
          /* @__PURE__ */ jsx2("div", { style: { display: "flex", flexDirection: "column", gap: "8px", width: "50%" }, children: node.inputs?.map((socket) => /* @__PURE__ */ jsx2(
            SocketView,
            {
              socket,
              onMouseDown: (e) => onSocketMouseDown?.(e, node.id, socket.id, "input")
            },
            socket.id
          )) }),
          /* @__PURE__ */ jsx2("div", { style: { display: "flex", flexDirection: "column", gap: "8px", width: "50%", alignItems: "flex-end" }, children: node.outputs?.map((socket) => /* @__PURE__ */ jsx2(
            SocketView,
            {
              socket,
              onMouseDown: (e) => onSocketMouseDown?.(e, node.id, socket.id, "output"),
              isRight: true
            },
            socket.id
          )) })
        ] })
      ]
    }
  );
}
function SocketView({ socket, isRight, onMouseDown }) {
  const dot = /* @__PURE__ */ jsx2(
    "div",
    {
      style: {
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        backgroundColor: "#61afef",
        cursor: "crosshair",
        border: "2px solid #222"
      },
      onMouseDown: (e) => {
        e.stopPropagation();
        onMouseDown(e);
      }
    }
  );
  return /* @__PURE__ */ jsxs2("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: isRight ? "0 0 0 4px" : "0 4px 0 0",
    transform: isRight ? "translateX(5px)" : "translateX(-5px)"
  }, children: [
    !isRight && dot,
    /* @__PURE__ */ jsx2("span", { style: { fontSize: "10px", color: "#ccc" }, children: socket.label }),
    isRight && dot
  ] });
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
import { useState, useCallback } from "react";
function useNodeGraph(initialNodes = [], initialEdges = []) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [viewport, setViewport] = useState({ panX: 0, panY: 0, zoom: 1 });
  const [selectedNodeIds, setSelectedNodeIds] = useState(/* @__PURE__ */ new Set());
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
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDetailsPinned, setIsDetailsPinned] = useState(false);
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
import { useRef, useState as useState2 } from "react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function NodeGraphCanvas({
  nodes,
  edges,
  viewport,
  config,
  selectedNodeIds,
  onNodesChange,
  onEdgesChange: _onEdgesChange,
  onNodeDoubleClick,
  onViewportChange,
  onSelectionChange
}) {
  const containerRef = useRef(null);
  const [isPanning, setIsPanning] = useState2(false);
  const [dragNodeId, setDragNodeId] = useState2(null);
  const [boxSelection, setBoxSelection] = useState2(null);
  const [connecting, setConnecting] = useState2(null);
  const handleWheel = (e) => {
    e.preventDefault();
    if (!onViewportChange) return;
    const zoomDelta = e.deltaY * -1e-3;
    const currentZoom = viewport.zoom;
    let newZoom = currentZoom + zoomDelta;
    const minZoom = config?.minZoom ?? 0.25;
    const maxZoom = config?.maxZoom ?? 2.5;
    newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const graphX = (mouseX - viewport.panX) / currentZoom;
    const graphY = (mouseY - viewport.panY) / currentZoom;
    const panX = mouseX - graphX * newZoom;
    const panY = mouseY - graphY * newZoom;
    onViewportChange({ zoom: newZoom, panX, panY });
  };
  const handleMouseDown = (e) => {
    if (e.button === 1 || e.button === 0 && e.altKey) {
      setIsPanning(true);
      return;
    }
    if (e.button === 0 && e.shiftKey) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setBoxSelection({
          startX: e.clientX - rect.left,
          startY: e.clientY - rect.top,
          endX: e.clientX - rect.left,
          endY: e.clientY - rect.top
        });
      }
      return;
    }
    if (e.target === containerRef.current) {
      onSelectionChange?.(/* @__PURE__ */ new Set());
    }
  };
  const handleMouseMove = (e) => {
    if (isPanning && onViewportChange) {
      onViewportChange({
        ...viewport,
        panX: viewport.panX + e.movementX,
        panY: viewport.panY + e.movementY
      });
      return;
    }
    if (boxSelection) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setBoxSelection((prev) => prev ? { ...prev, endX: e.clientX - rect.left, endY: e.clientY - rect.top } : null);
      }
      return;
    }
    if (dragNodeId && onNodesChange) {
      const dx = e.movementX / viewport.zoom;
      const dy = e.movementY / viewport.zoom;
      const newNodes = nodes.map((n) => n.id === dragNodeId ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n);
      onNodesChange(newNodes);
      return;
    }
    if (connecting) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setConnecting((prev) => prev ? { ...prev, endX: e.clientX - rect.left, endY: e.clientY - rect.top } : null);
      }
    }
  };
  const handleMouseUp = (_e) => {
    setIsPanning(false);
    setDragNodeId(null);
    if (boxSelection) {
      const selected = getNodesInSelection(
        boxSelection.startX,
        boxSelection.startY,
        boxSelection.endX,
        boxSelection.endY,
        nodes,
        viewport
      );
      onSelectionChange?.(new Set(selected));
      setBoxSelection(null);
    }
    if (connecting) {
      setConnecting(null);
    }
  };
  const handleNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    if (e.button === 0) {
      setDragNodeId(nodeId);
      if (!selectedNodeIds.has(nodeId)) {
        onSelectionChange?.(/* @__PURE__ */ new Set([nodeId]));
      }
    }
  };
  const handleSocketMouseDown = (e, nodeId, socketId, type) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setConnecting({ nodeId, socketId, type, startX: x, startY: y, endX: x, endY: y });
    }
  };
  const nodesData = nodes.reduce((acc, node) => {
    const screenPos = canvasToScreen(node.position.x, node.position.y, viewport);
    acc[node.id] = {
      x: screenPos.x,
      y: screenPos.y,
      width: (node.width ?? 150) * viewport.zoom,
      height: (node.height ?? 100) * viewport.zoom,
      inputs: node.inputs || [],
      outputs: node.outputs || []
    };
    return acc;
  }, {});
  return /* @__PURE__ */ jsxs3(
    "div",
    {
      ref: containerRef,
      style: { width: "100%", height: "100%", position: "relative", overflow: "hidden", backgroundColor: "#1e1e1e" },
      onWheel: handleWheel,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseUp,
      children: [
        /* @__PURE__ */ jsx3(
          WireRenderer,
          {
            edges,
            nodesData,
            connecting: connecting ? {
              startX: connecting.startX,
              startY: connecting.startY,
              endX: connecting.endX,
              endY: connecting.endY
            } : null
          }
        ),
        /* @__PURE__ */ jsx3("div", { style: {
          position: "absolute",
          top: 0,
          left: 0,
          transformOrigin: "0 0",
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`
        }, children: nodes.map((node) => /* @__PURE__ */ jsx3(
          NodeCard,
          {
            node,
            selected: selectedNodeIds.has(node.id),
            onMouseDown: handleNodeMouseDown,
            onDoubleClick: onNodeDoubleClick,
            onSocketMouseDown: handleSocketMouseDown
          },
          node.id
        )) }),
        boxSelection && /* @__PURE__ */ jsx3("div", { style: {
          position: "absolute",
          left: Math.min(boxSelection.startX, boxSelection.endX),
          top: Math.min(boxSelection.startY, boxSelection.endY),
          width: Math.abs(boxSelection.endX - boxSelection.startX),
          height: Math.abs(boxSelection.endY - boxSelection.startY),
          backgroundColor: "rgba(97, 175, 239, 0.2)",
          border: "1px solid #61afef",
          pointerEvents: "none"
        } })
      ]
    }
  );
}

// src/node-graph/NodeDetailsPanel.tsx
import { FloatingDetailsPanel, BaseInput, BaseBadge } from "@skipo/ui";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function renderSockets(sockets, type) {
  if (!sockets || sockets.length === 0) return null;
  return /* @__PURE__ */ jsxs4("div", { style: { marginBottom: "12px" }, children: [
    /* @__PURE__ */ jsxs4("div", { style: { fontSize: "11px", color: "var(--skipo-text-muted)", marginBottom: "4px", textTransform: "uppercase" }, children: [
      type,
      " Sockets (",
      sockets.length,
      ")"
    ] }),
    /* @__PURE__ */ jsx4("div", { style: { display: "flex", flexDirection: "column", gap: "4px" }, children: sockets.map((s) => /* @__PURE__ */ jsxs4("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", background: "var(--skipo-surface)", borderRadius: "var(--skipo-radius-sm)", fontSize: "12px" }, children: [
      /* @__PURE__ */ jsx4("span", { children: s.label || s.id }),
      s.dataType && /* @__PURE__ */ jsx4(BaseBadge, { variant: "neutral", children: s.dataType })
    ] }, s.id)) })
  ] });
}
function renderNodeContent(node, onUpdateNode) {
  return /* @__PURE__ */ jsxs4("div", { style: { display: "flex", flexDirection: "column", gap: "12px" }, children: [
    /* @__PURE__ */ jsxs4("div", { children: [
      /* @__PURE__ */ jsx4("label", { style: { display: "block", fontSize: "11px", color: "var(--skipo-text-muted)", marginBottom: "4px" }, children: "Label" }),
      /* @__PURE__ */ jsx4(
        BaseInput,
        {
          value: node.label,
          onChange: (e) => onUpdateNode?.(node.id, { label: e.target.value })
        }
      )
    ] }),
    /* @__PURE__ */ jsx4("div", { style: { display: "flex", gap: "16px", fontSize: "12px", color: "var(--skipo-text-muted)" }, children: /* @__PURE__ */ jsxs4("div", { children: [
      "Position: X: ",
      Math.round(node.position.x),
      ", Y: ",
      Math.round(node.position.y)
    ] }) }),
    renderSockets(node.inputs, "Input"),
    renderSockets(node.outputs, "Output"),
    node.data && Object.keys(node.data).length > 0 && /* @__PURE__ */ jsxs4("div", { children: [
      /* @__PURE__ */ jsx4("div", { style: { fontSize: "11px", color: "var(--skipo-text-muted)", marginBottom: "4px", textTransform: "uppercase" }, children: "Custom Data" }),
      /* @__PURE__ */ jsx4("pre", { style: { margin: 0, padding: "8px", background: "var(--skipo-surface)", borderRadius: "var(--skipo-radius-sm)", fontSize: "11px", color: "var(--skipo-text)", overflowX: "auto" }, children: JSON.stringify(node.data, null, 2) })
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
  return /* @__PURE__ */ jsx4(
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

export {
  screenToCanvas,
  canvasToScreen,
  zoomAtPoint,
  clampZoom,
  fitToView,
  WireRenderer,
  NodeCard,
  getNodesInSelection,
  useNodeGraph,
  NodeGraphCanvas,
  NodeDetailsPanel
};
