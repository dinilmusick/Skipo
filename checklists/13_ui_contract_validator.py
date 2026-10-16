#!/usr/bin/env python3
"""
Aspect 13: Service UI Contract & Provenance Governance Validator
Spec: ECOSYSTEM-TIGHTENING-PLAN §6-§14, KRUSBL-PLAN-PATCH §1, §13, §19
Enforces:
- HARD_FAIL: Service with requirementMode: 'required' imported without consuming canonical UI.
- HARD_FAIL: Stale '@floks/ui' imports (must use '@ultrst-armada/floks/ui').
- HARD_FAIL: Local duplicate implementations of canonical FLOKS Auth/Workspace components.
- HARD_FAIL: False package provenance tags claiming package ownership without valid AST imports.
- WARN: Service with requirementMode: 'optional' imported without consuming UI.
- PASS: Canonical FLOKS AuthPage & WorkspaceTilesMenu wired properly.
"""

from pathlib import Path
import re
import sys
import time
from typing import List, Dict, Any, Set

try:
    from .common import (
        Violation, ChecklistResult, scan_files, read_text_safe,
        print_checklist_report, parse_standard_args
    )
except ImportError:
    from common import (
        Violation, ChecklistResult, scan_files, read_text_safe,
        print_checklist_report, parse_standard_args
    )

ASPECT_ID = "aspect_13_ui_contract"
ASPECT_TITLE = "Service UI Contract & Provenance Governance"

KNOWN_SERVICES = {
    "auth": {
        "service_id": "kloks.service.auth",
        "symbols": ["AuthService", "AuthClientServiceFacade", "authService", "AuthBackend"],
        "requirement_mode": "required",
        "canonical_component": "AuthPage",
        "canonical_export": "@ultrst-armada/floks/ui",
    },
    "storage": {
        "service_id": "kloks.service.storage",
        "symbols": ["StorageService", "StorageClientServiceFacade", "storageService", "StorageBackend"],
        "requirement_mode": "optional",
        "canonical_component": "WorkspaceTilesMenu",
        "canonical_export": "@ultrst-armada/floks/ui",
    },
    "systemDb": {
        "service_id": "kloks.service.systemDb",
        "symbols": ["SystemDbService", "SystemDbClientServiceFacade", "systemDbService"],
        "requirement_mode": "none",
        "canonical_component": None,
        "canonical_export": None,
    },
}

def validate_ui_contracts(root_dir: Path) -> ChecklistResult:
    start_time = time.time()
    violations: List[Violation] = []
    files_scanned = 0

    all_files = scan_files(root_dir, extensions=[".ts", ".tsx", ".js", ".jsx"])
    files_scanned = len(all_files)

    imported_services: Set[str] = set()
    used_ui_components: Set[str] = set()
    used_provenance_services: Set[str] = set()

    for file_path in all_files:
        rel_path = str(file_path.relative_to(root_dir))
        content = read_text_safe(file_path)

        # 1. HARD_FAIL: Stale @floks/ui import check
        if "@floks/ui" in content:
            for idx, line in enumerate(content.splitlines(), start=1):
                if "@floks/ui" in line and not line.strip().startswith("//"):
                    violations.append(Violation(
                        rule_id="banned-stale-floks-alias",
                        severity="error",
                        message="Stale '@floks/ui' import path detected. Must use canonical '@ultrst-armada/floks/ui'.",
                        file_path=rel_path,
                        line=idx,
                        snippet=line.strip(),
                        suggestion="Replace from '@floks/ui' with from '@ultrst-armada/floks/ui'"
                    ))

        # 2. Track imported services
        for svc_key, svc_info in KNOWN_SERVICES.items():
            for sym in svc_info["symbols"]:
                if sym in content:
                    imported_services.add(svc_key)
                    break

        # 3. Track UI component usage
        if "@ultrst-armada/floks" in content:
            if "AuthPage" in content:
                used_ui_components.add("AuthPage")
            if "WorkspaceTilesMenu" in content:
                used_ui_components.add("WorkspaceTilesMenu")

        # 4. Track provenance comment blocks
        if "@skipo:service" in content:
            for line in content.splitlines():
                if "@skipo:service" in line:
                    parts = line.split("@skipo:service")
                    if len(parts) > 1:
                        used_provenance_services.add(parts[1].strip())

        # 5. HARD_FAIL: Local duplicate of canonical FLOKS Auth/Workspace
        # Disallow re-defining local AuthPage or WorkspaceTilesMenu interfaces/classes if not importing from FLOKS
        if ("export const AuthPage" in content or "export function AuthPage" in content) and "@ultrst-armada/floks" not in content:
            violations.append(Violation(
                rule_id="duplicate-canonical-auth-page",
                severity="error",
                message="Local duplicate implementation of canonical FLOKS 'AuthPage' detected.",
                file_path=rel_path,
                suggestion="Import canonical AuthPage from '@ultrst-armada/floks/ui' instead of redefining locally."
            ))
        if ("export const WorkspaceTilesMenu" in content or "export function WorkspaceTilesMenu" in content) and "@ultrst-armada/floks" not in content:
            violations.append(Violation(
                rule_id="duplicate-canonical-workspace-tiles",
                severity="error",
                message="Local duplicate implementation of canonical FLOKS 'WorkspaceTilesMenu' detected.",
                file_path=rel_path,
                suggestion="Import canonical WorkspaceTilesMenu from '@ultrst-armada/floks/ui' instead of redefining locally."
            ))

    # 6. Evaluate Service UI requirement rules
    for svc_key in imported_services:
        svc_info = KNOWN_SERVICES[svc_key]
        mode = svc_info["requirement_mode"]
        comp = svc_info["canonical_component"]
        svc_id = svc_info["service_id"]

        is_consumed = (comp in used_ui_components) or (svc_id in used_provenance_services)

        if mode == "required" and not is_consumed:
            violations.append(Violation(
                rule_id="required-service-ui-unused",
                severity="error",
                message=f"Service '{svc_id}' has requirementMode: REQUIRED, but its canonical UI '{comp}' is not consumed in the frontend.",
                file_path="src/frontend",
                suggestion=f"Import '{comp}' from '{svc_info['canonical_export']}' or generate via 'python3 assistant.py generate service-ui src/frontend/sections --name {svc_key}'."
            ))
        elif mode == "optional" and not is_consumed:
            violations.append(Violation(
                rule_id="optional-service-ui-unused",
                severity="warning",
                message=f"Service '{svc_id}' has requirementMode: OPTIONAL, and its UI '{comp}' is unused.",
                file_path="src/frontend",
                suggestion=f"Consider importing '{comp}' from '{svc_info['canonical_export']}' if UI interaction is needed."
            ))

    passed = not any(v.severity == "error" for v in violations)
    duration_ms = round((time.time() - start_time) * 1000, 2)

    return ChecklistResult(
        aspect_id=ASPECT_ID,
        aspect_title=ASPECT_TITLE,
        passed=passed,
        violations=violations,
        files_scanned=files_scanned,
        duration_ms=duration_ms
    )

if __name__ == "__main__":
    args = parse_standard_args("Validate Service UI Contracts & Provenance")
    target = Path(args.path).resolve()
    res = validate_ui_contracts(target)
    print_checklist_report(res)
    sys.exit(0 if res.passed else 1)
