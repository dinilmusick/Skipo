export { AppThemeSocket, BlockquoteStyleDefinition, BlockquoteStyleSchema, CANONICAL_ELEMENTS, CodeStyleDefinition, CodeStyleSchema, DEFAULT_DARK_THEME_PACK, DEFAULT_LIGHT_THEME_PACK, DOCUSTACK_CYBERPUNK_PACK, DOCUSTACK_DARK_GOLD_PACK, DOCUSTACK_WARM_COFFEE_PACK, DOCUSTACK_CYBERPUNK_PACK as DocuStackCyberpunkPack, DOCUSTACK_DARK_GOLD_PACK as DocuStackDarkGoldPack, DOCUSTACK_WARM_COFFEE_PACK as DocuStackWarmCoffeePack, ElementStatusReport, HeadingLevelDefinition, HeadingLevelSchema, HorizontalRuleStyleSchema, LinkStyleDefinition, LinkStyleSchema, ListStyleDefinition, ListStyleSchema, MarkdownSectionStyles, MarkdownSectionStylesSchema, ModularThemePack, ModularThemePackSchema, ParagraphStyleDefinition, ParagraphStyleSchema, ResolvedTypographyCascade, SkipoSemanticTokens, SkipoSemanticTokensSchema, SkipoThemeContextValue, SkipoThemeMetadata, SkipoThemeMetadataSchema, SkipoThemePack, SkipoThemeProvider, SkipoThemeProviderProps, TableStyleDefinition, TableStyleSchema, ThemeApplicationState, ThemeEngine, ThemeEngineStatus, ThemeTypographyDefinition, ThemeTypographySchema, ThemeVariantDefinition, ThemeVariantDefinitionSchema, UIElementCategory, UIElementDefinition, UIElementThemeValue, UIElementThemeValueSchema, applyThemePack, centralLedger, createAppThemeSocket, getAllUIElements, getThemeEngineStatus, getUIElement, palettes, registerUIElement, resolveTypographyCascade, safeValidateModularThemePack, tokensToCssVariables, useSkipoTheme, validateModularThemePack, validateSocketElements, validateThemePack } from './theme/index.js';
import * as React$1 from 'react';
import React__default from 'react';
import 'zod';

interface BaseButtonProps extends React__default.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'accent' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React__default.ReactNode;
}
declare const BaseButton: React__default.ForwardRefExoticComponent<BaseButtonProps & React__default.RefAttributes<HTMLButtonElement>>;

interface BaseInputProps extends React__default.InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
    leadingIcon?: React__default.ReactNode;
}
declare const BaseInput: React__default.ForwardRefExoticComponent<BaseInputProps & React__default.RefAttributes<HTMLInputElement>>;

interface BaseTextareaProps extends React__default.TextareaHTMLAttributes<HTMLTextAreaElement> {
    autoResize?: boolean;
}
declare const BaseTextarea: React__default.ForwardRefExoticComponent<BaseTextareaProps & React__default.RefAttributes<HTMLTextAreaElement>>;

interface BaseSelectProps extends React__default.SelectHTMLAttributes<HTMLSelectElement> {
    options: {
        label: string;
        value: string;
    }[];
    error?: boolean;
}
declare const BaseSelect: React__default.ForwardRefExoticComponent<BaseSelectProps & React__default.RefAttributes<HTMLSelectElement>>;

interface BaseCardProps extends React__default.HTMLAttributes<HTMLDivElement> {
    variant?: 'surface' | 'subtle' | 'base';
    depth?: 'sm' | 'md' | 'lg';
    interactive?: boolean;
}
declare const BaseCard: React__default.ForwardRefExoticComponent<BaseCardProps & React__default.RefAttributes<HTMLDivElement>>;

interface BaseBadgeProps extends React__default.HTMLAttributes<HTMLSpanElement> {
    variant?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}
declare const BaseBadge: React__default.ForwardRefExoticComponent<BaseBadgeProps & React__default.RefAttributes<HTMLSpanElement>>;

