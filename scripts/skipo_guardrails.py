"""Unified read-only Skipo diagnostics and warned canonical-shell cleanup.

This module does not coordinate agents (ATAX owns work orchestration).
Only Skipo-owned canonical-shell paths are eligible for timed cleanup.
"""
from __future__ import annotations

import difflib
import hashlib
import json
import os
import re
import select
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", ".skipo", "node_modules", "dist", "build", "coverage", ".next", ".venv", "__pycache__"}


def _finding(category: str, code: str, message: str, *, path: str = "",
             severity: str = "error", line: int | None = None, suggestion: str = "") -> dict[str, Any]:
    result: dict[str, Any] = {"category": category, "code": str(code),
                              "severity": severity, "message": str(message), "path": str(path),
                              "suggestion": suggestion}
    if line is not None:
        result["line"] = line
    return result


def _section(category: str, findings: list[dict[str, Any]], *,
             status: str | None = None, details: Any = None) -> dict[str, Any]:
    status = status or ("fail" if any(x["severity"] == "error" for x in findings) else "pass")
    return {"category": category, "status": status, "findings": findings, "details": details}


def _run(command: list[str], cwd: Path, limit: int = 180) -> dict[str, Any]:
    try:
        completed = subprocess.run(command, cwd=str(cwd), text=True, capture_output=True,
                                   timeout=limit, check=False)
        return {"exit_code": completed.returncode, "stdout": completed.stdout,
                "stderr": completed.stderr,
                "output": (completed.stdout + "\n" + completed.stderr).strip()}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"exit_code": None, "stdout": "", "stderr": str(exc), "output": str(exc)}


def _project_scripts(root: Path) -> dict[str, str]:
    try:
        package = json.loads((root / "package.json").read_text(encoding="utf-8"))
        return package.get("scripts", {}) if isinstance(package.get("scripts", {}), dict) else {}
    except (ValueError, OSError):
        return {}


def _package_runner(root: Path) -> str | None:
    names = (["pnpm", "npm"] if (root / "pnpm-lock.yaml").exists() else
             ["yarn", "npm"] if (root / "yarn.lock").exists() else ["npm", "pnpm"])
    return next((tool for tool in names if shutil.which(tool)), None)


def _parse_tool_findings(category: str, output: str) -> list[dict[str, Any]]:
    """Split compiler and ESLint messages into individual file/line findings."""
    findings = []
    current_file = ""
    for raw in output.splitlines():
        line = raw.strip()
        match = re.match(r"^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$", line)
        if match:
            path, row, col, severity, code, message = match.groups()
            findings.append(_finding(category, code, message, path=path,
                                     line=int(row), severity=severity))
            continue
        match = re.match(r"^(.+?):(\d+):(\d+):\s*(error|warning)\s*[:\-]\s*(.+)$", line)
        if match:
            path, row, col, severity, message = match.groups()
            findings.append(_finding(category, "SKIPO_" + category.upper(),
                                     message, path=path, line=int(row), severity=severity))
            continue
        match = re.match(r"^(\d+):(\d+)\s+(error|warning)\s+(.+)$", line)
        if match and current_file:
            row, col, severity, message = match.groups()
            findings.append(_finding(category, "SKIPO_" + category.upper(),
                                     message, path=current_file, line=int(row), severity=severity))
            continue
        if (line.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")) and
                not line.startswith((">", "npm", "Error"))):
            current_file = line
    return findings


def _tool_section(root: Path, name: str, command: list[str] | None) -> dict[str, Any]:
    if not command:
        return _section(name, [], status="not-run", details="Tool or script is not configured")
    execution = _run(command, root)
    if execution["exit_code"] == 0:
        return _section(name, [], details={"command": command, "exit_code": 0})
    reason = "Analyzer unavailable" if execution["exit_code"] is None else "Analyzer reported errors"
    findings = _parse_tool_findings(name, execution["output"])
    if not findings:
        findings = [_finding(name, "SKIPO_" + name.upper() + "_FAILED",
            reason + ":\n" + execution["output"],
            suggestion="Fix the diagnostics and rerun skipo check.")]
    return _section(name, findings,
        status="blocked" if execution["exit_code"] is None else "fail",
        details={"command": command, "exit_code": execution["exit_code"], "raw_output": execution["output"]})


