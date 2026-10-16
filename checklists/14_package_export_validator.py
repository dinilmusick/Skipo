#!/usr/bin/env python3
"""
Aspect 14: Package Export Boundary & Sub-Path Validator
Spec: ECOSYSTEM-TIGHTENING-PLAN §14, KRUSBL-PLAN-PATCH §7, §13
Enforces:
- HARD_FAIL: Private deep imports into packages (e.g. @ultrst-armada/floks/src/* or @ultrst-armada/floks/packages/*).
- HARD_FAIL: Subpaths not declared in package exports map.
- HARD_FAIL: Stale private package paths.
- PASS: Standard public package export paths (@ultrst-armada/floks/ui, @ultrst-armada/kloks/services, etc.).
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

ASPECT_ID = "aspect_14_package_export"
ASPECT_TITLE = "Package Export Boundary & Sub-Path Governance"

APPROVED_EXPORTS = {
    "@ultrst-armada/floks": {"ui", "canvas-ui", "contracts"},
    "@ultrst-armada/kloks": {"services", "contracts", "backend", "client", "audio-midi", "functions", "orchestrations", "state-graph"},
    "@ultrst-armada/krnl": set(),
}

def validate_package_exports(root_dir: Path) -> ChecklistResult:
    start_time = time.time()
    violations: List[Violation] = []
    files_scanned = 0

    all_files = scan_files(root_dir, extensions=[".ts", ".tsx", ".js", ".jsx"])
    files_scanned = len(all_files)

    deep_import_pattern = re.compile(r"""from\s+['"](@ultrst-armada/[^/'"]+)/([^'"]+)['"]""")

    for file_path in all_files:
        rel_path = str(file_path.relative_to(root_dir))
        content = read_text_safe(file_path)

        for line_num, line in enumerate(content.splitlines(), start=1):
            if line.strip().startswith("//"):
                continue

            matches = deep_import_pattern.findall(line)
            for pkg_name, subpath in matches:
                # 1. Ban direct src or internal packages navigation
                if subpath.startswith("src") or subpath.startswith("packages") or subpath.startswith("dist"):
                    violations.append(Violation(
                        rule_id="banned-private-deep-package-import",
                        severity="error",
                        message=f"Deep private package import '{pkg_name}/{subpath}' is strictly forbidden. Must import through declared public exports.",
                        file_path=rel_path,
                        line=line_num,
                        snippet=line.strip(),
                        suggestion=f"Use declared public export path instead (e.g. '{pkg_name}/ui')"
                    ))
                    continue

                # 2. Verify subpath is in approved exports
                if pkg_name in APPROVED_EXPORTS:
                    valid_subpaths = APPROVED_EXPORTS[pkg_name]
                    # Top-level subpath
                    primary_subpath = subpath.split("/")[0]
                    if valid_subpaths and primary_subpath not in valid_subpaths:
                        violations.append(Violation(
                            rule_id="unregistered-package-export-subpath",
                            severity="error",
                            message=f"Subpath '{subpath}' is not an approved public export of package '{pkg_name}'.",
                            file_path=rel_path,
                            line=line_num,
                            snippet=line.strip(),
                            suggestion=f"Approved exports for {pkg_name} are: {', '.join(sorted(valid_subpaths))}"
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
    args = parse_standard_args("Validate Package Export Boundaries")
    target = Path(args.path).resolve()
    res = validate_package_exports(target)
    print_checklist_report(res)
    sys.exit(0 if res.passed else 1)
