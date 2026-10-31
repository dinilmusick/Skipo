#!/usr/bin/env python3
"""Aspect 19: Canonical Skipo application frontend structure."""

from pathlib import Path
import json
import re
import time

import sys
try:
    from .common import Violation, ChecklistResult, parse_standard_args, print_checklist_report
except ImportError:
    try:
        from common import Violation, ChecklistResult, parse_standard_args, print_checklist_report
    except ImportError:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from common import Violation, ChecklistResult, parse_standard_args, print_checklist_report

ASPECT_ID = "aspect_19_skipo_frontend_structure"
ASPECT_TITLE = "Skipo Frontend Structure"

REQUIRED_FILES = (
    "src/frontend/pages/auth/page.tsx",
    "src/frontend/pages/menus/workspaces/page.tsx",
    "src/frontend/pages/main/page.tsx",
    "src/frontend/pages/main/tabs/fod/page.tsx",
    "src/frontend/pages/main/tabs/aiko/page.tsx",
    "src/frontend/pages/settings/page.tsx",
    "src/frontend/pages/settings/tabs/themes/page.tsx",
    "src/frontend/pages/settings/tabs/accounts/page.tsx",
)

REQUIRED_DIRS = (
    "src/frontend/pages/main/tabs",
    "src/frontend/pages/main/tabs/fod",
    "src/frontend/pages/main/tabs/aiko",
)

ALLOWED_PAGE_ROOTS = {"auth", "menus", "main", "settings"}

def validate_skipo_frontend_structure(root_dir: Path) -> ChecklistResult:
    start = time.time()
    violations = []
    package_path = root_dir / "package.json"

    if not package_path.exists():
        return ChecklistResult(ASPECT_ID, ASPECT_TITLE, True, [], 0, (time.time() - start) * 1000, 100.0)

    try:
        package = json.loads(package_path.read_text(encoding="utf-8"))
    except Exception as exc:
        violations.append(Violation("skipo-package-invalid", "error", f"Unable to parse package.json: {exc}", "package.json"))
        return ChecklistResult(ASPECT_ID, ASPECT_TITLE, False, violations, 1, (time.time() - start) * 1000, 0.0)

    if "skipo" not in package:
        return ChecklistResult(ASPECT_ID, ASPECT_TITLE, True, [], 1, (time.time() - start) * 1000, 100.0)

    frontend = root_dir / "src" / "frontend"
    pages = frontend / "pages"

    for rel in REQUIRED_DIRS:
        if not (root_dir / rel).is_dir():
            violations.append(Violation("missing-skipo-page-directory", "error", f"Missing mandatory Skipo frontend directory: {rel}", rel))

    for rel in REQUIRED_FILES:
        if not (root_dir / rel).is_file():
            violations.append(Violation("missing-skipo-page", "error", f"Missing mandatory Skipo frontend page: {rel}", rel))

    if pages.is_dir():
        for entry in pages.iterdir():
            if entry.is_file():
                violations.append(Violation(
                    "loose-skipo-page-file", "error",
                    "src/frontend/pages must contain only the canonical page directories.",
                    str(entry.relative_to(root_dir)),
                    suggestion="Move application UI behind auth/, menus/, main/, or settings/."
                ))
            elif entry.is_dir() and entry.name not in ALLOWED_PAGE_ROOTS:
                violations.append(Violation(
                    "invalid-skipo-page-root", "error",
                    f"Non-canonical page root '{entry.name}' found under src/frontend/pages.",
                    str(entry.relative_to(root_dir)),
                    suggestion="Use auth/, menus/, main/, or settings/."
                ))

    main_page = root_dir / "src/frontend/pages/main/page.tsx"
    if main_page.exists():
        text = main_page.read_text(encoding="utf-8", errors="ignore").lower()
        if "immersive" not in text and "fullscreen" not in text:
            violations.append(Violation(
                "missing-main-immersive-mode", "error",
                "Main page must expose application-level immersive/fullscreen mode.",
                str(main_page.relative_to(root_dir)),
                suggestion="Implement a shell toggle that removes the Main top and bottom bars while preserving tab content."
            ))

    fod_page = root_dir / "src/frontend/pages/main/tabs/fod/page.tsx"
    aiko_page = root_dir / "src/frontend/pages/main/tabs/aiko/page.tsx"
    if fod_page.exists():
        fod_text = fod_page.read_text(encoding="utf-8", errors="ignore")
        if "FodModule" not in fod_text or "@ultrst-armada/floks/canvas-ui/fod" not in fod_text:
            sibling = fod_page.parent / "fod.tsx"
            if sibling.exists():
                fod_text += "\n" + sibling.read_text(encoding="utf-8", errors="ignore")
        if "FodModule" not in fod_text or "@ultrst-armada/floks/canvas-ui/fod" not in fod_text:
            violations.append(Violation(
                "invalid-fod-module-binding", "error",
                "Mandatory FOD tab must bind to the canonical Floks FodModule.",
                str(fod_page.relative_to(root_dir)),
            ))
    if aiko_page.exists():
        aiko_text = aiko_page.read_text(encoding="utf-8", errors="ignore")
        if "AikoModule" not in aiko_text or "@ultrst-armada/floks/canvas-ui/aiko" not in aiko_text:
            sibling = aiko_page.parent / "aiko.tsx"
            if sibling.exists():
                aiko_text += "\n" + sibling.read_text(encoding="utf-8", errors="ignore")
        if "AikoModule" not in aiko_text or "@ultrst-armada/floks/canvas-ui/aiko" not in aiko_text:
            violations.append(Violation(
                "invalid-aiko-module-binding", "error",
                "Mandatory Aiko tab must bind to the canonical Floks AikoModule.",
                str(aiko_page.relative_to(root_dir)),
            ))

    accounts_page = root_dir / "src/frontend/pages/settings/tabs/accounts/page.tsx"
    if accounts_page.exists():
        text = accounts_page.read_text(encoding="utf-8", errors="ignore")
        if "srkl" not in text.lower() or "sync" not in text.lower():
            violations.append(Violation(
                "missing-settings-srkl-sync", "error",
                "Mandatory Accounts tab must expose SRKL account synchronization.",
                str(accounts_page.relative_to(root_dir)),
                suggestion="Sync the authenticated user's app-relevant accounts from SRKL."
            ))

    files_scanned = len(REQUIRED_FILES) + len(REQUIRED_DIRS)
    errors = sum(v.severity == "error" for v in violations)
    score = max(0.0, 100.0 - errors * 20.0)
    return ChecklistResult(ASPECT_ID, ASPECT_TITLE, errors == 0, violations, files_scanned, (time.time() - start) * 1000, score)

if __name__ == "__main__":
    args = parse_standard_args("Aspect 19: Canonical Skipo application frontend structure")
    result = validate_skipo_frontend_structure(Path(args.path).resolve())
    print_checklist_report(result, verbose=args.verbose)
    raise SystemExit(0 if result.passed else 1)