def _safe_lint_command(root: Path) -> list[str] | None:
    """Run an installed, explicitly read-only analyzer, never arbitrary npm scripts.

    npm/yarn/pnpm run lint can execute any JavaScript or shell command. Merely
    searching its text for --fix is not a read-only guarantee, and --plan must
    not write files as a side effect of its diagnostics preflight.
    """
    script = _project_scripts(root).get("lint")
    if not isinstance(script, str):
        return None
    forbidden = ("--fix", "--write", "rm ", "rimraf", "prettier --write",
                 "skipo clean", "skipo repair", "skipo update")
    if any(item in script.lower() for item in forbidden):
        return []
    # Do not execute project-controlled npm scripts. Only use the installed
    # ESLint binary with fixed non-fixing arguments for conventional lint tasks.
    if not re.fullmatch(r"\s*eslint(?:\s+\.|\s+src)?\s*", script):
        return None
    eslint = root / "node_modules" / ".bin" / "eslint"
    return [str(eslint), ".", "--no-fix"] if eslint.is_file() else None


def _code_syntax(root: Path) -> dict[str, Any]:
    findings: list[dict[str, Any]] = []
    checked = 0
    missing_js_parser = False
    node = shutil.which("node")
    for base, directories, files in os.walk(root, followlinks=False):
        directories[:] = [d for d in directories if d not in SKIP and not (Path(base) / d).is_symlink()]
        for file in files:
            path = Path(base) / file
            relative = path.relative_to(root).as_posix()
            if path.is_symlink():
                continue
            if file.endswith(".py"):
                try:
                    import ast
                    ast.parse(path.read_text(encoding="utf-8"), filename=relative)
                    checked += 1
                except (SyntaxError, UnicodeError, OSError) as exc:
                    findings.append(_finding("syntax", "PYTHON_SYNTAX", str(exc), path=relative,
                                             line=getattr(exc, "lineno", None)))
            elif path.suffix in (".js", ".mjs", ".cjs") and not node:
                missing_js_parser = True
            elif path.suffix in (".js", ".mjs", ".cjs") and node:
                run = _run([node, "--check", str(path)], root, limit=20)
                checked += 1
                if run["exit_code"] != 0:
                    findings.append(_finding("syntax", "JAVASCRIPT_SYNTAX", run["output"], path=relative))
            elif file in ("package.json", "skipo.providers.json") or (
                file.endswith(".json") and not file.startswith("tsconfig") and not file.endswith(".jsonc")
                and path.stat().st_size < 1000000):
                try:
                    json.loads(path.read_text(encoding="utf-8"))
                    checked += 1
                except (ValueError, UnicodeError, OSError) as exc:
                    findings.append(_finding("syntax", "JSON_SYNTAX", str(exc), path=relative))
    if missing_js_parser:
        findings.append(_finding("syntax", "SKIPO_NODE_MISSING",
            "Node.js is required to validate JavaScript syntax"))
    return _section("syntax", findings, status="blocked" if missing_js_parser else None,
        details={"files_checked": checked,
                 "typescript": "TypeScript and TSX parsing is handled by typecheck"})


