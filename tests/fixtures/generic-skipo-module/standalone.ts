import { SkipoModuleHost } from "../../../src/modules/SkipoModuleHost.js";
import { MockBackendFacade } from "./backend.js";
import { GenericSkipoModule } from "./module.js";

export async function runStandaloneFixture() {
  const module = new GenericSkipoModule();
  const backend = new MockBackendFacade();
  const host = new SkipoModuleHost();
  const discovered = host.discover([module]);
  const mounted = await host.mount(module, {
    mode: "standalone",
    application: { applicationId: "generic-inventory-standalone" },
    backend,
    approvedCapabilities: module.manifest.capabilities,
  });
  const overview = await mounted.activateSurface("overview");
  return { discovered, mounted, backend, module, overview };
}
