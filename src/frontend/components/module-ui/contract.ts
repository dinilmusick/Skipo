import type { ComponentType, ReactNode } from 'react';

export type ModuleSurfaceType =
  | 'floating-panel'
  | 'overlay'
  | 'drawer'
  | 'full-screen';

export interface ModuleSurfaceProps {
  open: boolean;
  onRequestClose: () => void;
}

export type ModuleUIIcon =
  | ReactNode
  | { kind: 'asset'; src: string; alt?: string };

export interface ModuleUIExport {
  /** Stable identifier unique within the declaring module. */
  id: string;
  label: string;
  icon: ModuleUIIcon;
  component: ComponentType<ModuleSurfaceProps>;
  surfaceType: ModuleSurfaceType;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface SkipoModuleUIContribution {
  /** Stable module identifier shared with the host's module manifest. */
  moduleId: string;
  exports: readonly ModuleUIExport[];
}

export function getNamespacedModuleUIId(moduleId: string, exportId: string): string {
  return `${moduleId}:${exportId}`;
}