def _architecture(root: Path) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    try:
        import skipo_lifecycle
        report = skipo_lifecycle.assess(root)
        for category, key, state_key, passing in (
            ("policy", "policy", "state", "compliant"),
            ("semantic", "semantic", "status", "compliant"),
            ("environment", "environment", "ok", True)):
            layer = report.get(key, {})
            findings: list[dict[str, Any]] = []
            entries = layer.get("diagnostics", layer.get("findings", []))
            if not isinstance(entries, list):
                entries = []
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                if entry.get("state") == "compliant":
                    continue
                findings.append(_finding(category, entry.get("code", "SKIPO_" + key.upper()),
                    entry.get("message", entry.get("classification", str(entry))),
                    path=entry.get("path", entry.get("file", "")),
                    severity="warning" if entry.get("severity") == "warning" else "error",
                    suggestion=entry.get("suggestion", "")))
            for error in layer.get("errors", []):
                findings.append(_finding(category, "SKIPO_" + key.upper() + "_ERROR", str(error)))
            passed = layer.get(state_key) == passing or (
                category == "semantic" and layer.get("status") == "not-applicable")
            if not passed and not findings:
                findings.append(_finding(category, "SKIPO_" + key.upper() + "_INCOMPLETE",
                                         "Analyzer did not establish compliance"))
            sections.append(_section(category, findings,
                                    status="pass" if passed and not findings else "fail",
                                    details={"state": layer.get(state_key)}))
    except Exception as exc:
        sections.append(_section("architecture", [_finding(
            "architecture", "SKIPO_ARCHITECTURE_UNAVAILABLE", str(exc))], status="blocked"))
    try:
        result = _run([sys.executable, str(ROOT / "checklists/full_system_validator.py"),
                       str(root), "--json"], ROOT, 240)
        if result["exit_code"] is None:
            raise RuntimeError(result["output"])
        report = json.loads(result["stdout"])
        findings = []
        for aspect in report.get("aspects", []):
            for item in aspect.get("violations", []):
                findings.append(_finding("constraints", item.get("rule_id", aspect.get("aspect_id", "SKIPO")),
                    item.get("message", "Constraint violation"), path=item.get("file_path", ""),
                    line=item.get("line"), severity=item.get("severity", "error"),
                    suggestion=item.get("suggestion", "")))
        # A zero exit code alone is not proof that all 26 canonical aspects
        # were assessed. A partially populated/contradictory JSON report must
        # never make "skipo check" report success.
        aspects = report.get("aspects")
        canonical_ids = {f"aspect_{number:02d}" for number in range(1, 27)}
        valid_aspects = (
            isinstance(aspects, list)
            and len(aspects) >= len(canonical_ids)
            and all(isinstance(item, dict) and item.get("passed") is True
                    for item in aspects)
            and canonical_ids.issubset(
                {item.get("aspect_id") for item in aspects})
        )
        certified = (
            result["exit_code"] == 0
            and report.get("overall_passed") is True
            and type(report.get("total_errors")) is int
            and report["total_errors"] == 0
            and valid_aspects
        )
        if not certified:
            findings.append(_finding(
                "constraints", "SKIPO_VALIDATOR_NOT_CERTIFIED",
                "Full 26-aspect validator did not independently certify success "
                "(exit status, summary, aspect coverage or error count is inconsistent).",
                suggestion="Inspect the validator output and rerun skipo check."))
        sections.append(_section("constraints", findings,
                                details={"score": report.get("overall_score"),
                                         "aspects": report.get("aspects", []),
                                         "profile": report.get("profile"),
                                         "overall_passed": report.get("overall_passed"),
                                         "total_errors": report.get("total_errors"),
                                         "total_warnings": report.get("total_warnings")}))
    except (ValueError, KeyError, RuntimeError) as exc:
        sections.append(_section("constraints", [
            _finding("constraints", "SKIPO_VALIDATOR_UNAVAILABLE", str(exc))], status="blocked"))
    try:
        from skipo_canonical_shell import plan_shell
        if (root / "vite.config.ts").exists() and (root / "package.json").exists():
            plan = plan_shell(root)
            findings = [_finding("canonical-shell", "SKIPO_NONCANONICAL_SOURCE",
                item["action"] + ": " + item["path"], path=item["path"],
                suggestion="Move custom functionality into supported boundaries before skipo clean.")
                for item in plan["actions"]]
            sections.append(_section("canonical-shell", findings,
                                    details={"actions": plan["actions"], "noop": plan["noop"]}))
        else:
            sections.append(_section("canonical-shell", [], status="not-run",
                details="Canonical shell planner applies to Skipo Vite applications"))
    except (OSError, ValueError) as exc:
        sections.append(_section("canonical-shell", [
            _finding("canonical-shell", "SKIPO_SHELL_PREFLIGHT_FAILED", str(exc))], status="blocked"))
    return sections


