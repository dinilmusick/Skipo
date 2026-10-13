#!/usr/bin/env python3
"""
checklists/15_contract_boundary_enforcement.py - Aspect 15: Contract Boundary Enforcement Validator.
Pure Python 3 standard library ONLY - zero pip dependencies.

Enforces docs/02_CONTRACT_BOUNDARY_ENFORCEMENT.md:
- Rule 15.1: Banned Internal Imports (no node_modules/*/internal/*, ../sibling/src/*, deep internal paths)
- Rule 15.2: Local Canonical Symbol Shim Detector (no local duplicate declarations of canonical library symbols)
- Rule 15.3: Canonical Public Import Enforcement (must use valid @ultrst-armada/kloks/* or @ultrst-armada/floks/* subpaths)
- Rule 15.4: Consumer Contract Requirements Verification (InstalledContract ⊇ ConsumerRequirements)
"""

from pathlib import Path
from typing import List, Dict, Set, Optional, Any
import re
import time
import json
import os

try:
    from .common import ChecklistResult, Violation
except ImportError:
    from common import ChecklistResult, Violation

CANONICAL_LIBRARY_SYMBOLS = {
    # State-Graph & Sockets
    "GraphEntityMetadata": "@ultrst-armada/kloks/state-graph",
    "SocketPosition2D": "@ultrst-armada/kloks/state-graph",
    "SocketGeometryConfig": "@ultrst-armada/kloks/state-graph",
    "SocketStyleConfig": "@ultrst-armada/kloks/state-graph",
    "AudioStereoSocket": "@ultrst-armada/kloks/state-graph",
    "AudioMonoSocket": "@ultrst-armada/kloks/state-graph",
    "AudioPacketSocket": "@ultrst-armada/kloks/state-graph",
    "TriggerSocket": "@ultrst-armada/kloks/state-graph",
    "MidiStreamSocket": "@ultrst-armada/kloks/state-graph",
    "CurveStreamSocket": "@ultrst-armada/kloks/state-graph",
    "ComponentSocket": "@ultrst-armada/kloks/state-graph",
    "PrimitiveSocket": "@ultrst-armada/kloks/state-graph",
    "createSocketInstance": "@ultrst-armada/kloks/state-graph",
    # Wires
    "WireEndpoint2D": "@ultrst-armada/kloks/state-graph",
    "WireCurveStyle": "@ultrst-armada/kloks/state-graph",
    "WireVisualConfig": "@ultrst-armada/kloks/state-graph",
    "createWireInstance": "@ultrst-armada/kloks/state-graph",
    # Nodes
    "GraphNodeParent": "@ultrst-armada/kloks/state-graph",
    "NodeDimensions2D": "@ultrst-armada/kloks/state-graph",
    "createNodeInstance": "@ultrst-armada/kloks/state-graph",
    "StateLifecycleServiceFacade": "@ultrst-armada/kloks/state-graph",
    "NodeGraphEngineServiceFacade": "@ultrst-armada/kloks/state-graph",
    # Audio-Midi
    "AudioHardwareServiceFacade": "@ultrst-armada/kloks/audio-midi",
    "MidiServiceFacade": "@ultrst-armada/kloks/audio-midi",
    "AudioMidiOrchestratorFacade": "@ultrst-armada/kloks/audio-midi",
    # Orchestrations
    "WorkspaceBackendFacade": "@ultrst-armada/kloks/orchestrations",
    # Floks UI
    "UIParent": "@ultrst-armada/floks/ui",
    "ButtonModel": "@ultrst-armada/floks/ui",
    "ButtonProps": "@ultrst-armada/floks/ui",
    "PanelModel": "@ultrst-armada/floks/ui",
    "PanelProps": "@ultrst-armada/floks/ui",
}

VALID_KLOKS_SUBPATHS = {
    "",
    "functions",
    "state-graph",
    "state-graph/state",
    "state-graph/execution",
    "state-graph/domain",
    "state-graph/rules",
    "state-graph/spatial",
    "state-graph/store",
    "audio-midi",
    "services",
    "backend",
    "backend/execution",
    "orchestrations",
    "contracts",
}

VALID_FLOKS_SUBPATHS = {
    "",
    "ui",
    "canvas-ui",
    "contracts",
}

IMPORT_REGEX = re.compile(
    r"""import\s+(?:(?:\*\s+as\s+\w+)|(?:\{[^}]*\})|(?:[\w\s,{}*]+))\s+from\s+['"]([^'"]+)['"]""",
    re.MULTILINE
)

# Pattern detecting local definitions of canonical types/classes/functions
LOCAL_SHIM_REGEX = re.compile(
    r"""^\s*(?:export\s+)?(?:interface|type|class|function|const)\s+([A-Za-z0-9_]+)\b""",
    re.MULTILINE
)

