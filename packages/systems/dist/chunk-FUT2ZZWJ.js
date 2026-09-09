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

// src/node-graph/rules/DefaultRules.ts
function initializeDefaultGraphRules() {
  const types = ["STRING", "NUMBER", "BOOLEAN", "OBJECT", "ARRAY", "ANY"];
  for (const t of types) {
    HandleTypeRegistry.register({ dataType: t, category: "DATA" });
  }
  HandleTypeRegistry.register({ dataType: "VIEW", category: "VIEW" });
  WireTypeRegistry.register({ wireType: "DEFAULT", color: "#61afef", strokeWidth: 2.5, style: "bezier" });
  WireTypeRegistry.register({ wireType: "STRING", color: "#98c379", strokeWidth: 2.5, style: "bezier" });
  WireTypeRegistry.register({ wireType: "NUMBER", color: "#61afef", strokeWidth: 2.5, style: "bezier" });
  WireTypeRegistry.register({ wireType: "BOOLEAN", color: "#e5c07b", strokeWidth: 2.5, style: "bezier" });
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
import { Fragment, jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function MidpointWidgets({ x, y, locked, onDelete, onInspect, onToggleLock }) {
  return /* @__PURE__ */ jsxs5(
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
        onToggleLock && /* @__PURE__ */ jsx5(
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
            children: /* @__PURE__ */ jsx5("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: locked ? /* @__PURE__ */ jsxs5(Fragment, { children: [
              /* @__PURE__ */ jsx5("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }),
              /* @__PURE__ */ jsx5("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })
            ] }) : /* @__PURE__ */ jsxs5(Fragment, { children: [
              /* @__PURE__ */ jsx5("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }),
              /* @__PURE__ */ jsx5("path", { d: "M7 11V7a5 5 0 0 1 9.9-1" })
            ] }) })
          }
        ),
        onInspect && /* @__PURE__ */ jsx5(
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
            children: /* @__PURE__ */ jsxs5("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
              /* @__PURE__ */ jsx5("circle", { cx: "12", cy: "12", r: "10" }),
              /* @__PURE__ */ jsx5("line", { x1: "12", y1: "16", x2: "12", y2: "12" }),
              /* @__PURE__ */ jsx5("line", { x1: "12", y1: "8", x2: "12.01", y2: "8" })
            ] })
          }
        ),
        onDelete && !locked && /* @__PURE__ */ jsx5(
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
            children: /* @__PURE__ */ jsxs5("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
              /* @__PURE__ */ jsx5("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
              /* @__PURE__ */ jsx5("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
            ] })
          }
        )
      ]
    }
  );
}

// src/node-graph/ui/widgets/SolidifyWidget.tsx
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
function SolidifyWidget({ x, y, onSolidify }) {
  return /* @__PURE__ */ jsx6(
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
      children: /* @__PURE__ */ jsxs6(
        "button",
        {
          type: "button",
          title: "Solidify Connection",
          style: {
            backgroundColor: "rgba(97, 175, 239, 0.9)",
            border: "1px solid #61afef",
            borderRadius: "10px",
            color: "#ffffff",
            fontSize: "10px",
            fontWeight: 600,
            cursor: "pointer",
            padding: "2px 8px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
            textTransform: "uppercase"
          },
          onClick: onSolidify,
          children: [
            /* @__PURE__ */ jsx6("svg", { width: "10", height: "10", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: /* @__PURE__ */ jsx6("polyline", { points: "20 6 9 17 4 12" }) }),
            "Solidify"
          ]
        }
      )
    }
  );
}