def check(root: Path) -> dict[str, Any]:
    """Collect every available diagnostic category, without modifying source."""
    root = root.resolve()
    if not (root / "package.json").is_file():
        return {"ok": False, "operation": "check", "root": str(root),
                "sections": [_section("project", [_finding(
                    "project", "SKIPO_PACKAGE_MISSING", "No package.json at target")])]}
    sections = _architecture(root)
    lint = _safe_lint_command(root)
    if lint == []:
        sections.append(_section("lint", [_finding("lint", "SKIPO_MUTATING_LINTER",
            "Lint script contains an autofix or mutation command; refusing read-only execution")], status="blocked"))
    else:
        sections.append(_tool_section(root, "lint", lint))
    local_tsc = root / "node_modules/.bin/tsc"
    if (root / "tsconfig.json").is_file() and local_tsc.is_file():
        # Incremental compilation may persist .tsbuildinfo even with noEmit.
        # Disable it explicitly instead of invoking a project-controlled script.
        type_command = [str(local_tsc), "--noEmit", "--incremental", "false",
                        "--pretty", "false"]
    else:
        type_command = None
    types = _tool_section(root, "types", type_command)
    if (root / "tsconfig.json").is_file() and type_command is None:
        types = _section("types", [_finding("types", "SKIPO_TYPES_UNAVAILABLE",
            "TypeScript project has no installed compiler or configured typecheck script")], status="blocked")
    sections.extend([types, _code_syntax(root)])
    errors = sum(sum(x["severity"] == "error" for x in section["findings"]) for section in sections)
    warnings = sum(sum(x["severity"] == "warning" for x in section["findings"]) for section in sections)
    incomplete = [section["category"] for section in sections if section["status"] == "blocked"]
    not_run = [s["category"] for s in sections if s["status"] == "not-run"]
    validator = next((section.get("details") for section in sections
                      if section["category"] == "constraints"), None) or {}
    ok = errors == 0 and not incomplete and not not_run
    # Preserve the stable top-level legacy validator evidence: Skipo's
    # independent certifier requires all 26 aspect records in the CLI JSON.
    return {"ok": ok, "operation": "check", "root": str(root),
            "schemaVersion": 1, "sections": sections,
            "profile": validator.get("profile", "unresolved"),
            "aspects": validator.get("aspects", []),
            "overall_passed": bool(ok and validator.get("overall_passed")),
            "total_errors": max(errors, validator.get("total_errors") or 0),
            "total_warnings": max(warnings, validator.get("total_warnings") or 0),
            "summary": {"errors": errors, "warnings": warnings, "blocked": incomplete,
                        "not_run": not_run, "complete": not incomplete and not not_run},
            "note": "Source is not modified. Tests and builds are separate commands; TypeScript syntax requires typecheck."}


def print_check(report: dict[str, Any], *, json_output: bool = False) -> None:
    if json_output:
        print(json.dumps(report, indent=2))
        return
    print("SKIPO CHECK — " + ("PASS" if report["ok"] else "ISSUES DETECTED"))
    print("Target: " + report["root"])
    for section in report["sections"]:
        print("\n[" + section["category"].upper() + "] " + section["status"].upper()
              + " (" + str(len(section["findings"])) + " findings)")
        for item in section["findings"]:
            place = item.get("path", "")
            if item.get("line"):
                place += ":" + str(item["line"])
            print("  " + item["severity"] + " [" + item["code"] + "] "
                  + (place + ": " if place else "") + item["message"])
            if item.get("suggestion"):
                print("    Fix: " + item["suggestion"])
    print("\nSummary: " + json.dumps(report.get("summary", {}), sort_keys=True))


def _sha(payload: Any) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def clean_preview(root: Path, *, show_diff: bool = False,
                  include_diagnostics: bool = True) -> dict[str, Any]:
    """Produce a stable, exhaustive path-level change report before any mutation."""
    from skipo_canonical_shell import plan_shell, _desired
    root = root.resolve()
    plan = plan_shell(root)
    desired = _desired(root)
    actions = []
    for item in plan["actions"]:
        path = root / item["path"]
        before = path.read_bytes() if path.is_file() else b""
        after = desired.get(item["path"], b"")
        action = {"action": item["action"], "path": item["path"],
                  "before_sha256": item["before_sha256"], "after_sha256": item["after_sha256"],
                  "existing_bytes_at_risk": len(before),
                  "estimated_existing_lines_at_risk": len(before.splitlines()),
                  "reason": "Outside canonical Skipo-managed contract"}
        if show_diff and (before or after) and len(before) + len(after) < 512000:
            try:
                action["diff"] = "".join(difflib.unified_diff(
                    before.decode("utf-8").splitlines(keepends=True),
                    after.decode("utf-8").splitlines(keepends=True),
                    fromfile="before/" + item["path"], tofile="after/" + item["path"]))
            except UnicodeDecodeError:
                action["diff"] = "(binary change)"
        actions.append(action)
    return {"operation": "clean", "ok": True, "root": str(root),
            "plan_id": _sha(plan["actions"]), "actions": actions,
            "summary": {"total": len(actions), "retire": sum(a["action"] == "retire" for a in actions),
                        "rewrite": sum(a["action"] == "rewrite" for a in actions),
                        "create": sum(a["action"] in ("create", "create-tab") for a in actions),
                        "existing_bytes_at_risk": sum(a["existing_bytes_at_risk"] for a in actions)},
            "ownership": plan["ownership"], "applied": False,
            "diagnostics": check(root) if include_diagnostics else None}


