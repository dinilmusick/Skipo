import { ModuleCapabilityBroker } from "./ModuleCapabilityBroker.js";
import type {
  BackendFacade, ModuleRuntimeContext, ModuleLifecycleState, ParentApplicationContext, SkipoModule,
} from "./ModuleContracts.js";

export interface ModuleMountOptions {
  readonly mode: "standalone" | "embedded";
  readonly application: ParentApplicationContext;
  readonly backend: BackendFacade;
  readonly approvedCapabilities?: readonly string[];
}
export interface DiscoveredModule {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly module: SkipoModule;
}
export interface MountedModule {
  readonly module: SkipoModule;
  readonly context: ModuleRuntimeContext;
  readonly state: ModuleLifecycleState;
  activateSurface(surfaceId: string): Promise<unknown>;
  unmount(): Promise<void>;
  dispose(): Promise<void>;
}

export class SkipoModuleHost {
  discover(modules: readonly SkipoModule[]): readonly DiscoveredModule[] {
    const seen = new Set<string>();
    return modules.map((module) => {
      const { manifest } = module;
      if (!manifest.id || !manifest.name || !manifest.version) throw new Error("Invalid Skipo module manifest");
      if (seen.has(manifest.id)) throw new Error(`Duplicate module id: ${manifest.id}`);
      seen.add(manifest.id);
      const declared = new Set(manifest.uiSurfaces.map((surface) => surface.id));
      const exported = new Set(module.uiSurfaces.map((surface) => surface.id));
      if (declared.size !== exported.size || [...declared].some((id) => !exported.has(id))) {
        throw new Error(`UI surface declaration/export mismatch for module: ${manifest.id}`);
      }
      return { id: manifest.id, name: manifest.name, version: manifest.version, module };
    });
  }

  async mount(module: SkipoModule, options: ModuleMountOptions): Promise<MountedModule> {
    const broker = new ModuleCapabilityBroker(
      options.backend, module.manifest.id, options.application.applicationId,
      options.approvedCapabilities ?? module.manifest.capabilities, options.application.userId,
    );
    const context: ModuleRuntimeContext = {
      mode: options.mode, moduleId: module.manifest.id, application: options.application, backend: broker,
    };
    let state: ModuleLifecycleState = "discovered";
    await module.initialize(context);
    state = "initialized";
    await module.mount(context);
    state = "mounted";
    return {
      module, context,
      get state() { return state; },
      async activateSurface(surfaceId: string): Promise<unknown> {
        if (state !== "mounted") throw new Error(`Cannot activate UI while module is ${state}`);
        const surface = module.uiSurfaces.find((item) => item.id === surfaceId);
        if (!surface) throw new Error(`Unknown module UI surface: ${surfaceId}`);
        return surface.activate(context);
      },
      async unmount(): Promise<void> {
        if (state === "unmounted" || state === "disposed") return;
        if (state !== "mounted") throw new Error(`Cannot unmount module while module is ${state}`);
        await module.unmount();
        state = "unmounted";
      },
      async dispose(): Promise<void> {
        if (state === "disposed") return;
        if (state === "mounted") { await module.unmount(); state = "unmounted"; }
        await module.dispose();
        state = "disposed";
      },
    };
  }
}
