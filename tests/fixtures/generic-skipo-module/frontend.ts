import type { ModuleUiSurface, ModuleRuntimeContext } from "../../../src/modules/ModuleContracts.js";

export const uiSurfaces: readonly ModuleUiSurface[] = [
  {
    id: "overview", title: "Inventory Overview",
    activate: (context: ModuleRuntimeContext) => ({
      surface: "overview", mode: context.mode, applicationId: context.application.applicationId,
    }),
  },
  {
    id: "activity", title: "Inventory Activity",
    activate: (context: ModuleRuntimeContext) => ({
      surface: "activity", workspaceId: context.application.workspaceId ?? null,
    }),
  },
  {
    id: "settings", title: "Inventory Settings",
    activate: (context: ModuleRuntimeContext) => ({
      surface: "settings", moduleId: context.moduleId,
    }),
  },
];