def _decision(timeout: int, on_timeout: str = "clean", *, quiet: bool = False) -> str:
    """Line-oriented stdin lets a human or agent respond within the deadline."""
    if timeout < 0:
        raise ValueError("timeout must be nonnegative")
    stream = sys.stderr if quiet else sys.stdout
    print("Decision: [clean] apply changes; [fix] or [cancel] leave files untouched.",
          file=stream, flush=True)
    print("If no response within " + str(timeout) + " seconds: " + on_timeout + ".",
          file=stream, flush=True)
    expiry = time.monotonic() + timeout
    available = True
    while True:
        remaining = expiry - time.monotonic()
        if remaining <= 0:
            return on_timeout
        if available:
            try:
                ready, _, _ = select.select([sys.stdin], [], [], min(remaining, 1))
            except (ValueError, OSError):
                ready = []
            if ready:
                line = sys.stdin.readline()
                if not line:
                    available = False
                else:
                    answer = line.strip().lower()
                    if answer in ("clean", "yes", "y", "proceed"):
                        return "clean"
                    if answer in ("cancel", "no", "n", "fix", "stop"):
                        return "cancel"
                    print("Unknown response. Choose clean, fix or cancel.", file=stream, flush=True)
        else:
            time.sleep(min(remaining, 1))


def clean(root: Path, *, timeout: int = 60, on_timeout: str = "clean",
          approve: bool = False, plan_only: bool = False,
          show_diff: bool = False, preview: dict[str, Any] | None = None,
          json_output: bool = False) -> dict[str, Any]:
    """Warn, allow fixes/cancel, then apply the existing reversible shell repair."""
    root = root.resolve()
    try:
        preview = preview if preview is not None else clean_preview(root, show_diff=show_diff)
    except (ValueError, OSError) as exc:
        failure = {"ok": False, "applied": False, "operation": "clean",
                   "error": str(exc), "decision": "blocked"}
        print_clean_preview(failure, json_output=json_output)
        return failure
    print_clean_preview(preview, json_output=json_output)
    preview["decision"] = "pending"
    if plan_only or not preview["actions"]:
        preview["decision"] = "planned" if plan_only else "noop"
        return preview
    # The caller prints and flushes the full preview *before* entering this function's wait.
    choice = "clean" if approve else _decision(timeout, on_timeout, quiet=json_output)
    if choice != "clean":
        return {**preview, "decision": "cancelled", "applied": False, "ok": True}
    try:
        # The plan can become stale while a person or agent performs manual fixes.
        current = clean_preview(root, show_diff=False, include_diagnostics=False)
        if current["plan_id"] != preview["plan_id"]:
            return {**preview, "ok": False, "applied": False, "decision": "stale",
                    "error": "Project changed during countdown; rerun skipo clean to preview a fresh plan."}
        from skipo_canonical_shell import reconcile_shell
        result = reconcile_shell(root, apply=True)
        return {**preview, "ok": bool(result.get("ok")), "decision": "applied" if result.get("ok") else "failed",
                "applied": bool(result.get("applied", False)),
                "verification": result.get("verification", {}), "error": result.get("error"),
                "rollback": result.get("rollback")}
    except (ValueError, OSError) as exc:
        return {**preview, "ok": False, "applied": False, "decision": "blocked", "error": str(exc)}


def print_clean_preview(report: dict[str, Any], *, json_output: bool = False) -> None:
    if json_output:
        print(json.dumps({"event": "preflight", **report}, separators=(",", ":")), flush=True)
        return
    if not report.get("ok"):
        print("SKIPO CLEAN BLOCKED: " + str(report.get("error")), flush=True)
        return
    print("SKIPO CLEAN — PRE-MUTATION IMPACT REPORT", flush=True)
    print("Plan ID: " + report["plan_id"], flush=True)
    print("Summary: " + json.dumps(report["summary"], sort_keys=True), flush=True)
    print("Managed scope: " + str(report["ownership"]["managed"]), flush=True)
    print("Protected custom tabs: " + report["ownership"]["custom_frontend"], flush=True)
    print("Protected backend code: " + report["ownership"]["custom_backend"], flush=True)
    for item in report["actions"]:
        print("  " + item["action"].upper() + " " + item["path"]
              + " (existing bytes: " + str(item["existing_bytes_at_risk"]) + ")",
              flush=True)
        if item.get("diff"):
            print(item["diff"], flush=True)
    if report.get("diagnostics") is not None:
        print("\nFULL CHECK FINDINGS (read-only preflight):", flush=True)
        print_check(report["diagnostics"])
    print("Skipo will aggressively restore canonical files listed above. "
          "No unlisted files are eligible for this transaction.", flush=True)