// src/node-graph/ui/toolbar/GraphToolbar.tsx
import { jsx as jsx7, jsxs as jsxs7 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs7(
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
        /* @__PURE__ */ jsxs7(
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
        /* @__PURE__ */ jsxs7(
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
        /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            style: btnStyle(false),
            onClick: onRefreshTraces,
            children: "Refresh Traces"
          }
        ),
        /* @__PURE__ */ jsxs7(
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
        /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            style: btnStyle(false),
            onClick: onLockAllConnections,
            children: "Lock All"
          }
        ),
        onSaveView && /* @__PURE__ */ jsx7("button", { type: "button", style: btnStyle(false), onClick: onSaveView, children: "Save View" }),
        onLoadView && /* @__PURE__ */ jsx7("button", { type: "button", style: btnStyle(false), onClick: onLoadView, children: "Load View" })
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
import { useState as useState3, useRef as useRef2 } from "react";
import { jsx as jsx8, jsxs as jsxs8 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs8(
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
        /* @__PURE__ */ jsxs8(
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
              /* @__PURE__ */ jsx8("span", { style: { fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em" }, children: node.label }),
              /* @__PURE__ */ jsx8(
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
        /* @__PURE__ */ jsx8("div", { style: { position: "relative", minHeight: "60px", padding: "12px 16px" }, children: node.data && /* @__PURE__ */ jsxs8("div", { style: { fontSize: "11px", color: "#94a3b8" }, children: [
          Object.keys(node.data).length,
          " properties"
        ] }) }),
        /* @__PURE__ */ jsxs8("div", { style: { position: "absolute", top: headerHeight + 10, left: centerX, width: 0, height: 0 }, children: [
          node.inputs?.map((socket, idx) => /* @__PURE__ */ jsx8(
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
          node.outputs?.map((socket, idx) => /* @__PURE__ */ jsx8(
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
  const [isHovered, setIsHovered] = useState3(false);
  const [localNudge, setLocalNudge] = useState3(
    socket.offset ?? { x: 0, y: 0 }
  );
  const isDraggingGizmoRef = useRef2(false);
  const dragStartPosRef = useRef2({
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
  return /* @__PURE__ */ jsxs8(
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
        isDisplaced && /* @__PURE__ */ jsxs8(
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
              /* @__PURE__ */ jsx8(
                "polygon",
                {
                  points: beamShroudPoints,
                  fill: socketThemeColor,
                  opacity: 0.35
                }
              ),
              /* @__PURE__ */ jsx8(
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
        /* @__PURE__ */ jsx8(
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
            children: /* @__PURE__ */ jsx8(
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
        (isHovered || isDraggingGizmoRef.current) && /* @__PURE__ */ jsx8(
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
            children: /* @__PURE__ */ jsxs8("svg", { width: "10", height: "10", viewBox: "0 0 24 24", fill: "none", stroke: "#d4af37", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
              /* @__PURE__ */ jsx8("polyline", { points: "5 9 2 12 5 15" }),
              /* @__PURE__ */ jsx8("polyline", { points: "9 5 12 2 15 5" }),
              /* @__PURE__ */ jsx8("polyline", { points: "15 19 12 22 9 19" }),
              /* @__PURE__ */ jsx8("polyline", { points: "19 9 22 12 19 15" }),
              /* @__PURE__ */ jsx8("line", { x1: "2", y1: "12", x2: "22", y2: "12" }),
              /* @__PURE__ */ jsx8("line", { x1: "12", y1: "2", x2: "12", y2: "22" })
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
  WireRenderer,
  NodeCard,
  getNodesInSelection,
  useNodeGraph,
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
  HandleTypeRegistry,
  WireTypeRegistry,
  CompatibilityMatrix,
  initializeDefaultGraphRules,
  SpatialEngine,
  TraceEngine,
  AutoSolidify,
  AttractionEngine,
  calculateSocketCoordinates,
  getBeamPoints,
  GroupSettingsResolver,
  LandmarkManager,
  ViewEngine,
  ViewWindowManager,
  GraphStore,
  CommandApi,
  MidpointWidgets,
  SolidifyWidget,
  GraphToolbar,
  ReactFlowAdapter,
  Viewer2DNodes,
  MovableSocketHandle
};
