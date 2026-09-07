import * as react from 'react';
import react__default from 'react';

type DockPosition = 'top' | 'bottom' | 'left' | 'right';
interface DockItemConfig {
    id: string;
    icon: string | React.ReactNode;
    label: string;
    badge?: number | string;
    onClick?: () => void;
}

interface DockItemProps {
    item: DockItemConfig;
    isActive?: boolean;
    onClick?: () => void;
}
declare function DockItem({ item, isActive, onClick }: DockItemProps): react.JSX.Element;

interface DockBarProps {
    items: DockItemConfig[];
    position?: DockPosition;
    activeId?: string;
    onItemClick?: (id: string) => void;
    autoHide?: boolean;
}
declare function DockBar({ items, position, activeId, onItemClick, autoHide }: DockBarProps): react__default.JSX.Element;

declare function useDock(initialItems?: DockItemConfig[]): {
    items: DockItemConfig[];
    activeId: string | undefined;
    setActiveId: react.Dispatch<react.SetStateAction<string | undefined>>;
    updateBadge: (id: string, badge: number | string | undefined) => void;
    setItems: react.Dispatch<react.SetStateAction<DockItemConfig[]>>;
};

export { DockBar, DockItem, type DockItemConfig, type DockPosition, useDock };
