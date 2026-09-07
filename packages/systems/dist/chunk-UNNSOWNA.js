// src/tile-menu/Tile.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function Tile({ tile, onClick, onContextMenu, dragHandleProps, isDragging }) {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        backgroundColor: "rgba(30, 30, 30, 0.7)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        cursor: "pointer",
        opacity: isDragging ? 0.5 : 1,
        boxShadow: isDragging ? "0 8px 16px rgba(0,0,0,0.5)" : "0 2px 4px rgba(0,0,0,0.2)",
        transition: "transform 0.2s, box-shadow 0.2s"
      },
      onClick: () => onClick?.(tile.id),
      onContextMenu: (e) => onContextMenu?.(e, tile.id),
      children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
            tile.icon && /* @__PURE__ */ jsx("span", { style: { fontSize: "24px" }, children: tile.icon }),
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column" }, children: [
              /* @__PURE__ */ jsx("span", { style: { color: "#fff", fontWeight: 600, fontSize: "14px" }, children: tile.title }),
              tile.subtitle && /* @__PURE__ */ jsx("span", { style: { color: "#aaa", fontSize: "12px" }, children: tile.subtitle })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { ...dragHandleProps, style: { cursor: "grab", padding: "4px", color: "#666" }, children: "\u283F" })
        ] }),
        tile.badges && tile.badges.length > 0 && /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "8px" }, children: tile.badges.map((badge) => /* @__PURE__ */ jsx("span", { style: {
          fontSize: "10px",
          backgroundColor: "rgba(255,255,255,0.1)",
          padding: "2px 6px",
          borderRadius: "12px",
          color: "#ccc"
        }, children: badge }, badge)) })
      ]
    }
  );
}

// src/tile-menu/TileGrid.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
function TileGrid({ tiles, onReorder: _onReorder, onTileClick }) {
  return /* @__PURE__ */ jsx2("div", { style: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: "16px",
    padding: "16px",
    width: "100%"
  }, children: tiles.map((tile) => /* @__PURE__ */ jsx2(Tile, { tile, onClick: onTileClick }, tile.id)) });
}

// src/tile-menu/TileCreateButton.tsx
import { jsx as jsx3 } from "react/jsx-runtime";
function TileCreateButton({ onClick }) {
  return /* @__PURE__ */ jsx3(
    "div",
    {
      onClick,
      style: {
        border: "2px dashed rgba(255, 255, 255, 0.2)",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        cursor: "pointer",
        minHeight: "100px",
        color: "rgba(255, 255, 255, 0.5)",
        transition: "all 0.2s"
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.5)";
        e.currentTarget.style.color = "#fff";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
        e.currentTarget.style.color = "rgba(255, 255, 255, 0.5)";
      },
      children: /* @__PURE__ */ jsx3("span", { style: { fontSize: "32px" }, children: "+" })
    }
  );
}

// src/tile-menu/useTileMenu.ts
import { useState, useCallback } from "react";
function useTileMenu(initialTiles = []) {
  const [tiles, setTiles] = useState(initialTiles);
  const addTile = useCallback((tile) => {
    setTiles((prev) => [...prev, tile]);
  }, []);
  const removeTile = useCallback((id) => {
    setTiles((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const reorderTiles = useCallback((newOrder) => {
    setTiles(newOrder);
  }, []);
  return {
    tiles,
    addTile,
    removeTile,
    reorderTiles
  };
}

export {
  Tile,
  TileGrid,
  TileCreateButton,
  useTileMenu
};
