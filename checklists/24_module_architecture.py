#!/usr/bin/env python3
"""Aspect 24: generic Skipo module architecture enforcement."""
import json
import re
import sys
import time
from pathlib import Path
try:
    from .common import ChecklistResult, Violation
except ImportError:
    from common import ChecklistResult, Violation

IMPORT = re.compile(r"(?:\bimport\s+(?:type\s+)?(?:[^'\"]*?\s+from\s*)?|\bexport\s+[^'\"]*?\s+from\s*|\bimport\s*\(|\brequire\s*\()\s*['\"]([^'\"]+)['\"]")
NETWORK = re.compile(r"\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(")
FORBIDDEN = re.compile(r"\b(?:BackendFacade|backendFacade|AppShellStore|DockBar|BottomBar|frnlBottomBar)\b")
EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}

def validate_module_architecture(root: Path) -> ChecklistResult:
    started = time.time(); violations = []; scanned = 0
    def add(rule, message, path, line=None, suggestion=None):
        violations.append(Violation(rule, "error", message, path.relative_to(root).as_posix(), line, suggestion=suggestion))
    contract_root = root / "src" / "module-contract"
    runtime_host = root / "src" / "module-runtime" / "ModuleHost.ts"
    adapter = root / "src" / "backend" / "ModuleBackendAdapter.ts"
    ui_host = root / "src" / "frontend" / "components" / "module-ui" / "ModuleUIHost.tsx"
    if not contract_root.is_dir(): add("24.contract", "Canonical module contract directory is missing.", root / "src", suggestion="Use src/module-contract as the only generic contract authority.")
    if not runtime_host.is_file(): add("24.host", "Canonical ModuleHost is missing.", root / "src/modules", suggestion="Implement the generic host under src/modules/runtime.")
    if not adapter.is_file(): add("24.backend-adapter", "Canonical ModuleBackendAdapter is missing.", root / "src/backend", suggestion="Expose the parent BackendFacade only through ModuleBackendAdapter.")
    if not ui_host.is_file(): add("24.ui-host", "Canonical module UI host is missing.", root / "src/frontend/components", suggestion="Use the host-owned module UI registry and lifecycle.")

    modules_root = root / "src" / "modules"
    if modules_root.is_dir():
        for candidate in modules_root.iterdir():
            if not candidate.is_dir() or candidate.name.startswith(".") or candidate.name in {"runtime", "contracts", "host", "testing", "isolation"}:
                continue
            if candidate.name.lower() == ("ai" + "ko"): add("24.no-"+("ai"+"ko")+"-module", "Application-specific modules are prohibited in generic reconciliation.", candidate)
            manifest_path = candidate / "skipo.module.json"
            if not manifest_path.is_file(): add("24.manifest", "Embedded module is missing skipo.module.json.", candidate)
            else:
                try: manifest = json.loads(manifest_path.read_text())
                except Exception as exc: add("24.manifest-json", f"Invalid module manifest: {exc}", manifest_path); manifest = {}
                if manifest.get("application", {}).get("standalone") is not True: add("24.standalone", "Embedded module must remain standalone-capable.", manifest_path)
                if manifest.get("application", {}).get("moduleCapable") is not True: add("24.module-capable", "Module must explicitly opt in.", manifest_path)
                if manifest.get("module", {}).get("id") != candidate.name: add("24.identity", "Manifest module.id must match directory name.", manifest_path)
                if not manifest.get("capabilities") and manifest.get("capabilities") != []: add("24.capabilities", "Manifest must declare capabilities explicitly.", manifest_path)
                if "ui" not in manifest or "exports" not in manifest["ui"]: add("24.ui-contract", "Manifest must declare UI exports.", manifest_path)
            for source in candidate.rglob("*"):
                if not source.is_file() or source.suffix not in EXT: continue
                scanned += 1
                body = source.read_text(encoding="utf-8", errors="replace")
                for number, line in enumerate(body.splitlines(), 1):
                    if NETWORK.search(line): add("24.direct-network", "Module code must not bypass the parent BackendFacade with direct network access.", source, number, "Declare a capability and use the module backend adapter.")
                    if FORBIDDEN.search(line): add("24.host-bypass", "Module code references parent host infrastructure directly.", source, number, "Use ModuleRuntimeContext and host-owned UI lifecycle.")
                for match in IMPORT.finditer(body):
                    spec = match.group(1)
                    if spec.startswith("@/") or spec.startswith("~/") or spec.startswith("src/"):
                        line = body.count("\n", 0, match.start()) + 1
                        add("24.parent-import", f"Module import '{spec}' can bypass the module boundary.", source, line, "Use module-local imports or published dependencies.")
                    if spec.startswith("../../src/") or spec.startswith("../../../src/"):
                        line = body.count("\n", 0, match.start()) + 1
                        add("24.parent-import", f"Module import '{spec}' reaches parent implementation: {spec}", source, line, "Use the canonical module contract/adapter only.")
    return ChecklistResult("aspect_24", "Skipo Module Architecture", not violations, violations, scanned, (time.time() - started) * 1000, max(0.0, 100 - len(violations) * 5))

if __name__ == "__main__":
    result = validate_module_architecture(Path(sys.argv[1]) if len(sys.argv) > 1 else Path("."))
    for violation in result.violations:
        print(violation.message)
    sys.exit(0 if result.passed else 1)
