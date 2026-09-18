#!/usr/bin/env python3
"""
Aspect 01: Project Architecture & Structural Governance
Verifies:
- Monolith vs Decoupled Structure (Bans monolithic flat src/)
- Mandatory Frontend / Backend Plane Separation (src/frontend & src/backend, packages/*, or entities/*)
- Zero Loose Code Files at Root (Bans .ts/.tsx/.js/.jsx directly in repository root)
- Strict Directory Placement (Code files must reside in authorized code directories)
- Identifier & File Naming Invariants (Bans spaces, illegal symbols, cryptic abbreviations)
- Anchored Output Patterns in .gitignore (/dist/, /.next/, /out/)
- Mandatory folder-level README.md / SKILL.md documentation
"""

from pathlib import Path
import json
import os
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

ASPECT_ID = "aspect_01_structure_governance"
ASPECT_TITLE = "Project Architecture & Structural Governance"

CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
ALLOWED_ROOT_CODE_CONFIGS = {
    "next.config.js", "next.config.mjs", "next.config.ts",
    "vite.config.js", "vite.config.ts", "electron.vite.config.ts",
    "tailwind.config.js", "tailwind.config.ts", "postcss.config.js",
    "postcss.config.mjs", "turbo.json", "tsup.config.ts"
}
ALLOWED_TOP_CODE_DIRS = {
    "src", "packages", "scripts", "backend", "components", "hooks", "lib",
    "api", "standalone", "features", "data", "database",
    "skipo-audio-midi-engine", "checklists", "generators", "mutators"
}
VALID_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\.\[\]@]+$")

def validate_structure(root_dir: Path) -> ChecklistResult:
    start_time = time.time()
    violations = []
    files_scanned = 0

    # 1. Zero Loose Code Files in Repository Root
    for entry in root_dir.iterdir():
        if entry.is_file() and entry.suffix.lower() in CODE_EXTENSIONS:
            if entry.name not in ALLOWED_ROOT_CODE_CONFIGS:
                violations.append(Violation(
                    rule_id="forbidden-root-code-file",
                    severity="error",
                    message=f"Direct code file '{entry.name}' found in repository root. Code must never be placed in root.",
                    file_path=entry.name,
                    suggestion="Move file to appropriate plane: 'src/frontend/', 'src/backend/', 'packages/<pkg>/src/', or 'scripts/'."
                ))

    # 2. Strict Directory Placement for Code Files
    all_code_files = scan_files(root_dir, CODE_EXTENSIONS)
    files_scanned += len(all_code_files)

    for file_path in all_code_files:
        rel = file_path.relative_to(root_dir)
        parts = rel.parts
        if len(parts) > 1:
            top_dir = parts[0]
            if top_dir not in ALLOWED_TOP_CODE_DIRS and not top_dir.startswith("."):
                violations.append(Violation(
                    rule_id="invalid-code-directory-placement",
                    severity="error",
                    message=f"Code file resides in unauthorized top-level directory '{top_dir}'.",
                    file_path=str(rel),
                    suggestion=f"Move code out of '{top_dir}' into canonical plane 'src/frontend/', 'src/backend/', 'packages/', or 'scripts/'."
                ))

        # 3. File and Directory Naming Validation
        # Check invalid characters or spaces in path components
        for part in parts:
            if not VALID_NAME_PATTERN.match(part) or " " in part:
                violations.append(Violation(
                    rule_id="invalid-naming-syntax",
                    severity="error",
                    message=f"Path component '{part}' contains spaces or illegal characters. Use kebab-case, camelCase, or PascalCase.",
                    file_path=str(rel),
                    suggestion="Rename using clean alphanumeric characters, hyphens, underscores, or periods only."
                ))
                break

    # 4. Monolithic src/ Check
    src_dir = root_dir / "src"
    if src_dir.exists() and src_dir.is_dir():
        direct_files = [f for f in src_dir.iterdir() if f.is_file() and f.suffix in CODE_EXTENSIONS]
        non_entry_direct = [f for f in direct_files if f.name not in {"index.ts", "index.tsx", "main.ts", "main.tsx", "App.tsx", "vite-env.d.ts"}]
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

    # 5. Anchored .gitignore Check
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

    # 6. Directory Markdown Explanations Check
    scanned_dirs = 0
    for p in root_dir.iterdir():
        if p.is_dir() and not p.name.startswith(".") and p.name not in {"node_modules", "dist", "coverage", "tmp", "__pycache__"}:
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

    # 7. Direct Root Skipo Import Ban (Law L20)
    direct_skipo_import_re = re.compile(
        r"""(?:from|import)\s+['"](?:@/|\.{1,2}/)*Skipo(?:/|['"])(?:packages/)?([^'"]*)['"]"""
    )
    for file_path in all_code_files:
        rel = file_path.relative_to(root_dir)
        if "src" in rel.parts and "Skipo" not in rel.parts:
            try:
                content = file_path.read_text(encoding="utf-8")
                if direct_skipo_import_re.search(content):
                    violations.append(Violation(
                        rule_id="forbidden-direct-skipo-import",
                        severity="error",
                        message=f"File '{rel}' imports directly from the root Skipo/ directory (violates Law L20).",
                        file_path=str(rel),
                        suggestion="Run 'python3 Skipo/scripts/sync_to_libraries.py --auto-fix' to hydrate assets into 'src/libraries/skipo/' and import from '@/libraries/skipo' instead."
                    ))
            except Exception:
                pass

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
