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

REQUIRED_COMPONENT_FILES = (\n    "src/frontend/components/aiko/AikoDirectChat.tsx",\n)\n\nREQUIRED_DIRS = (
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

    for rel in REQUIRED_COMPONENT_FILES:
        if not (root_dir / rel).is_file():
            violations.append(Violation("missing-skipo-aiko-direct-chat", "error", f"Missing mandatory global Aiko Direct Chat component: {rel}", rel))

    app_entry = root_dir / "src/frontend/App.tsx"
    if app_entry.exists():
        app_text = app_entry.read_text(encoding="utf-8", errors="ignore")
        if "AikoDirectChat" not in app_text:
            violations.append(Violation("missing-skipo-aiko-direct-chat-mount", "error", "The Skipo application root must mount Aiko Direct Chat so it overlays every page.", str(app_entry.relative_to(root_dir)), suggestion="Mount AikoDirectChat at src/frontend/App.tsx root with the application Aiko runtime."))

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

    files_scanned = len(REQUIRED_FILES) + len(REQUIRED_DIRS) + len(REQUIRED_COMPONENT_FILES)
    errors = sum(v.severity == "error" for v in violations)
    score = max(0.0, 100.0 - errors * 20.0)
    return ChecklistResult(ASPECT_ID, ASPECT_TITLE, errors == 0, violations, files_scanned, (time.time() - start) * 1000, score)

if __name__ == "__main__":
    args = parse_standard_args("Aspect 19: Canonical Skipo application frontend structure")
    result = validate_skipo_frontend_structure(Path(args.path).resolve())
    print_checklist_report(result, verbose=args.verbose)
    raise SystemExit(0 if result.passed else 1)