interface BaseToggleProps extends React__default.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}
declare const BaseToggle: React__default.ForwardRefExoticComponent<BaseToggleProps & React__default.RefAttributes<HTMLInputElement>>;

interface BaseTooltipProps extends Omit<React__default.HTMLAttributes<HTMLDivElement>, 'content'> {
    content: React__default.ReactNode;
    description?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    children: React__default.ReactNode;
}
/**
 * BaseTooltip — Redirects hover/focus inspection text to the bottom strip center.
 * Zero floating tooltip bubbles rendered in the DOM.
 */
declare const BaseTooltip: React__default.ForwardRefExoticComponent<BaseTooltipProps & React__default.RefAttributes<HTMLDivElement>>;

declare const KNOWN_CREDENTIAL_URLS: Record<string, {
    name: string;
    url: string;
}>;
interface CredentialFieldProps extends Omit<React__default.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    serviceId?: string;
    credentialUrl?: string;
    serviceLabel?: string;
}
/**
 * CredentialField — Secure credential input with an integrated direct link to the external service's key management portal.
 */
declare const CredentialField: React__default.ForwardRefExoticComponent<CredentialFieldProps & React__default.RefAttributes<HTMLInputElement>>;

interface PageContainerProps extends Omit<React__default.HTMLAttributes<HTMLDivElement>, 'title'> {
    title?: React__default.ReactNode;
    subtitle?: React__default.ReactNode;
    actions?: React__default.ReactNode;
    paddingScale?: 'sm' | 'md' | 'lg';
}
declare const PageContainer: React__default.ForwardRefExoticComponent<PageContainerProps & React__default.RefAttributes<HTMLDivElement>>;

interface SectionContainerProps extends React__default.HTMLAttributes<HTMLDivElement> {
    heading: React__default.ReactNode;
    collapsible?: boolean;
}
declare const SectionContainer: React__default.ForwardRefExoticComponent<SectionContainerProps & React__default.RefAttributes<HTMLDivElement>>;

interface SidebarContainerProps extends React__default.HTMLAttributes<HTMLDivElement> {
    minWidth?: number;
    maxWidth?: number;
}
declare const SidebarContainer: React__default.ForwardRefExoticComponent<SidebarContainerProps & React__default.RefAttributes<HTMLDivElement>>;

interface DrawerContainerProps extends React__default.HTMLAttributes<HTMLDivElement> {
    open: boolean;
    onClose: () => void;
    position?: 'left' | 'right' | 'bottom';
}
declare const DrawerContainer: React__default.ForwardRefExoticComponent<DrawerContainerProps & React__default.RefAttributes<HTMLDivElement>>;

interface ModalContainerProps extends React__default.HTMLAttributes<HTMLDivElement> {
    open: boolean;
    onClose: () => void;
}
declare const ModalContainer: React__default.ForwardRefExoticComponent<ModalContainerProps & React__default.RefAttributes<HTMLDivElement>>;

declare const PanelContainer: React__default.ForwardRefExoticComponent<React__default.HTMLAttributes<HTMLDivElement> & React__default.RefAttributes<HTMLDivElement>>;

interface SplitContainerProps extends React__default.HTMLAttributes<HTMLDivElement> {
    direction?: 'horizontal' | 'vertical';
}
declare const SplitContainer: React__default.ForwardRefExoticComponent<SplitContainerProps & React__default.RefAttributes<HTMLDivElement>>;

interface TabContainerProps extends React__default.HTMLAttributes<HTMLDivElement> {
    tabs: {
        id: string;
        label: string;
        content: React__default.ReactNode;
    }[];
}
declare const TabContainer: React__default.ForwardRefExoticComponent<TabContainerProps & React__default.RefAttributes<HTMLDivElement>>;

interface PanelGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}
declare const DEFAULT_PANEL_GEOMETRY: PanelGeometry;
declare function usePanelGeometry(storageKey?: string, defaultGeometry?: PanelGeometry): {
    geometry: PanelGeometry;
    updateGeometry: (next: Partial<PanelGeometry> | ((prev: PanelGeometry) => PanelGeometry)) => void;
};