def validate_contract_boundaries(target: Path) -> ChecklistResult:
    start_time = time.time()
    violations: List[Violation] = []
    files_scanned = 0

    target = target.resolve()
    if target.is_file():
        code_files = [target]
    else:
        code_files = [
            f for f in target.rglob("*")
            if f.suffix in {".ts", ".tsx", ".js", ".jsx"}
            and "node_modules" not in f.parts
            and ".git" not in f.parts
            and "dist" not in f.parts
            and "build" not in f.parts
            and ".next" not in f.parts
            and not f.name.endswith(".d.ts")
        ]

    for fpath in code_files:
        files_scanned += 1
        rel_path = str(fpath.relative_to(target)) if not target.is_file() else fpath.name

        try:
            content = fpath.read_text(encoding="utf-8")
        except Exception:
            continue

        lines = content.splitlines()

        # Check 1: Forbidden internal imports
        for idx, line in enumerate(lines, 1):
            for match in IMPORT_REGEX.finditer(line):
                import_src = match.group(1)

                # Ban 1: internal paths
                if "/internal" in import_src:
                    violations.append(Violation(
                        rule_id="15.1-internal-import-banned",
                        severity="error",
                        message=f"Forbidden internal import '{import_src}'. Consumer must only import public library entrypoints.",
                        file_path=rel_path,
                        line=idx,
                        snippet=line.strip(),
                        suggestion="Import from canonical package export surface instead of internal path."
                    ))

                # Ban 2: raw source path imports across packages
                if re.search(r"@(?:ultrst-armada/)?(?:kloks|floks)/.*/src/", import_src) or "/packages/" in import_src:
                    violations.append(Violation(
                        rule_id="15.1-raw-src-import-banned",
                        severity="error",
                        message=f"Forbidden raw source/package import '{import_src}'.",
                        file_path=rel_path,
                        line=idx,
                        snippet=line.strip(),
                        suggestion="Use canonical package subpath without /src/ or /packages/."
                    ))

                # Ban 3: invalid subpaths on @ultrst-armada/kloks
                if import_src.startswith("@ultrst-armada/kloks/") or import_src.startswith("@kloks/"):
                    prefix = "@ultrst-armada/kloks/" if import_src.startswith("@ultrst-armada/kloks/") else "@kloks/"
                    subpath = import_src[len(prefix):]
                    if subpath not in VALID_KLOKS_SUBPATHS:
                        violations.append(Violation(
                            rule_id="15.3-invalid-public-subpath",
                            severity="error",
                            message=f"Unknown or unexported Kloks subpath '{subpath}' in import '{import_src}'.",
                            file_path=rel_path,
                            line=idx,
                            snippet=line.strip(),
                            suggestion=f"Valid subpaths are: {', '.join(sorted(VALID_KLOKS_SUBPATHS))}"
                        ))

                # Ban 4: invalid subpaths on @ultrst-armada/floks
                if import_src.startswith("@ultrst-armada/floks/") or import_src.startswith("@floks/"):
                    prefix = "@ultrst-armada/floks/" if import_src.startswith("@ultrst-armada/floks/") else "@floks/"
                    subpath = import_src[len(prefix):]
                    if subpath not in VALID_FLOKS_SUBPATHS:
                        violations.append(Violation(
                            rule_id="15.3-invalid-public-subpath",
                            severity="error",
                            message=f"Unknown or unexported Floks subpath '{subpath}' in import '{import_src}'.",
                            file_path=rel_path,
                            line=idx,
                            snippet=line.strip(),
                            suggestion=f"Valid subpaths are: {', '.join(sorted(VALID_FLOKS_SUBPATHS))}"
                        ))

        # Check 2: Local canonical symbol shim detection
        # Ignore files that are re-exporting canonical symbols
        for idx, line in enumerate(lines, 1):
            # Skip import lines and export { ... } from lines
            stripped = line.strip()
            if stripped.startswith("import ") or " from " in stripped:
                continue

            match = LOCAL_SHIM_REGEX.match(line)
            if match:
                sym = match.group(1)
                if sym in CANONICAL_LIBRARY_SYMBOLS:
                    canonical_src = CANONICAL_LIBRARY_SYMBOLS[sym]
                    violations.append(Violation(
                        rule_id="15.2-local-canonical-shim-detected",
                        severity="error",
                        message=f"Local definition of canonical library symbol '{sym}' detected. Local shims are strictly forbidden.",
                        file_path=rel_path,
                        line=idx,
                        snippet=stripped,
                        suggestion=f"Delete local definition and import '{sym}' from canonical library '{canonical_src}'."
                    ))

    # Check 3: Installed Contract vs Consumer Requirements
    skipo_contracts_dir = target / ".skipo" / "contracts"
    if skipo_contracts_dir.is_dir():
        for req_file in skipo_contracts_dir.glob("*.json"):
            try:
                data = json.loads(req_file.read_text(encoding="utf-8"))
                req_symbols = data.get("requiredSymbols", [])
                public_symbols = set(data.get("publicSymbols", []))
                for sym in req_symbols:
                    if public_symbols and sym not in public_symbols:
                        violations.append(Violation(
                            rule_id="15.4-incompatible-contract-requirement",
                            severity="error",
                            message=f"Required symbol '{sym}' in {req_file.name} is missing from installed library public contract.",
                            file_path=str(req_file.relative_to(target)),
                            suggestion="Upgrade library or reconcile required symbol names."
                        ))
            except Exception:
                pass

    duration = (time.time() - start_time) * 1000.0
    passed = len(violations) == 0
    score = 100.0 if passed else max(0.0, 100.0 - (len(violations) * 10.0))

    return ChecklistResult(
        aspect_id="aspect_15",
        aspect_title="Contract Boundary Enforcement",
        passed=passed,
        violations=violations,
        files_scanned=files_scanned,
        duration_ms=duration,
        score=score,
    )

if __name__ == "__main__":
    import sys
    target_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    res = validate_contract_boundaries(target_path)
    print(f"Aspect 15: {res.aspect_title} - {'PASSED' if res.passed else 'FAILED'} (Score: {res.score:.1f}%)")
    for v in res.violations:
        print(f"  [{v.severity.upper()}] {v.file_path}:{v.line} - {v.message}")
    sys.exit(0 if res.passed else 1)
