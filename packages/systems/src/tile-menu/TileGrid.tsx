'use client';
import type { TileConfig } from './types.js';
import { Tile } from './Tile.js';

// Fallback dynamic import for dnd-kit context
// As an MVP implementation, we can just render the grid without drag and drop if dnd-kit is missing
export function TileGrid({ tiles, onReorder: _onReorder, onTileClick }: { tiles: TileConfig[], onReorder?: (tiles: TileConfig[]) => void, onTileClick?: (id: string) => void }) {
  // A complete implementation would wrap this in DndContext and SortableContext
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
      gap: '16px',
      padding: '16px',
      width: '100%',
    }}>
      {tiles.map(tile => (
        <Tile key={tile.id} tile={tile} onClick={onTileClick} />
      ))}
    </div>
  );
}