interface FloatingDetailsPanelProps {
    title: React__default.ReactNode;
    subtitle?: string;
    isOpen: boolean;
    onClose: () => void;
    isPinned?: boolean;
    onTogglePin?: () => void;
    storageKey?: string;
    defaultGeometry?: PanelGeometry;
    minWidth?: number;
    minHeight?: number;
    headerActions?: React__default.ReactNode;
    children: React__default.ReactNode;
    className?: string;
}
declare function FloatingDetailsPanel({ title, subtitle, isOpen, onClose, isPinned, onTogglePin, storageKey, defaultGeometry, minWidth, minHeight, headerActions, children, className }: FloatingDetailsPanelProps): React__default.JSX.Element | null;

type ResizeDirection = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';
interface ResizeHandlesProps {
    onStartResize: (dir: ResizeDirection, e: React__default.MouseEvent) => void;
}
declare function ResizeHandles({ onStartResize }: ResizeHandlesProps): React__default.JSX.Element;

declare function usePanelInteraction(geometry: PanelGeometry, updateGeometry: (next: Partial<PanelGeometry> | ((prev: PanelGeometry) => PanelGeometry)) => void, minWidth: number, minHeight: number): {
    isInteracting: boolean;
    handleMouseDownHeader: (e: React.MouseEvent) => void;
    handleStartResize: (dir: ResizeDirection, e: React.MouseEvent) => void;
};

interface IconOnlyButtonProps extends React__default.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React__default.ReactNode;
    label: string;
    variant?: 'accent' | 'secondary' | 'ghost' | 'danger' | 'success';
    active?: boolean;
}
/**
 * IconOnlyButton — Strict icon-only brutalist button.
 * Static text labels are forbidden. Label appears exclusively in the bottom strip center on hover.
 */
declare const IconOnlyButton: React__default.ForwardRefExoticComponent<IconOnlyButtonProps & React__default.RefAttributes<HTMLButtonElement>>;

declare const SearchInput: React__default.ForwardRefExoticComponent<React__default.InputHTMLAttributes<HTMLInputElement> & React__default.RefAttributes<HTMLInputElement>>;

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    danger?: boolean;
}
declare const ConfirmDialog: React$1.ForwardRefExoticComponent<ConfirmDialogProps & React$1.RefAttributes<HTMLDivElement>>;

interface StatusIndicatorProps extends React__default.HTMLAttributes<HTMLDivElement> {
    status: 'online' | 'offline' | 'syncing' | 'error';
    label?: string;
}
declare const StatusIndicator: React__default.ForwardRefExoticComponent<StatusIndicatorProps & React__default.RefAttributes<HTMLDivElement>>;

declare const LoadingOverlay: React__default.ForwardRefExoticComponent<React__default.HTMLAttributes<HTMLDivElement> & React__default.RefAttributes<HTMLDivElement>>;

interface EmptyStateProps extends React__default.HTMLAttributes<HTMLDivElement> {
    icon?: React__default.ReactNode;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
}
declare const EmptyState: React__default.ForwardRefExoticComponent<EmptyStateProps & React__default.RefAttributes<HTMLDivElement>>;

interface CopyableErrorAlertProps {
    error: string | Error | null | undefined;
    title?: string;
    className?: string;
    onClear?: () => void;
}
declare const CopyableErrorAlert: React__default.FC<CopyableErrorAlertProps>;

interface UseSearchKeyboardNavigationOptions<T> {
    items: T[];
    onSelect: (item: T) => void;
    onClose?: () => void;
    initialIndex?: number;
}
/**
 * Universal hook for keyboard-driven search navigation:
 * - Automatically highlights the first matching item (index 0).
 * - ArrowUp / ArrowDown moves highlight through the list.
 * - Enter selects the highlighted item immediately.
 * - Escape closes the search interface.
 */
