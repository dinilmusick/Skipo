#!/usr/bin/env python3
"""Aspect 26: Skipo runtime environment governance."""
from pathlib import Path
import re
import sys
from common import Violation, ChecklistResult, parse_standard_args, print_checklist_report

ASPECT_ID = "26"
ASPECT_TITLE = "Skipo Runtime Environment Governance"
STANDARD_VARS = {"APP_URL", "SYSTEM_DATABASE_URL", "SYSTEM_DATABASE_URL_2", "SYSTEM_DATABASE_URL_3"}
SPECIAL_CASE_VARS = {"DEPM_GATEWAY_DOMAIN": "DEPM-Engine only"}
ENV_FILE_NAMES = {".env", ".env.example", ".env.local", ".env.development", ".env.production", ".env.test", ".env.staging"}
ENV_REF_PATTERNS = (
    re.compile(r"process\.env\.([A-Z][A-Z0-9_]*)"),
    re.compile(r"import\.meta\.env\.([A-Z][A-Z0-9_]*)"),
)
DECLARATION_PATTERN = re.compile(r"^\s*([A-Z][A-Z0-9_]*)\s*=")

def _is_depm_engine(root: Path) -> bool:
    pkg = root / "package.json"
    if pkg.is_file():
        try:
            import json
            name = str(json.loads(pkg.read_text(encoding="utf-8")).get("name", "")).lower()
            if "depm-engine" in name or name in {"depm", "@ultrst-armada/depm"}:
                return True
        except Exception:
            pass
    return "depm-engine" in root.name.lower()

def _allowed(name: str, root: Path) -> bool:
    return name in STANDARD_VARS or (name == "DEPM_GATEWAY_DOMAIN" and _is_depm_engine(root))

def _iter_files(root: Path):
    ignored = {".git", "node_modules", "dist", ".next", ".turbo", "coverage", "build", "out", ".cache", "tmp", "scaffolds", "scaffold"}
    for path in root.rglob("*"):
        if path.is_file() and not any(part in ignored for part in path.parts):
            if path.name in ENV_FILE_NAMES or path.suffix in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}:
                yield path

def validate(root: Path) -> ChecklistResult:
    violations, scanned, seen = [], 0, set()
    for path in _iter_files(root):
        scanned += 1
        text = path.read_text(encoding="utf-8", errors="replace")
        candidates = []
        if path.name in ENV_FILE_NAMES:
            for line_no, line in enumerate(text.splitlines(), 1):
                match = DECLARATION_PATTERN.match(line)
                if match: candidates.append((match.group(1), line_no, line))
        for pattern in ENV_REF_PATTERNS:
            for match in pattern.finditer(text):
                candidates.append((match.group(1), text[:match.start()].count("\n") + 1, match.group(0)))
        for name, line_no, snippet in candidates:
            if _allowed(name, root) or name in seen: continue
            seen.add(name)
            if name == "DEPM_GATEWAY_DOMAIN":
                message = "DEPM_GATEWAY_DOMAIN is reserved for DEPM-Engine only; it is not part of the standard Skipo app contract."
            else:
                message = f"{name} is outside the standard Skipo application environment contract. Extra variables are permitted only when genuinely required and are strongly discouraged."
            violations.append(Violation(
                rule_id="ENV-001", severity="warning", message=message,
                file_path=str(path.relative_to(root)), line=line_no, snippet=snippet,
                suggestion="Prefer APP_URL and SYSTEM_DATABASE_URL[_2/_3]; store service URLs/configuration in the system database or runtime settings. Add an exception only when unavoidable.",
            ))
    return ChecklistResult(
        aspect_id=ASPECT_ID, aspect_title=ASPECT_TITLE, passed=True,
        violations=violations, files_scanned=scanned,
        score=max(0.0, 100.0 - min(50.0, 10.0 * len(violations))),
    )

def main():
    args = parse_standard_args(ASPECT_TITLE)
    result = validate(Path(args.path).resolve())
    if args.json:
        import json
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print_checklist_report(result, args.verbose)
    sys.exit(0)

if __name__ == "__main__":
    main()
