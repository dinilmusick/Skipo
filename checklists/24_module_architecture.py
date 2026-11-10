#!/usr/bin/env python3
"""Aspect 24: enforce module placement, contract, host boundaries and isolation."""
import json
import re
import sys
import time
from pathlib import Path
try:
    from .common import ChecklistResult, Violation
except ImportError:
    from common import ChecklistResult, Violation

EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
IMPORT = re.compile(r"(?:\bimport\s+(?:type\s+)?(?:[^'\"]*?\s+from\s*)?|\bexport\s+[^'\"]*?\s+from\s*|\bimport\s*\(|\brequire\s*\()\s*['\"]([^'\"]+)['\"]")
CONTRACT_IMPORTS = {"../module-contract.js", "../module-contract", "../module-contract.ts"}
FORBIDDEN = re.compile(r"\b(?:BackendFacade|backendFacade|bottomBar|BottomBar|BottomStrip|DockBar|AppShellStore|useAppShellStore)\b")
NETWORK = re.compile(r"\bfetch\s*\(|\baxios\s*\.|\bXMLHttpRequest\b|\bWebSocket\s*\(|\bsendBeacon\s*\(")
FACADE = re.compile(r"\bhost\s*\.\s*backend\s*\.\s*(?:invoke|has)\s*\(")
CONTRACT_TYPES = re.compile(r"\b(?:SkipoModule|SkipoModuleHost|SkipoModuleManifest)\b")


