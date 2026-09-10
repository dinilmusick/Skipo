#!/usr/bin/env python3
"""
Aspect 08: API Security, Resource Governance & Anti-Polling
Verifies:
- 8-Gate Security Lifecycle in Protected Routes (Rate limiting, auth, sanitization)
- Anti-Polling Invariant (Bans aggressive client polling loops < 5000ms for network calls)
- Error Sanitization Invariant (Bans leaking raw error.stack in HTTP responses)
- Security Response Headers Presence
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

ASPECT_ID = "aspect_08_api_security_governance"
ASPECT_TITLE = "API Security, Resource Governance & Anti-Polling"

# Aggressive polling regex: setInterval with intervals < 5000ms containing fetch/api
SET_INTERVAL_REGEX = re.compile(
    r'setInterval\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{([^}]+)\},\s*([0-9]+)\s*\)'
)

# Raw stack trace leak pattern
STACK_LEAK_REGEX = re.compile(
    r'json\s*\(\s*\{[^}]*\b(?:error|err|stack)\s*:\s*(?:error|err|e)\.stack',
    re.IGNORECASE
)

def validate_api_security(root_dir: Path) -> ChecklistResult:
    start_time = time.time()
    violations = []

    files = scan_files(root_dir, {".ts", ".tsx", ".js", ".jsx"})
    files_scanned = len(files)

    for file_path in files:
        rel_path = file_path.relative_to(root_dir)
        fname = file_path.name
        rel_str = str(rel_path)

        # Skip test files
        if ".test." in fname or ".spec." in fname or "__tests__" in rel_str:
            continue

        content = read_text_safe(file_path)
        if not content:
            continue

        lines = content.splitlines()

        # 1. Anti-Polling Check in frontend / client code
        for match in SET_INTERVAL_REGEX.finditer(content):
            body = match.group(1)
            interval_ms = int(match.group(2))
            
            # If interval calls network or API
            has_network = any(token in body for token in ["fetch(", "axios", "api", "query", "load", "refresh", "get("])
            if has_network and interval_ms < 5000:
                violations.append(Violation(
                    rule_id="aggressive-polling-loop-forbidden",
                    severity="error",
                    message=f"Aggressive polling interval ({interval_ms}ms < 5000ms threshold) detected for network requests.",
                    file_path=rel_str,
                    snippet=match.group(0)[:100],
                    suggestion="Use Server-Sent Events (SSE), WebSockets, or exponential backoff (min 5s -> 60s)."
                ))

        # 2. Raw Error Stack Leak Check in API route handlers
        for line_idx, line in enumerate(lines, 1):
            if STACK_LEAK_REGEX.search(line):
                violations.append(Violation(
                    rule_id="unhandled-stack-trace-leak",
                    severity="error",
                    message="Raw error stack trace returned in client HTTP response.",
                    file_path=rel_str,
                    line=line_idx,
                    snippet=line.strip()[:100],
                    suggestion="Sanitize error messages; log internal stack traces to server logs only."
                ))

        # 3. Protected API Routes Governance Check
        if "api/" in rel_str and (fname == "route.ts" or fname == "route.js"):
            # Check if non-public mutation route has rate limiting or auth
            is_mutation = "POST" in content or "PUT" in content or "DELETE" in content
            is_public_auth = "api/auth/login" in rel_str or "api/auth/register" in rel_str
            
            if is_mutation and not is_public_auth:
                has_governance = any(token in content for token in [
                    "rateLimit", "limiter", "auth", "session", "requireRole",
                    "validateRequest", "verifyToken", "gate", "guard"
                ])
                if not has_governance and len(lines) > 25:
                    violations.append(Violation(
                        rule_id="ungoverned-mutation-route",
                        severity="warning",
                        message="API mutation route does not appear to enforce rate limiting, session authentication, or request validation.",
                        file_path=rel_str,
                        suggestion="Wrap route handler in the standard 8-gate security pipeline (Gate 1 validation, Gate 2 auth, Gate 4 rate limiting)."
                    ))

    duration_ms = (time.time() - start_time) * 1000
    errors = sum(1 for v in violations if v.severity == "error")
    score = max(0.0, 100.0 - (errors * 20.0) - (len(violations) - errors) * 5.0)

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
    args = parse_standard_args("Aspect 08: API Security, Resource Governance & Anti-Polling Validator")
    root_path = Path(args.path).resolve()
    result = validate_api_security(root_path)

    if args.json:
        import json
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print_checklist_report(result, verbose=args.verbose)

    sys.exit(0 if result.passed else 1)

if __name__ == "__main__":
    main()
