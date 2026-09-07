import * as react from 'react';
import react__default from 'react';

interface TileConfig {
    id: string;
    title: string;
    subtitle?: string;
    icon?: string;
    badges?: string[];
    data?: Record<string, unknown>;
}
interface TileAction {
    id: string;
    label: string;
    icon?: string;
    onClick: (tileId: string) => void;
}

interface TileProps {
    tile: TileConfig;
    onClick?: (id: string) => void;
    onContextMenu?: (e: react__default.MouseEvent, id: string) => void;
    dragHandleProps?: Record<string, any>;
    isDragging?: boolean;
}
declare function Tile({ tile, onClick, onContextMenu, dragHandleProps, isDragging }: TileProps): react__default.JSX.Element;

declare function TileGrid({ tiles, onReorder: _onReorder, onTileClick }: {
    tiles: TileConfig[];
    onReorder?: (tiles: TileConfig[]) => void;
    onTileClick?: (id: string) => void;
}): react.JSX.Element;

declare function TileCreateButton({ onClick }: {
    onClick: () => void;
}): react.JSX.Element;

declare function useTileMenu(initialTiles?: TileConfig[]): {
    tiles: TileConfig[];
    addTile: (tile: TileConfig) => void;
    removeTile: (id: string) => void;
    reorderTiles: (newOrder: TileConfig[]) => void;
};

export { Tile, type TileAction, type TileConfig, TileCreateButton, TileGrid, useTileMenu };