def validate_module_architecture(root: Path) -> ChecklistResult:
    started = time.time(); root = root.resolve(); errors = []; scanned = 0
    def add(rule, message, path, line=None, snippet=None, fix=None):
        errors.append(Violation(rule, "error", message, path.relative_to(root).as_posix(), line,
                                snippet=snippet, suggestion=fix))
    contract = root / "src/modules/module-contract.ts"
    if not contract.is_file():
        add("24.1-contract-missing", "Canonical contract missing at src/modules/module-contract.ts.", root / "src",
            fix="Add SkipoModule, SkipoModuleHost, SkipoModuleManifest and the standalone host adapter.")
    else:
        text = contract.read_text(encoding="utf-8")
        for name in ("SkipoModule", "SkipoModuleHost", "SkipoModuleManifest", "ModuleBackendFacade", "ModuleUIExport", "packageDependencies"):
            if name not in text: add("24.1-contract-incomplete", f"Canonical contract is missing {name}.", contract,
                                     fix="Complete the canonical module contract before introducing modules.")
    modules_root = root / "src/modules"
    for pattern in ("src/**/module.json", "src/**/module.ts"):
        for candidate in root.glob(pattern):
            if modules_root not in candidate.parents:
                add("24.2-location", "Module manifest/entrypoint found outside src/modules/.", candidate,
                    fix="Move the module under src/modules/<module-id>/.")
    dirs = sorted(p for p in modules_root.iterdir() if p.is_dir() and not p.name.startswith(".")) if modules_root.is_dir() else []
    known = {p.name for p in dirs}
    for folder in dirs:
        mid = folder.name; manifest_file = folder / "module.json"; entry_file = folder / "module.ts"; standalone_file = folder / "standalone.ts"
        if not re.fullmatch(r"[a-z][a-z0-9-]*", mid):
            add("24.2-location", f"Module id '{mid}' must be lowercase kebab-case.", folder, fix="Rename the folder to a lowercase kebab-case id.")
        for path, label in ((manifest_file, "module.json"), (entry_file, "module.ts"), (standalone_file, "standalone.ts")):
            if not path.is_file(): add("24.3-required-file", f"Module '{mid}' is missing {label}.", folder,
                                       fix=f"Create {path.relative_to(root).as_posix()}.")
        manifest = {}
        if manifest_file.is_file():
            try: manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as exc:
                add("24.4-manifest-json", f"Invalid module.json: {exc}.", manifest_file, fix="Correct the manifest JSON.")
            for key in ("id", "name", "version", "capabilities", "dependencies", "packageDependencies"):
                if key not in manifest: add("24.5-explicit-field", f"Manifest must explicitly declare '{key}'.", manifest_file,
                                             fix=f"Add '{key}' (use [] when no entries apply).")
            if manifest.get("id") != mid: add("24.5-manifest-id", f"Manifest id must equal '{mid}'.", manifest_file,
                                               fix=f'Set "id": "{mid}".')
            for key in ("capabilities", "dependencies", "packageDependencies"):
                values = manifest.get(key, [])
                if not isinstance(values, list) or any(not isinstance(v, str) or not v.strip() for v in values):
                    add("24.5-manifest-array", f"'{key}' must be an array of non-empty strings.", manifest_file,
                        fix=f"Declare '{key}' as a string array, possibly empty.")
            deps = manifest.get("dependencies", [])
            if isinstance(deps, list):
                if len(deps) != len(set(deps)): add("24.5-duplicate-dependency", "Duplicate module dependencies.", manifest_file,
                                                    fix="List each module dependency once.")
                for dep in deps:
                    if dep not in known: add("24.5-unknown-dependency", f"Module dependency '{dep}' is not present under src/modules/.", manifest_file,
                                             fix="Add the dependency module or remove its declaration.")
        if entry_file.is_file():
            entry = entry_file.read_text(encoding="utf-8")
            if not any(x in entry for x in CONTRACT_IMPORTS) or not CONTRACT_TYPES.search(entry):
                add("24.6-contract-use", "module.ts must import and implement the canonical SkipoModule contract.", entry_file,
                    fix="Import SkipoModule/SkipoModuleHost from '../module-contract.js' and type the exported module.")
            if not re.search(r"\bexport\s+(?:const|let)\s+module\b", entry) or not re.search(r"\bcreateUI\s*\(", entry):
                add("24.7-ui-export", "module.ts must export 'module' with the canonical createUI(host) UI export.", entry_file,
                    fix="Export a SkipoModule object with manifest, activate(host), and createUI(host).")
            if not re.search(r"\bactivate\s*\(\s*host\s*:\s*SkipoModuleHost", entry):
                add("24.8-host-contract", "activate() must receive SkipoModuleHost.", entry_file,
                    fix="Use activate(host: SkipoModuleHost) and consume only approved host interfaces.")
        if standalone_file.is_file():
            standalone = standalone_file.read_text(encoding="utf-8")
            if not re.search(r"\bexport\s+(?:(?:async\s+)?function|const)\s+runStandalone\b", standalone):
                add("24.9-standalone-entry", "standalone.ts must export runStandalone().", standalone_file,
                    fix="Export runStandalone() as the module's standalone entrypoint.")
            if "createStandaloneModuleHost" not in standalone:
                add("24.9-standalone-host", "Standalone execution must use createStandaloneModuleHost().", standalone_file,
                    fix="Use createStandaloneModuleHost from the canonical module contract.")
        code = [p for p in folder.rglob("*") if p.is_file() and p.suffix in EXT and not any(x in p.parts for x in ("node_modules", "dist", "build", ".git"))]
        if not any(".test." in p.name or ".spec." in p.name or "__tests__" in p.parts for p in code):
            add("24.10-independent-test", f"Module '{mid}' has no module-local test/spec.", folder,
                fix="Add a test that runs the module with a fake or standalone SkipoModuleHost.")
        package_deps = set(manifest.get("packageDependencies", [])) if isinstance(manifest.get("packageDependencies", []), list) else set()
        caps = set(manifest.get("capabilities", [])) if isinstance(manifest.get("capabilities", []), list) else set()
        for source in code:
            scanned += 1; body = source.read_text(encoding="utf-8", errors="replace"); lines = body.splitlines()
            for match in IMPORT.finditer(body):
                spec = match.group(1); line = body.count("\n", 0, match.start()) + 1
                if spec.startswith("."):
                    resolved = (source.parent / spec).resolve()
                    try: resolved.relative_to(folder.resolve()); inside = True
                    except ValueError: inside = False
                    if not inside and spec.replace("\\", "/") not in CONTRACT_IMPORTS:
                        add("24.11-parent-import", f"Import '{spec}' crosses the module boundary into parent implementation.", source, line,
                            lines[line - 1].strip(), "Use only the canonical module contract and approved host interfaces.")
                elif spec.startswith(("@/", "~/", "src/")) and re.search(r"(?:backend|frontend|application|app)/", spec):
                    add("24.11-parent-import", f"Alias import '{spec}' reaches parent implementation.", source, line,
                        lines[line - 1].strip(), "Use only SkipoModuleHost and the canonical module contract.")
                elif not spec.startswith(("node:", "#", "@types/")):
                    package = spec.split("/")[0] if not spec.startswith("@") else "/".join(spec.split("/")[:2])
                    if package not in package_deps and package != "typescript":
                        add("24.12-explicit-package-dependency", f"Package '{package}' is imported but absent from packageDependencies.", source, line,
                            lines[line - 1].strip(), f"Declare '{package}' in module.json packageDependencies.")
            for number, line in enumerate(lines, 1):
                if FORBIDDEN.search(line): add("24.13-host-infrastructure-bypass", "Direct reference to parent BackendFacade or host UI infrastructure.", source, number,
                                               line.strip(), "Use host.backend and createUI(host); do not mutate host chrome.")
                if NETWORK.search(line): add("24.14-direct-backend-access", "Direct network access bypasses the host BackendFacade.", source, number,
                                              line.strip(), "Declare a capability and call host.backend.invoke().")
        if entry_file.is_file():
            entry = entry_file.read_text(encoding="utf-8")
            calls = set(re.findall(r"host\s*\.\s*backend\s*\.\s*invoke\s*\(\s*['\"]([^'\"]+)", entry))
            for cap in sorted(calls - caps): add("24.15-undeclared-capability", f"Invoked capability '{cap}' is not declared in module.json.", entry_file,
                                                fix=f"Declare '{cap}' in capabilities or remove the invocation.")
            if caps and not FACADE.search(entry): add("24.15-facade-required", "Declared capabilities must be invoked through host.backend.", entry_file,
                                                       fix="Route capability operations through host.backend.invoke()/has().")
    return ChecklistResult("aspect_24", "Skipo Module Architecture Enforcement", not errors, errors, scanned,
                           (time.time() - started) * 1000, max(0.0, 100.0 - len(errors) * 5.0))

if __name__ == "__main__":
    result = validate_module_architecture(Path(sys.argv[1]) if len(sys.argv) > 1 else Path("."))
    print(f"Aspect 24: {result.aspect_title} - {'PASSED' if result.passed else 'FAILED'}")
    for v in result.violations:
        loc = f"{v.file_path}:{v.line}" if v.line else v.file_path
        print(f"  [{v.severity.upper()}] {v.rule_id} {loc}: {v.message}")
        if v.suggestion: print(f"    Fix: {v.suggestion}")
    sys.exit(0 if result.passed else 1)
