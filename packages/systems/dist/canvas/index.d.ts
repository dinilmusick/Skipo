import * as react from 'react';
import react__default from 'react';

interface Transform {
    x: number;
    y: number;
    scale: number;
}
interface CanvasItem {
    id: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    content: React.ReactNode;
}

interface CanvasViewportProps {
    children: react__default.ReactNode;
    transform: Transform;
    onChange: (t: Transform) => void;
    minZoom?: number;
    maxZoom?: number;
}
declare function CanvasViewport({ children, transform, onChange, minZoom, maxZoom }: CanvasViewportProps): react__default.JSX.Element;

interface InfiniteCanvasProps {
    items: CanvasItem[];
    transform: Transform;
    onTransformChange: (t: Transform) => void;
    showGrid?: boolean;
    showMiniMap?: boolean;
    gridSize?: number;
}
declare function InfiniteCanvas({ items, transform, onTransformChange, showGrid, showMiniMap, gridSize }: InfiniteCanvasProps): react.JSX.Element;

interface MiniMapProps {
    items: CanvasItem[];
    transform: Transform;
    width?: number;
    height?: number;
}
declare function MiniMap({ items, transform, width, height }: MiniMapProps): react.JSX.Element;

declare function useCanvas(initialTransform?: Transform): {
    transform: Transform;
    setTransform: react.Dispatch<react.SetStateAction<Transform>>;
    items: CanvasItem[];
    setItems: react.Dispatch<react.SetStateAction<CanvasItem[]>>;
    addItem: (item: CanvasItem) => void;
    updateItemPosition: (id: string, x: number, y: number) => void;
};

export { type CanvasItem, CanvasViewport, InfiniteCanvas, MiniMap, type Transform, useCanvas };
