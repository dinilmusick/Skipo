#!/usr/bin/env python3
"""Aspect 26: Skipo runtime environment governance."""
from pathlib import Path
import re
import sys
from common import Violation, ChecklistResult, parse_standard_args, print_checklist_report

ASPECT_ID = "26"
ASPECT_TITLE = "Skipo Runtime Environment Governance"
STANDARD_VARS = {"APP_URL", "SYSTEM_DATABASE_URL", "SYSTEM_DATABASE_URL_2", "SYSTEM_DATABASE_URL_3"}
TOOLING_VARS = {"NODE_ENV", "PORT", "CI", "DISABLE_HMR"}
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
    return (
        name in STANDARD_VARS
        or name in TOOLING_VARS
        or (name == "DEPM_GATEWAY_DOMAIN" and _is_depm_engine(root))
    )

def _iter_files(root: Path):
    ignored = {".git", "node_modules", "dist", ".next", ".turbo", "coverage", "build", "out", ".cache", "tmp", "scaffolds", "scaffold", "api", "scripts"}
    for path in root.rglob("*"):
        if path.is_file():
            try:
                rel_parts = set(path.relative_to(root).parts[:-1])
                if any(part in ignored for part in rel_parts):
                    continue
            except Exception:
                pass
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
            message = f"{name} violates the strict Skipo environment contract. Only APP_URL and SYSTEM_DATABASE_URL[_2/_3] are allowed; other environment variables are strongly discouraged."
            violations.append(Violation(
                rule_id="ENV-001", severity="warning", message=message,
                file_path=str(path.relative_to(root)), line=line_no, snippet=snippet,
                suggestion="Remove extra environment variables. Features must be zero-config or persist in the system database.",
            ))

    # Check .env.example contract
    env_example = root / ".env.example"
    if env_example.is_file():
        ex_text = env_example.read_text(encoding="utf-8", errors="replace")
        for req_var in ("APP_URL", "SYSTEM_DATABASE_URL"):
            if not re.search(rf"^\s*{req_var}\s*=", ex_text, re.MULTILINE):
                violations.append(Violation(
                    rule_id="ENV-003", severity="warning",
                    message=f".env.example is missing recommended environment contract: {req_var}",
                    file_path=str(env_example.relative_to(root)),
                    suggestion=f"Declare {req_var} in .env.example.",
                ))

    # Check wrangler deployment manifests for APP_URL definition
    for wrangler_name in ("wrangler.toml", "wrangler.jsonc", "wrangler.json"):
        w_path = root / wrangler_name
        if w_path.is_file():
            w_text = w_path.read_text(encoding="utf-8", errors="replace")
            app_url_found = False
            vars_match = re.search(r"^\s*\[vars\]([\s\S]*?)(?:^\s*\[|\Z)", w_text, re.MULTILINE)
            if vars_match:
                for line_no, vline in enumerate(vars_match.group(1).splitlines(), 1):
                    decl = DECLARATION_PATTERN.match(vline)
                    if decl:
                        var_name = decl.group(1)
                        if var_name == "APP_URL":
                            val = vline.split("=", 1)[1].strip().strip('"').strip("'")
                            if val:
                                app_url_found = True
                            else:
                                violations.append(Violation(
                                    rule_id="ENV-004", severity="error",
                                    message="APP_URL in wrangler [vars] cannot be empty. It must specify the instance deployment URL.",
                                    file_path=str(w_path.relative_to(root)),
                                    line=line_no, snippet=vline,
                                    suggestion="Set APP_URL = \"https://<app>.workers.dev\" for production or \"http://localhost:3000\" for local.",
                                ))
                        elif not _allowed(var_name, root):
                            violations.append(Violation(
                                rule_id="ENV-002", severity="error",
                                message=f"{var_name} in wrangler [vars] violates the strict Skipo environment contract. Only APP_URL and SYSTEM_DATABASE_URL[_2/_3] are allowed.",
                                file_path=str(w_path.relative_to(root)),
                                line=line_no, snippet=vline,
                                suggestion="Remove non-standard variables from wrangler [vars].",
                            ))
            if wrangler_name.endswith((".json", ".jsonc")):
                try:
                    clean_json = re.sub(r"//.*$", "", w_text, flags=re.MULTILINE)
                    import json
                    parsed = json.loads(clean_json)
                    vars_obj = parsed.get("vars", {})
                    if isinstance(vars_obj, dict):
                        if "APP_URL" in vars_obj and str(vars_obj["APP_URL"]).strip():
                            app_url_found = True
                        elif "APP_URL" in vars_obj:
                            violations.append(Violation(
                                rule_id="ENV-004", severity="error",
                                message="APP_URL in wrangler vars cannot be empty.",
                                file_path=str(w_path.relative_to(root)),
                                suggestion="Set APP_URL to the instance deployment URL in vars.",
                            ))
                        for var_name in vars_obj.keys():
                            if not _allowed(var_name, root):
                                violations.append(Violation(
                                    rule_id="ENV-002", severity="error",
                                    message=f"{var_name} in wrangler vars violates the strict Skipo environment contract. Only APP_URL and SYSTEM_DATABASE_URL[_2/_3] are allowed.",
                                    file_path=str(w_path.relative_to(root)),
                                    suggestion="Remove non-standard variables from wrangler vars.",
                                ))
                except Exception:
                    pass

            if not app_url_found:
                violations.append(Violation(
                    rule_id="ENV-004", severity="error",
                    message="wrangler configuration is missing mandatory [vars] APP_URL deployment instance definition.",
                    file_path=str(w_path.relative_to(root)),
                    suggestion="Add [vars] with APP_URL set to the deployment instance URL.",
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