declare function useSearchKeyboardNavigation<T>({ items, onSelect, onClose, initialIndex }: UseSearchKeyboardNavigationOptions<T>): {
    highlightedIndex: number;
    setHighlightedIndex: React__default.Dispatch<React__default.SetStateAction<number>>;
    handleKeyDown: (e: React__default.KeyboardEvent | KeyboardEvent) => void;
    highlightedItem: T | undefined;
    listContainerRef: React__default.RefObject<HTMLDivElement | null>;
};

interface SearchableListProps<T> {
    items: T[];
    getItemKey: (item: T) => string;
    renderItem: (item: T, isHighlighted: boolean) => React__default.ReactNode;
    onSelect: (item: T) => void;
    onClose?: () => void;
    placeholder?: string;
    filterFn: (item: T, query: string) => boolean;
    emptyMessage?: string;
    maxHeight?: string | number;
    className?: string;
    autoFocus?: boolean;
}
declare function SearchableList<T>({ items, getItemKey, renderItem, onSelect, onClose, placeholder, filterFn, emptyMessage, maxHeight, className, autoFocus }: SearchableListProps<T>): React__default.JSX.Element;

interface BottomStripProps extends React__default.HTMLAttributes<HTMLElement> {
    leftSlot?: React__default.ReactNode;
    centerSlot?: React__default.ReactNode;
    rightSlot?: React__default.ReactNode;
    hideDefaultLeft?: boolean;
    hideDefaultRight?: boolean;
}
declare const BottomStrip: React__default.ForwardRefExoticComponent<BottomStripProps & React__default.RefAttributes<HTMLElement>>;

interface AppShellProps extends React__default.HTMLAttributes<HTMLDivElement> {
    header?: React__default.ReactNode;
    sidebar?: React__default.ReactNode;
    footer?: React__default.ReactNode;
    bottomStripProps?: BottomStripProps;
    disableBottomStrip?: boolean;
    workspaceGate?: React__default.ReactNode;
}
/**
 * AppShell — Root layout container providing top toolbar slot, clean central viewport, and bottom strip.
 * Supports isolated workspaceGate modal/screen rendering before main canvas/app UI loads.
 */
declare const AppShell: React__default.ForwardRefExoticComponent<AppShellProps & React__default.RefAttributes<HTMLDivElement>>;

interface HeaderBarProps extends Omit<React__default.HTMLAttributes<HTMLElement>, 'title'> {
    title?: React__default.ReactNode;
    nav?: React__default.ReactNode;
    actions?: React__default.ReactNode;
}
declare const HeaderBar: React__default.ForwardRefExoticComponent<HeaderBarProps & React__default.RefAttributes<HTMLElement>>;

interface BreadcrumbNavProps extends React__default.HTMLAttributes<HTMLElement> {
    paths: {
        label: string;
        href?: string;
    }[];
}
declare const BreadcrumbNav: React__default.ForwardRefExoticComponent<BreadcrumbNavProps & React__default.RefAttributes<HTMLElement>>;

interface TopToolbarTab {
    id: string;
    label: string;
    icon?: React__default.ReactNode;
    disabled?: boolean;
}
interface TopToolbarProps extends Omit<React__default.HTMLAttributes<HTMLElement>, 'title'> {
    title?: React__default.ReactNode;
    logo?: React__default.ReactNode;
    tabs?: TopToolbarTab[];
    activeTabId?: string;
    onSelectTab?: (tabId: string) => void;
    actions?: React__default.ReactNode;
}
/**
 * TopToolbar — Universal single top toolbar for app title and flat tab navigation.
 * Nested tabs are strictly prohibited across all Skipo applications.
 */
declare const TopToolbar: React__default.ForwardRefExoticComponent<TopToolbarProps & React__default.RefAttributes<HTMLElement>>;

