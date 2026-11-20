#!/usr/bin/env python3
"""Read-only, fail-closed offline application conformance certification.

Uses ONLY the released/main Skipo CLI and existing application package scripts.
An offline pass never attests live OAuth, database, or storage functionality.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

# Also imported by conformance_test.py using importlib.util directly, where
# scripts/ is not necessarily in sys.path. Load the co-shipped helper from
# this script's own immutable directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from skipo_process import platform_command

FRAMEWORK_ROOT = Path(__file__).resolve().parents[1]
REQUIRED_SCRIPTS = ("typecheck", "lint", "test", "build")
UNVERIFIED_LIVE = (
    "live_google_oauth", "live_database_read_write",
    "live_google_drive_operations", "live_backblaze_b2_operations",
)
EXCLUDED = {".git", "node_modules", ".next", "dist", "build", "coverage", ".turbo", ".cache", ".venv", "__pycache__", ".pytest_cache"}
PROVIDERS = ("@ultrst-armada/kloks", "@ultrst-armada/floks", "@ultrst-armada/krnl", "@ultrst-armada/frnlts", "@dinilmusick/gutts")


def _json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else None
    except (OSError, UnicodeError, ValueError):
        return None


def _digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_snapshot(root: Path) -> dict[str, str]:
    """Include config, metadata and owned sources; exclude generated/tool caches."""
    result = {}
    for base, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED)
        for name in sorted(names):
            path = Path(base) / name
            relative = path.relative_to(root).as_posix()
            if path.is_symlink():
                result[relative] = "symlink:" + os.readlink(path)
            elif path.is_file():
                try:
                    result[relative] = _digest(path.read_bytes())
                except OSError:
                    result[relative] = "unreadable"
    return result


def _git_sha(root: Path) -> str | None:
    """Prove the target belongs to a clean Git checkout before attributing SHA.

    A nested application can inherit the checkout's SHA only when its manifest is
    tracked. An unrelated/untracked folder under a repository is not eligible.
    """
    try:
        root = root.resolve()
        top = subprocess.run(["git", "-C", str(root), "rev-parse", "--show-toplevel"], capture_output=True, text=True, timeout=10)
        if top.returncode != 0:
            return None
        repository = Path(top.stdout.strip()).resolve()
        if repository != root and repository not in root.parents:
            return None
        relative = root.relative_to(repository)
        if repository != root:
            owned = subprocess.run(["git", "-C", str(repository), "ls-files", "--error-unmatch", "--", (relative / "package.json").as_posix()], capture_output=True, timeout=10)
            if owned.returncode != 0:
                return None
        status = subprocess.run(["git", "-C", str(repository), "status", "--porcelain", "--untracked-files=all", "--", relative.as_posix() or "."], capture_output=True, text=True, timeout=10)
        if status.returncode != 0 or status.stdout.strip():
            return None
        completed = subprocess.run(["git", "-C", str(repository), "rev-parse", "HEAD"], capture_output=True, text=True, timeout=10)
        sha = completed.stdout.strip()
        return sha if completed.returncode == 0 and re.fullmatch(r"[0-9a-f]{40}", sha) else None
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return None


def _execute(command: list[str], cwd: Path, timeout: int = 600) -> tuple[int | None, str, str, str | None]:
    try:
        proc = subprocess.run(platform_command(command), cwd=cwd, text=True, capture_output=True, timeout=timeout, check=False)
        return proc.returncode, proc.stdout, proc.stderr, None
    except subprocess.TimeoutExpired as exc:
        return None, "", "", f"Command timed out after {timeout}s"
    except OSError as exc:
        return None, "", "", f"Command unavailable: {exc}"


def _check(check_id: str, status: str, code: str, message: str, **extra: Any) -> dict[str, Any]:
    return {"id": check_id, "status": status, "code": code, "message": message, **extra}


def _expected_aspect_count(framework_root: Path) -> int | None:
    """Derive the expected full checklist size from the installed main source.

    Aspect result IDs are NOT canonical numeric labels: the current validators
    return values like aspect_01_structure_governance and "26". Never invent
    synthetic identifiers as a prerequisite to certification.
    """
    path = framework_root / "checklists" / "full_system_validator.py"
    try:
        source = ast.parse(path.read_text(encoding="utf-8"))
        for node in source.body:
            if not isinstance(node, ast.Assign) or not isinstance(node.value, ast.List):
                continue
            if not any(isinstance(target, ast.Name) and target.id == "ASPECT_RUNNERS" for target in node.targets):
                continue
            identifiers = []
            for entry in node.value.elts:
                if not isinstance(entry, ast.Tuple) or not entry.elts:
                    return None
                identifiers.append(ast.literal_eval(entry.elts[0]))
            return len(identifiers) if len(identifiers) >= 1 and len(identifiers) == len(set(identifiers)) and all(isinstance(v, str) for v in identifiers) else None
    except (OSError, UnicodeError, SyntaxError, ValueError, TypeError):
        pass
    return None


def _cli_check(framework_root: Path, app: Path, command: str) -> dict[str, Any]:
    script = framework_root / "scripts" / "skipo_cli.py"
    if not script.is_file():
        return _check("skipo_" + command, "unresolved", "SKIPO_CLI_MISSING", "Required main-branch CLI unavailable")
    cmd = [sys.executable, str(script), command, str(app)]
    code, stdout, stderr, error = _execute(cmd, framework_root)
    if error:
        return _check("skipo_" + command, "unresolved", "SKIPO_COMMAND_UNAVAILABLE", error, command=cmd)
    try:
        payload = json.loads(stdout)
    except (ValueError, TypeError):
        return _check("skipo_" + command, "unresolved", "SKIPO_INVALID_EVIDENCE", "CLI produced no valid JSON evidence", exit_code=code, stdout_sha256=_digest(stdout.encode()), stderr_excerpt=stderr[-1200:])
    if not isinstance(payload, dict):
        return _check("skipo_" + command, "unresolved", "SKIPO_INVALID_EVIDENCE", "CLI evidence is not an object", exit_code=code)
    if command == "check":
        aspects = payload.get("aspects")
        expected_count = _expected_aspect_count(framework_root)
        identifiers = {a.get("aspect_id") for a in aspects if isinstance(a, dict) and isinstance(a.get("aspect_id"), str)} if isinstance(aspects, list) else set()
        if (payload.get("profile") != "application" or expected_count is None
                or not isinstance(aspects, list) or len(aspects) != expected_count
                or len(identifiers) != expected_count):
            return _check("skipo_check", "unresolved", "SKIPO_VALIDATION_SURFACE_INCOMPLETE", "Application profile must report every checklist runner from installed main exactly once", exit_code=code, profile=payload.get("profile"), expected_aspect_count=expected_count, observed_aspects=sorted(identifiers), stderr_excerpt=stderr[-2000:], validator_error_excerpt=str(payload.get("stderr", ""))[-2000:])
        if any(not isinstance(a.get("passed"), bool) or not isinstance(a.get("violations"), list) or not isinstance(a.get("error_count"), int) for a in aspects):
            return _check("skipo_check", "unresolved", "SKIPO_VALIDATION_EVIDENCE_INCOMPLETE", "One or more aspect results are malformed", exit_code=code)
        passed = code == 0 and payload.get("overall_passed") is True and payload.get("total_errors") == 0 and all(a["passed"] for a in aspects)
        return _check("skipo_check", "passed" if passed else "failed", "SKIPO_CHECK_PASSED" if passed else "SKIPO_CHECK_FAILED", "Existing full-system validator", exit_code=code, total_errors=payload.get("total_errors"), total_warnings=payload.get("total_warnings"), failing_aspects=[a for a in aspects if a.get("error_count", 0) > 0])
    diagnostics = payload.get("diagnostics")
    if not isinstance(diagnostics, list) or not isinstance(payload.get("status"), str):
        return _check("skipo_verify", "unresolved", "SKIPO_VERIFICATION_EVIDENCE_INCOMPLETE", "Verification result lacks status/diagnostics", exit_code=code)
    passed = code == 0 and payload.get("ok") is True and payload["status"] in {"clean", "repaired"} and not diagnostics
    return _check("skipo_verify", "passed" if passed else "failed", "SKIPO_VERIFY_PASSED" if passed else "SKIPO_VERIFY_FAILED", "Existing canonical-state verifier", exit_code=code, canonical_status=payload["status"], diagnostics=diagnostics)


def _package_versions(app: Path, package: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    all_deps = {}
    for section in ("dependencies", "devDependencies", "optionalDependencies"):
        if isinstance(package.get(section), dict):
            all_deps.update(package[section])
    result = {}
    missing = []
    for name in sorted(all_deps):
        manifest = _json(app / "node_modules" / name / "package.json")
        resolved = manifest.get("version") if manifest else None
        result[name] = {"declared": all_deps[name], "installed": resolved}
        if not isinstance(resolved, str) or not resolved:
            missing.append(name)
    return result, missing


def _runner(app: Path) -> tuple[str | None, list[str]]:
    locks = [name for name in ("pnpm-lock.yaml", "package-lock.json", "yarn.lock") if (app / name).is_file()]
    if len(locks) != 1:
        return None, locks
    return {"pnpm-lock.yaml": "pnpm", "package-lock.json": "npm", "yarn.lock": "yarn"}[locks[0]], locks


def _script_preflight(name: str, scripts: Any) -> dict[str, Any] | None:
    """Share fail-closed package script checks between test and certification."""
    statement = scripts.get(name) if isinstance(scripts, dict) else None
    if not isinstance(statement, str) or not statement.strip():
        return _check("script_" + name, "failed", "SKIPO_SCRIPT_MISSING",
                      f"Required package script {name} missing")
    normalized = statement.strip().lower()
    recursive_package_script = re.search(
        rf"\b(?:npm|pnpm|yarn)\s+(?:run\s+)?{re.escape(name)}(?=$|[\s;&|])",
        normalized,
    )
    if (re.fullmatch(r"(?:true|:|exit\s+0|echo\b.*|printf\b.*)", normalized)
            or re.search(r"\bskipo(?:_cli\.py)?\s+test\b", normalized)
            or recursive_package_script):
        return _check("script_" + name, "failed", "SKIPO_SCRIPT_NONEXECUTABLE",
                      f"Script {name} is a placeholder or recursive",
                      declared_script=statement)
    return None


def _run_scripts(app: Path, scripts: dict[str, Any], runner: str, timeout: int) -> list[dict[str, Any]]:
    checks = []
    # Compilation often produces dist, .next or caches. Execute in a disposable copy,
    # with installed dependencies linked, never in the user's application directory.
    with tempfile.TemporaryDirectory(prefix="skipo-conformance-") as working:
        mirror = Path(working) / "app"
        shutil.copytree(app, mirror, symlinks=True, ignore=shutil.ignore_patterns(*EXCLUDED))
        modules = app / "node_modules"
        if modules.is_dir():
            (mirror / "node_modules").symlink_to(modules, target_is_directory=True)
        for name in REQUIRED_SCRIPTS:
            issue = _script_preflight(name, scripts)
            if issue:
                checks.append(issue)
                continue
            cmd = [runner, "run", name]
            code, stdout, stderr, error = _execute(cmd, mirror, timeout)
            if error:
                checks.append(_check("script_" + name, "unresolved", "SKIPO_SCRIPT_NOT_EXECUTED", error, command=cmd))
                continue
            passed = code == 0
            checks.append(_check("script_" + name, "passed" if passed else "failed", "SKIPO_SCRIPT_PASSED" if passed else "SKIPO_SCRIPT_FAILED", f"Executed real {name} script in disposable application copy", exit_code=code, command=cmd, stdout_sha256=_digest(stdout.encode()), stderr_excerpt=stderr[-1200:] if not passed else ""))
    return checks



def _coverage_gaps(app: Path) -> list[dict[str, Any]]:
    """Surface ambiguous app-owned provider lookalikes; do not pretend to resolve semantics.

    Skipo's current main validators catch numerous explicit violations but do not
    prove that every local auth/workspace/storage implementation is legitimate.
    These findings are unresolved, NEVER reported as confirmed duplicates.
    """
    state = _json(app / ".skipo" / "capabilities.json") or {}
    generated = state.get("generated", [])
    owned = {item["path"] for item in generated if isinstance(item, dict) and item.get("owner") == "skipo" and isinstance(item.get("path"), str)} if isinstance(generated, list) else set()
    ambiguous = []
    escapes = []
    for base, dirs, files in os.walk(app, followlinks=False):
        for name in list(dirs):
            path = Path(base) / name
            if name in EXCLUDED:
                dirs.remove(name)
            elif path.is_symlink():
                escapes.append(path.relative_to(app).as_posix())
                dirs.remove(name)
        for name in files:
            path = Path(base) / name
            rel = path.relative_to(app).as_posix()
            if path.is_symlink():
                escapes.append(rel)
                continue
            if path.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"} or rel in owned or not rel.startswith("src/"):
                continue
            try:
                source = path.read_text(encoding="utf-8")
            except (OSError, UnicodeError):
                escapes.append(rel)
                continue
            local_provider = re.search(r"\b(?:function|class|const|export\s+(?:default\s+)?function)\s+\w*(?:Auth(?:Provider|Form|Page|Service)|Workspace(?:Menu|Picker|Selector|Dialog))\b", source, re.I)
            direct_sdk = re.search(r"(?:from\s*|import\s*\(\s*|require\s*\(\s*)['\"](?:@aws-sdk/[^'\"]+|googleapis|@supabase/supabase-js)['\"]", source)
            if local_provider or direct_sdk:
                ambiguous.append({"path": rel, "reason": "unowned canonical capability lookalike" if local_provider else "direct external SDK (not exhaustively governed by existing validators)"})
    checks = []
    if escapes:
        checks.append(_check("symlink_coverage", "unresolved", "SKIPO_UNSUPPORTED_LINKS", "Symlinked/unreadable source surfaces require independent verification", paths=sorted(escapes)))
    if ambiguous:
        checks.append(_check("ownership_coverage", "unresolved", "SKIPO_CANONICAL_OWNERSHIP_AMBIGUOUS", "Main-branch static evidence cannot establish legitimacy of these unowned implementations", findings=sorted(ambiguous, key=lambda x: x["path"])))
    return checks


def certify(app: Path, framework_root: Path = FRAMEWORK_ROOT, require_live: bool = False, commit_sha: str | None = None, timeout: int = 600, dependency_install_failed: bool = False) -> dict[str, Any]:
    app, framework_root = app.resolve(), framework_root.resolve()
    before = source_snapshot(app) if app.is_dir() else {}
    framework_pkg = _json(framework_root / "package.json") or {}
    pkg = _json(app / "package.json")
    application_sha = _git_sha(app) if app.is_dir() else None
    framework_sha = commit_sha or _git_sha(framework_root)
    checks = []
    # CI must still write a report if frozen dependency installation fails;
    # installation failure is never evidence of a successful certification.
    if dependency_install_failed:
        checks.append(_check("dependency_installation", "unresolved", "SKIPO_DEPENDENCY_INSTALL_FAILED", "Frozen dependency installation failed; package evidence is incomplete"))
    if not app.is_dir() or pkg is None:
        checks.append(_check("preflight", "failed", "SKIPO_APP_INVALID", "Application directory and valid package.json are required"))
    elif (app / "skipo.harness.json").exists():
        checks.append(_check("preflight", "unresolved", "SKIPO_HARNESS_UNSUPPORTED", "Harness profile cannot certify an application"))
    elif app == framework_root:
        checks.append(_check("preflight", "unresolved", "SKIPO_FRAMEWORK_NOT_APPLICATION", "Framework source is not an application"))
    else:
        checks.append(_check("preflight", "passed", "SKIPO_APPLICATION_IDENTIFIED", "Application manifest found"))
    versions, missing = _package_versions(app, pkg or {}) if pkg else ({}, [])
    runner, locks = _runner(app) if pkg else (None, [])
    if not re.fullmatch(r"[0-9a-f]{40}", framework_sha or ""):
        checks.append(_check("provenance", "unresolved", "SKIPO_COMMIT_UNKNOWN", "Framework commit SHA unavailable; provide --commit-sha in CI"))
    else:
        checks.append(_check("provenance", "passed", "SKIPO_COMMIT_RECORDED", "Framework commit SHA recorded"))
    if runner is None:
        checks.append(_check("lockfile", "unresolved", "SKIPO_LOCKFILE_AMBIGUOUS", "Exactly one supported package lockfile is required", lockfiles=locks))
    else:
        checks.append(_check("lockfile", "passed", "SKIPO_LOCKFILE_IDENTIFIED", "Package manager selected from lockfile", lockfile=locks[0]))
    if missing:
        checks.append(_check("installed_packages", "unresolved", "SKIPO_PACKAGES_UNRESOLVED", "Installed package artifacts are missing", packages=missing))
    elif pkg:
        checks.append(_check("installed_packages", "passed", "SKIPO_PACKAGES_OBSERVED", "Package versions read from installed artifacts"))
    if pkg is not None and app.is_dir() and app != framework_root and not (app / "skipo.harness.json").exists():
        # A successful checklist with no source surface is not evidence of coverage.
        if not (app / "src" / "frontend").is_dir() or not (app / "src" / "backend").is_dir():
            checks.append(_check("source_layout", "unresolved", "SKIPO_SOURCE_PLANES_UNSUPPORTED", "Frontend/backend planes are required for current Skipo import-governance coverage"))
        else:
            checks.append(_check("source_layout", "passed", "SKIPO_SOURCE_PLANES_PRESENT", "Both source planes are available for validation"))
        checks.extend(_coverage_gaps(app))
        checks.extend([_cli_check(framework_root, app, "check"), _cli_check(framework_root, app, "verify")])
        if runner:
            checks.extend(_run_scripts(app, pkg.get("scripts", {}) if isinstance(pkg.get("scripts"), dict) else {}, runner, timeout))
        else:
            checks.extend(_check("script_" + name, "unresolved", "SKIPO_SCRIPT_NOT_EXECUTED", "Package manager lockfile missing") for name in REQUIRED_SCRIPTS)
    else:
        checks.extend(_check("script_" + name, "unresolved", "SKIPO_SCRIPT_NOT_EXECUTED", "Invalid or unsupported application") for name in REQUIRED_SCRIPTS)
    after = source_snapshot(app) if app.is_dir() else {}
    if before != after:
        paths = sorted({*before, *after} - {k for k in before.keys() & after.keys() if before[k] == after[k]})
        checks.append(_check("source_integrity", "failed", "SKIPO_SOURCE_MUTATED", "Certification mutated application source", paths=paths))
    else:
        checks.append(_check("source_integrity", "passed", "SKIPO_SOURCE_UNCHANGED", "Application source hash set unchanged"))
    if require_live:
        checks.append(_check("live_integrations", "unresolved", "SKIPO_LIVE_INTEGRATIONS_UNVERIFIED", "No live external integration verification evidence supplied"))
    status = "noncompliant" if any(c["status"] == "failed" for c in checks) else "unresolved" if any(c["status"] == "unresolved" for c in checks) else "compliant_offline"
    return {
        "schema_version": 1, "compliance_status": status, "offline_checks_passed": status == "compliant_offline",
        "live_end_to_end_certified": False, "application": str(app),
        "source_commit_sha": application_sha, "framework_commit_sha": framework_sha,
        "framework_version": framework_pkg.get("version"), "package_versions": versions,
        "source_sha256": _digest(json.dumps(before, sort_keys=True).encode()),
        "checks": checks, "unverified_integrations": [{"name": name, "status": "unverified", "reason": "No live external service evidence; fixtures do not qualify"} for name in UNVERIFIED_LIVE],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("application", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--commit-sha", type=str)
    parser.add_argument("--require-live", action="store_true")
    parser.add_argument("--dependency-install-failed", action="store_true", help="Include CI frozen-install failure in certification evidence")
    parser.add_argument("--timeout", type=int, default=600)
    args = parser.parse_args()
    report = certify(args.application, FRAMEWORK_ROOT, args.require_live, args.commit_sha, args.timeout, args.dependency_install_failed)
    document = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(document, encoding="utf-8")
    print(document, end="")
    return {"compliant_offline": 0, "noncompliant": 1, "unresolved": 2}[report["compliance_status"]]


if __name__ == "__main__":
    raise SystemExit(main())