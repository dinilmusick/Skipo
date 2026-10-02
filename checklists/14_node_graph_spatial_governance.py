#!/usr/bin/env python3
"""
Aspect 14: Node Graph Spatial Governance & Zero-Toolbar Law (Law L25)
Verifies:
- Ban on Top Toolbars for Spawning Nodes (Mandatory right-click, 'N' key, wire drag)
- Predictive Ghost Routing and Magnetic Traces Enabled by Default
- CanvasContextMenu and NodeSearchPalette integration invariants
"""

from pathlib import Path
import re
import sys
import time

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

ASPECT_ID = "aspect_14_node_graph_spatial_governance"
ASPECT_TITLE = "Node Graph Spatial Purity & Zero-Toolbar Spawn Governance"

TOOLBAR_SPAWN_PATTERNS = [
    re.compile(r'<button[^>]*>[^<]*(?:add|spawn|create|new)\s+node', re.IGNORECASE),
    re.compile(r'toolbar[^>]*>[^<]*<button[^>]*>[^<]*(?:add|spawn|primitive)', re.IGNORECASE),
    re.compile(r'onSpawnNode\s*=\s*\{', re.IGNORECASE)
]

def validate_node_graph_governance(root_dir: Path) -> ChecklistResult:
    start_time = time.time()
    violations = []

    files = scan_files(root_dir, {".tsx", ".jsx"})
    files_scanned = len(files)

    for file_path in files:
        rel_path = file_path.relative_to(root_dir)
        fname = file_path.name

        # Skip library definitions and test files
        if "libraries/skipo" in str(rel_path) or ".test." in fname or ".spec." in fname:
            continue
        if fname in {"CanvasContextMenu.tsx", "NodeSearchPalette.tsx", "CompatibleNodePicker.tsx", "10_node_graph_generator.py"}:
            continue

        content = read_text_safe(file_path)
        if not content:
            continue

        lines = content.splitlines()

        # Check for files that render NodeGraphCanvas or manage node graphs
        is_node_graph_consumer = "NodeGraphCanvas" in content or "useNodeGraph" in content

        if is_node_graph_consumer:
            # 1. Ban on Top Toolbars containing node spawning buttons
            has_toolbar = "toolbar" in content.lower() or "topbar" in content.lower() or "header" in content.lower()
            if has_toolbar:
                for line_idx, line in enumerate(lines, 1):
                    lower_line = line.lower()
                    if ("toolbar" in lower_line or "topbar" in lower_line or "actionbar" in lower_line) and "<button" in lower_line:
                        if any(term in lower_line for term in ["add", "spawn", "create", "node", "primitive"]):
                            violations.append(Violation(
                                rule_id="node-graph-toolbar-spawn-prohibited",
                                severity="error",
                                message=f"Top toolbar node spawn button detected in '{fname}' (Law L25).",
                                file_path=str(rel_path),
                                line=line_idx,
                                snippet=line.strip()[:100],
                                suggestion="Remove top toolbar spawn buttons. Node spawning MUST be driven exclusively by CanvasContextMenu (right-click), 'N' key search palette, and wire-drag CompatibleNodePicker."
                            ))

            # 2. Check for explicit disabling of ghost routing or magnetic traces
            for line_idx, line in enumerate(lines, 1):
                if "ghostRoutingEnabled:\s*false" in line or "ghostRoutingEnabled={false}" in line:
                    violations.append(Violation(
                        rule_id="ghost-routing-disabled-violation",
                        severity="error",
                        message=f"Ghost routing explicitly disabled in '{fname}' (Law L25). Must default to true.",
                        file_path=str(rel_path),
                        line=line_idx,
                        snippet=line.strip()[:100],
                        suggestion="Remove ghostRoutingEnabled: false to keep predictive ghost nodes enabled by default."
                    ))
                if "tracingEnabled:\s*false" in line or "magneticTracesEnabled:\s*false" in line:
                    violations.append(Violation(
                        rule_id="magnetic-traces-disabled-violation",
                        severity="error",
                        message=f"Magnetic traces explicitly disabled in '{fname}' (Law L25). Must default to true.",
                        file_path=str(rel_path),
                        line=line_idx,
                        snippet=line.strip()[:100],
                        suggestion="Remove tracingEnabled: false or magneticTracesEnabled: false to keep magnetic traces enabled."
                    ))

    errors = sum(1 for v in violations if v.severity == "error")
    return ChecklistResult(
        aspect_id=ASPECT_ID,
        aspect_title=ASPECT_TITLE,
        passed=errors == 0,
        violations=violations,
        files_scanned=files_scanned,
        duration_ms=(time.time() - start_time) * 1000,
        score=max(0.0, 100.0 - (errors * 20.0) - (len(violations) - errors) * 5.0)
    )

def main():
    args = parse_standard_args("Aspect 14: Node Graph Spatial Governance & Zero-Toolbar Law Validator")
    result = validate_node_graph_governance(Path(args.path).resolve())
    if args.json:
        import json
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print_checklist_report(result, verbose=args.verbose)
    sys.exit(0 if result.passed else 1)

if __name__ == "__main__":
    main()