type SystemMessageType = 'success' | 'error' | 'warning' | 'info';
interface SystemMessage {
    id: string;
    type: SystemMessageType;
    message: string;
    timestamp: number;
}
type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'dirty';
interface BottomStripContextValue {
    inspectionText: string | null;
    inspectionDescription: string | null;
    isDKeyPressed: boolean;
    setInspectionText: (text: string | null, description?: string | null) => void;
    autoSave: {
        enabled: boolean;
        status: AutoSaveStatus;
        toggle: () => void;
        setStatus: (status: AutoSaveStatus) => void;
        setEnabled: (enabled: boolean) => void;
    };
    apiActivity: {
        activeCount: number;
        lastEndpoint?: string;
        lastMethod?: string;
        recordRequestStart: (endpoint: string, method?: string) => string;
        recordRequestEnd: (requestId: string) => void;
    };
    systemMessages: SystemMessage[];
    showSystemMessage: (message: string, type?: SystemMessageType, durationMs?: number) => void;
    clearSystemMessage: (id: string) => void;
}
interface BottomStripProviderProps {
    children: React__default.ReactNode;
    initialAutoSave?: boolean;
}
declare function BottomStripProvider({ children, initialAutoSave }: BottomStripProviderProps): React__default.JSX.Element;
declare function useBottomStrip(): BottomStripContextValue;

interface StatusLightProps extends React__default.HTMLAttributes<HTMLSpanElement> {
    status?: 'idle' | 'active' | 'saving' | 'saved' | 'error' | 'warning';
    label?: string;
    pulse?: boolean;
}
declare const StatusLight: React__default.FC<StatusLightProps>;

interface AutoSaveToggleProps extends React__default.ButtonHTMLAttributes<HTMLButtonElement> {
    onToggle?: () => void;
}
declare const AutoSaveToggle: React__default.FC<AutoSaveToggleProps>;

interface ApiCallIndicatorProps extends React__default.HTMLAttributes<HTMLSpanElement> {
    activeCount?: number;
}
declare const ApiCallIndicator: React__default.FC<ApiCallIndicatorProps>;

interface SystemMessageDisplayProps extends React__default.HTMLAttributes<HTMLDivElement> {
    maxVisible?: number;
}
declare const SystemMessageDisplay: React__default.FC<SystemMessageDisplayProps>;

export { ApiCallIndicator, type ApiCallIndicatorProps, AppShell, type AppShellProps, type AutoSaveStatus, AutoSaveToggle, type AutoSaveToggleProps, BaseBadge, type BaseBadgeProps, BaseButton, type BaseButtonProps, BaseCard, type BaseCardProps, BaseInput, type BaseInputProps, BaseSelect, type BaseSelectProps, BaseTextarea, type BaseTextareaProps, BaseToggle, type BaseToggleProps, BaseTooltip, type BaseTooltipProps, BottomStrip, type BottomStripContextValue, type BottomStripProps, BottomStripProvider, type BottomStripProviderProps, BreadcrumbNav, type BreadcrumbNavProps, ConfirmDialog, type ConfirmDialogProps, CopyableErrorAlert, type CopyableErrorAlertProps, CredentialField, type CredentialFieldProps, DEFAULT_PANEL_GEOMETRY, DrawerContainer, type DrawerContainerProps, EmptyState, type EmptyStateProps, FloatingDetailsPanel, type FloatingDetailsPanelProps, HeaderBar, type HeaderBarProps, IconOnlyButton, type IconOnlyButtonProps, KNOWN_CREDENTIAL_URLS, LoadingOverlay, ModalContainer, type ModalContainerProps, PageContainer, type PageContainerProps, PanelContainer, type PanelGeometry, type ResizeDirection, ResizeHandles, type ResizeHandlesProps, SearchInput, SearchableList, type SearchableListProps, SectionContainer, type SectionContainerProps, SidebarContainer, type SidebarContainerProps, SplitContainer, type SplitContainerProps, StatusIndicator, type StatusIndicatorProps, StatusLight, type StatusLightProps, type SystemMessage, SystemMessageDisplay, type SystemMessageDisplayProps, type SystemMessageType, TabContainer, type TabContainerProps, TopToolbar, type TopToolbarProps, type TopToolbarTab, type UseSearchKeyboardNavigationOptions, useBottomStrip, usePanelGeometry, usePanelInteraction, useSearchKeyboardNavigation };
