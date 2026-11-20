"""Pure, deterministic TypeScript templates for app-owned Krnl service scaffolds."""
from __future__ import annotations

import re


def service_id(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9]{0,48}", value):
        raise ValueError("Service name must be an alphanumeric identifier starting with a letter (max 49).")
    stem = re.sub(r"Service$", "", value, flags=re.IGNORECASE)
    if not stem:
        raise ValueError("Service name must not consist only of 'Service'.")
    return re.sub(r"(?<!^)(?=[A-Z])", "-", stem).lower()


def service_class(service: str) -> str:
    return "".join(piece[:1].upper() + piece[1:] for piece in service.split("-")) + "Service"


def member_name(value: str) -> str:
    if not re.fullmatch(r"[a-z][A-Za-z0-9]{0,63}", value):
        raise ValueError("Functionality/helper must be a lower-camel-case TypeScript identifier.")
    if value in {"constructor", "prototype", "__proto__"}:
        raise ValueError("Reserved or unsafe member name.")
    return value


def service_source(service: str) -> str:
    klass = service_class(service)
    return (f"import {{ createService, createServiceDefinition }} from '@ultrst-armada/krnl';\n"
            f"import {{ functionalityOperations }} from './functionalities/index.js';\n\n"
            f"export const {klass}Definition = createServiceDefinition({{\n"
            f"  id: 'app.services.{service}',\n  name: '{klass}',\n  version: '1.0.0',\n"
            f"  operations: functionalityOperations,\n}});\n\n"
            f"const instance = createService({klass}Definition);\n"
            f"export const {klass}Facade = {{\n"
            f"  id: {klass}Definition.id,\n  name: {klass}Definition.name,\n"
            f"  version: {klass}Definition.version,\n"
            f"  runtime: 'server' as const,\n  deployment: 'local' as const,\n"
            f"  definition: {klass}Definition,\n"
            f"  execute: async <TIn = unknown, TOut = unknown>(operation: string, input?: TIn) => {{\n"
            f"    await instance.start();\n"
            f"    return instance.call<TIn, TOut>(operation, input);\n"
            f"  }},\n}};\n")


def functionality_source(service: str, name: str) -> str:
    klass = service_class(service)
    return (f"/** App-owned operation. Implement domain behavior here; never return fabricated success. */\n"
            f"export const {name} = {{\n"
            f"  id: '{klass}.{name}',\n  name: '{name}',\n"
            f"  handler: async (_input: unknown): Promise<never> => {{\n"
            f"    throw new Error('{klass}.{name} has not been implemented.');\n"
            f"  }},\n}};\n")


def helper_source(service: str, name: str) -> str:
    return (f"/** App-owned helper for {service_class(service)}. */\n"
            f"export function {name}(_input: unknown): never {{\n"
            f"  throw new Error('{service_class(service)}.{name} has not been implemented.');\n"
            f"}}\n")


def members_index(names: list[str], exported: str | None) -> str:
    if not names:
        return f"export const {exported} = {{}};\n" if exported else "export {};\n"
    imports = "".join(f"import {{ {name} }} from './{name}.js';\n" for name in names)
    if exported:
        return imports + f"\nexport const {exported} = {{\n" + "".join(f"  {name},\n" for name in names) + "};\n"
    return imports + "\nexport { " + ", ".join(names) + " };\n"


def service_index(service: str) -> str:
    klass = service_class(service)
    return (f"export {{ {klass}Facade, {klass}Definition }} from './service.js';\n"
            "export * as serviceHelpers from './helpers/index.js';\n")


def service_manifest(service: str, funcs: list[str], helpers: list[str]) -> dict:
    return {
        "schemaVersion": 1, "id": f"app.services.{service}",
        "name": service_class(service), "version": "1.0.0",
        "implementation": "app-owned",
        "runtime": "server", "entry": "./index.ts",
        "functionalities": funcs, "helpers": helpers,
    }


def binding_source(services: list[str]) -> str:
    imports = "".join(
        f"import {{ {service_class(s)}Facade }} from '../{s}/index.js';\n"
        for s in services
    )
    pairs = "".join(f"  {s.replace('-', '_')}: {service_class(s)}Facade,\n" for s in services)
    return ("/** Skipo-managed app-owned service registration; do not modify by hand. */\n"
            + imports + "\nexport const appOwnedServices = {\n" + pairs + "};\n")
