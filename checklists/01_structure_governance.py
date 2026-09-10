#!/usr/bin/env python3
"""
Aspect 01: Project Architecture & Structural Governance
Verifies:
- Monolith vs Decoupled Structure (Bans monolithic flat src/)
- Mandatory Frontend / Backend Plane Separation (src/frontend & src/backend, packages/*, or entities/*)
- Anchored Output Patterns in .gitignore (/dist/, /.next/, /out/)
- Mandatory folder-level README.md / SKILL.md documentation
"""

from pathlib import Path
import json
import os
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

ASPECT_ID = "aspect_01_structure_governance"
ASPECT_TITLE = "Project Architecture & Structural Governance"

def validate_structure(root_dir: Path) -> ChecklistResult:
    start_time = time.time()
    violations = []
    files_scanned = 0

    # 1. Monolithic src/ Check
    src_dir = root_dir / "src"
    if src_dir.exists() and src_dir.is_dir():
        # Check if src has direct TS/JS files rather than proper plane separation
        direct_files = [f for f in src_dir.iterdir() if f.is_file() and f.suffix in {".ts", ".tsx", ".js", ".jsx"}]
        # Exception: index.ts or App.tsx or entrypoint
        non_entry_direct = [f for f in direct_files if f.name not in {"index.ts", "index.tsx", "main.ts", "main.tsx", "App.tsx", "vite-env.d.ts"}]
        
        # Check subdirectories of src
        subdirs = {d.name.lower() for d in src_dir.iterdir() if d.is_dir()}
        has_proper_planes = (
            ("frontend" in subdirs and "backend" in subdirs) or
            ("entities" in subdirs) or
            ("components" in subdirs and "lib" in subdirs) or
            ("app" in subdirs and "api" in subdirs) or
            ("client" in subdirs and "server" in subdirs)
        )

        if not has_proper_planes and len(subdirs) <= 1 and len(direct_files) > 3:
            violations.append(Violation(
                rule_id="monolithic-src-forbidden",
                severity="error",
                message="Monolithic flat 'src/' directory detected without explicit plane separation.",
                file_path=str(src_dir.relative_to(root_dir)),
                suggestion="Decompose codebase into 'src/frontend' and 'src/backend' (or 'packages/*' monorepo architecture) BEFORE implementing feature logic."
            ))

        if len(non_entry_direct) > 5:
            violations.append(Violation(
                rule_id="excessive-root-src-files",
                severity="warning",
                message=f"Detected {len(non_entry_direct)} loose code files sitting directly in root 'src/'.",
                file_path=str(src_dir.relative_to(root_dir)),
                suggestion="Move domain files into dedicated plane folders (e.g. 'src/frontend/components', 'src/backend/api')."
            ))

    # 2. Anchored .gitignore Check
    gitignore_path = root_dir / ".gitignore"
    if gitignore_path.exists():
        files_scanned += 1
        content = read_text_safe(gitignore_path) or ""
        lines = content.splitlines()
        for idx, line in enumerate(lines, 1):
            trimmed = line.strip()
            if not trimmed or trimmed.startswith("#"):
                continue
            if trimmed in {"dist", "dist/", "dist/**", "out", "out/", "build", "build/"}:
                violations.append(Violation(
                    rule_id="unanchored-gitignore-output",
                    severity="error",
                    message=f"Unanchored output pattern '{trimmed}' masks nested package build directories in monorepos.",
                    file_path=".gitignore",
                    line=idx,
                    snippet=trimmed,
                    suggestion=f"Anchor pattern with leading slash: '/{trimmed.lstrip('/')}' instead of '{trimmed}'."
                ))

    # 3. Directory Markdown Explanations Check
    # Check top-level concept and package directories for README.md or SKILL.md
    scanned_dirs = 0
    for p in root_dir.iterdir():
        if p.is_dir() and not p.name.startswith(".") and p.name not in {"node_modules", "dist", "coverage", "tmp"}:
            scanned_dirs += 1
            has_doc = (p / "README.md").exists() or (p / "SKILL.md").exists()
            if not has_doc and not (p.name.startswith("package") or p.name in {"tests", "test", "docs", "scripts"}):
                violations.append(Violation(
                    rule_id="missing-directory-docs",
                    severity="warning",
                    message=f"Top-level directory '{p.name}' is missing an architectural README.md or SKILL.md file.",
                    file_path=str(p.relative_to(root_dir)),
                    suggestion="Add a README.md explaining the directory's architectural role, layer, and manifest."
                ))

    duration_ms = (time.time() - start_time) * 1000
    errors = sum(1 for v in violations if v.severity == "error")
    score = max(0.0, 100.0 - (errors * 25.0) - (len(violations) - errors) * 5.0)

    return ChecklistResult(
        aspect_id=ASPECT_ID,
        aspect_title=ASPECT_TITLE,
        passed=errors == 0,
        violations=violations,
        files_scanned=files_scanned + scanned_dirs,
        duration_ms=duration_ms,
        score=score
    )

def main():
    args = parse_standard_args("Aspect 01: Project Architecture & Structural Governance Validator")
    root_path = Path(args.path).resolve()
    result = validate_structure(root_path)

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print_checklist_report(result, verbose=args.verbose)

    sys.exit(0 if result.passed else 1)

if __name__ == "__main__":
    main()
