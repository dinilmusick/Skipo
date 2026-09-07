// src/canvas/CanvasViewport.tsx
import { useRef, useState } from "react";
import { jsx } from "react/jsx-runtime";
function CanvasViewport({
  children,
  transform,
  onChange,
  minZoom = 0.1,
  maxZoom = 5
}) {
  const containerRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const handleWheel = (e) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const zoomDelta = e.deltaY * -1e-3;
    let newScale = transform.scale + zoomDelta;
    newScale = Math.max(minZoom, Math.min(maxZoom, newScale));
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const graphX = (mouseX - transform.x) / transform.scale;
    const graphY = (mouseY - transform.y) / transform.scale;
    const x = mouseX - graphX * newScale;
    const y = mouseY - graphY * newScale;
    onChange({ x, y, scale: newScale });
  };
  const handleMouseDown = (e) => {
    if (e.button === 1 || e.button === 0 && (e.altKey || e.metaKey)) {
      setIsPanning(true);
      e.preventDefault();
    }
  };
  const handleMouseMove = (e) => {
    if (isPanning) {
      onChange({
        ...transform,
        x: transform.x + e.movementX,
        y: transform.y + e.movementY
      });
    }
  };
  const handleMouseUp = () => {
    setIsPanning(false);
  };
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref: containerRef,
      style: { width: "100%", height: "100%", overflow: "hidden", position: "relative" },
      onWheel: handleWheel,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseUp,
      children: /* @__PURE__ */ jsx("div", { style: {
        position: "absolute",
        top: 0,
        left: 0,
        transformOrigin: "0 0",
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        willChange: "transform"
      }, children })
    }
  );
}

// src/canvas/MiniMap.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function MiniMap({ items, transform, width = 150, height = 100 }) {
  let minX = 0, minY = 0, maxX = 1e3, maxY = 1e3;
  if (items.length > 0) {
    minX = Math.min(...items.map((i) => i.x));
    minY = Math.min(...items.map((i) => i.y));
    maxX = Math.max(...items.map((i) => i.x + (i.width || 100)));
    maxY = Math.max(...items.map((i) => i.y + (i.height || 100)));
  }
  minX -= 200;
  minY -= 200;
  maxX += 200;
  maxY += 200;
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const scaleX = width / contentWidth;
  const scaleY = height / contentHeight;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (width - contentWidth * scale) / 2 - minX * scale;
  const offsetY = (height - contentHeight * scale) / 2 - minY * scale;
  return /* @__PURE__ */ jsxs("div", { style: {
    width,
    height,
    backgroundColor: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "8px",
    position: "relative",
    overflow: "hidden"
  }, children: [
    items.map((item) => /* @__PURE__ */ jsx2(
      "div",
      {
        style: {
          position: "absolute",
          left: item.x * scale + offsetX,
          top: item.y * scale + offsetY,
          width: (item.width || 100) * scale,
          height: (item.height || 100) * scale,
          backgroundColor: "rgba(97, 175, 239, 0.5)",
          borderRadius: "2px"
        }
      },
      item.id
    )),
    /* @__PURE__ */ jsx2("div", { style: {
      position: "absolute",
      left: -transform.x / transform.scale * scale + offsetX,
      top: -transform.y / transform.scale * scale + offsetY,
      width: 1e3 / transform.scale * scale,
      // Approximation of viewport width
      height: 800 / transform.scale * scale,
      border: "1px solid #d4af37",
      backgroundColor: "rgba(212, 175, 55, 0.1)"
    } })
  ] });
}

// src/canvas/InfiniteCanvas.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function InfiniteCanvas({
  items,
  transform,
  onTransformChange,
  showGrid = true,
  showMiniMap = true,
  gridSize = 40
}) {
  const gridBackground = showGrid ? {
    backgroundImage: `
      linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
    `,
    backgroundSize: `${gridSize * transform.scale}px ${gridSize * transform.scale}px`,
    backgroundPosition: `${transform.x}px ${transform.y}px`
  } : {};
  return /* @__PURE__ */ jsxs2("div", { style: { width: "100%", height: "100%", position: "relative", backgroundColor: "#16161a", ...gridBackground }, children: [
    /* @__PURE__ */ jsx3(CanvasViewport, { transform, onChange: onTransformChange, children: items.map((item) => /* @__PURE__ */ jsx3(
      "div",
      {
        style: {
          position: "absolute",
          left: item.x,
          top: item.y,
          width: item.width,
          height: item.height
        },
        children: item.content
      },
      item.id
    )) }),
    showMiniMap && /* @__PURE__ */ jsx3("div", { style: { position: "absolute", bottom: 16, right: 16, zIndex: 100 }, children: /* @__PURE__ */ jsx3(MiniMap, { items, transform }) })
  ] });
}

// src/canvas/useCanvas.ts
import { useState as useState2, useCallback } from "react";
function useCanvas(initialTransform = { x: 0, y: 0, scale: 1 }) {
  const [transform, setTransform] = useState2(initialTransform);
  const [items, setItems] = useState2([]);
  const addItem = useCallback((item) => {
    setItems((prev) => [...prev, item]);
  }, []);
  const updateItemPosition = useCallback((id, x, y) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, x, y } : item));
  }, []);
  return {
    transform,
    setTransform,
    items,
    setItems,
    addItem,
    updateItemPosition
  };
}

export {
  CanvasViewport,
  MiniMap,
  InfiniteCanvas,
  useCanvas
};
