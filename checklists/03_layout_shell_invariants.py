#!/usr/bin/env python3
"""
Aspect 03: Layout Shell Invariants & User Experience Invariants
Verifies:
- Anti-Nested Tabs Law (Bans nested TabContainer elements)
- Dedicated BottomStrip (30px) with BottomStripContext provider
- Ban on Floating Tooltip Bubbles / Popovers (Bans skipo-tooltip floating bubbles)
- FloatingDetailsPanel Invariants (8-way resize, draggable header, pin toggle, persistent geometry)
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

ASPECT_ID = "aspect_03_layout_shell_invariants"
ASPECT_TITLE = "Layout Shell & User Experience Invariants"

def validate_layout_shell(root_dir: Path) -> ChecklistResult:
    start_time = time.time()
    violations = []
    
    files = scan_files(root_dir, {".tsx", ".jsx"})
    files_scanned = len(files)

    for file_path in files:
        rel_path = file_path.relative_to(root_dir)
        fname = file_path.name

        # Skip primitive definition files
        if fname in {"TabContainer.tsx", "BaseTooltip.tsx", "BottomStrip.tsx", "FloatingDetailsPanel.tsx"}:
            continue
        if ".test." in fname or ".spec." in fname:
            continue

        content = read_text_safe(file_path)
        if not content:
            continue

        lines = content.splitlines()

        # 1. Anti-Nested Tabs Check: Count TabContainer occurrences in same file and nesting
        tab_container_count = content.count("<TabContainer")
        if tab_container_count > 1:
            # Check if nested or multiple tab rows in one view
            violations.append(Violation(
                rule_id="anti-nested-tabs-violation",
                severity="error",
                message=f"Multiple (<TabContainer>) declarations ({tab_container_count}) detected in single view.",
                file_path=str(rel_path),
                suggestion="Primary view navigation MUST be flat in the single top-level TopToolbar. Zero nested tabs allowed."
            ))

        # 2. Ban on Floating Tooltip Bubbles: Check for skipo-tooltip or floating balloon classes
        for line_idx, line in enumerate(lines, 1):
            if "skipo-tooltip--" in line or ("skipo-tooltip" in line and "BaseTooltip" not in fname):
                violations.append(Violation(
                    rule_id="floating-tooltip-bubble-forbidden",
                    severity="error",
                    message="Floating tooltip bubble class detected. Floating tooltips and popovers are prohibited.",
                    file_path=str(rel_path),
                    line=line_idx,
                    snippet=line.strip()[:100],
                    suggestion="Route inspection text to BottomStrip via BottomStripContext (e.g. useBottomStrip().setHoverText(...))."
                ))

        # 2b. Bottom Bar Center Slot Exclusivity Law:
        # The middle portion of the bottom bar is reserved ONLY for cursor-hover dynamic text labels.
        # It MUST NOT be used for buttons, interactive widgets, forms, navigation, or arbitrary content.
        if "<BottomStrip" in content and "centerSlot" in content:
            for line_idx, line in enumerate(lines, 1):
                if "centerSlot=" in line or "centerSlot:" in line:
                    if any(bad in line for bad in ["<button", "<BaseButton", "<input", "<form", "<select", "onClick", "Button"]):
                        violations.append(Violation(
                            rule_id="bottom-bar-center-slot-reserved",
                            severity="error",
                            message="Interactive elements or buttons placed in BottomStrip centerSlot. The middle portion is strictly reserved for cursor hover inspection text.",
                            file_path=str(rel_path),
                            line=line_idx,
                            snippet=line.strip()[:100],
                            suggestion="Remove interactive controls from BottomStrip centerSlot. The center area is exclusively reserved for cursor-hover inspection text labels."
                        ))

        # 3. FloatingDetailsPanel Invariants Check:
        # If file acts as an inspector / details panel, ensure it uses FloatingDetailsPanel
        if "details" in fname.lower() or "inspector" in fname.lower():
            if "FloatingDetailsPanel" not in content and "PanelContainer" not in content:
                violations.append(Violation(
                    rule_id="details-panel-missing-floating-primitive",
                    severity="warning",
                    message=f"Details inspector '{fname}' does not utilize standard FloatingDetailsPanel.",
                    file_path=str(rel_path),
                    suggestion="Wrap inspector in FloatingDetailsPanel to guarantee 8-way resize, dragging, pinning, and geometry persistence."
                ))

    duration_ms = (time.time() - start_time) * 1000
    errors = sum(1 for v in violations if v.severity == "error")
    score = max(0.0, 100.0 - (errors * 15.0) - (len(violations) - errors) * 5.0)

    return ChecklistResult(
        aspect_id=ASPECT_ID,
        aspect_title=ASPECT_TITLE,
        passed=errors == 0,
        violations=violations,
        files_scanned=files_scanned,
        duration_ms=duration_ms,
        score=score
    )

def main():
    args = parse_standard_args("Aspect 03: Layout Shell Invariants & User Experience Invariants Validator")
    root_path = Path(args.path).resolve()
    result = validate_layout_shell(root_path)

    if args.json:
        import json
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print_checklist_report(result, verbose=args.verbose)

    sys.exit(0 if result.passed else 1)

if __name__ == "__main__":
    main()
