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
            message = f"{name} violates the strict Skipo environment contract. Only APP_URL and SYSTEM_DATABASE_URL[_2/_3] are allowed."
            violations.append(Violation(
                rule_id="ENV-001", severity="error", message=message,
                file_path=str(path.relative_to(root)), line=line_no, snippet=snippet,
                suggestion="Remove extra environment variables. Features must be zero-config or persist in the system database.",
            ))
    for wrangler_name in ("wrangler.toml", "wrangler.jsonc", "wrangler.json"):
        w_path = root / wrangler_name
        if w_path.is_file():
            w_text = w_path.read_text(encoding="utf-8", errors="replace")
            if re.search(r"^\s*\[vars\]", w_text, re.MULTILINE):
                violations.append(Violation(
                    rule_id="ENV-002", severity="error",
                    message="[vars] table is strictly forbidden in wrangler configuration. No custom env vars allowed.",
                    file_path=str(w_path.relative_to(root)),
                    suggestion="Remove [vars] section from wrangler config.",
                ))
    has_errors = any(v.severity == "error" for v in violations)
    return ChecklistResult(
        aspect_id=ASPECT_ID, aspect_title=ASPECT_TITLE, passed=not has_errors,
        violations=violations, files_scanned=scanned,
        score=0.0 if has_errors else 100.0,
    )

def main():
    args = parse_standard_args(ASPECT_TITLE)
    result = validate(Path(args.path).resolve())
    if args.json:
        import json
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print_checklist_report(result, args.verbose)
    sys.exit(0 if result.passed else 1)

if __name__ == "__main__":
    main()
