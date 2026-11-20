#!/usr/bin/env python3
"""Skipo framework CLI: deterministic create, adopt, inspect, diagnose, plan, add, remove, sync, update, repair, verify and test."""
from __future__ import annotations
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCAFFOLDS = ROOT / "scaffolds"
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]

sys.path.insert(0, str(ROOT / "scripts"))
from skipo_capabilities import (
    adopt as capability_adopt,
    diagnose as capability_diagnose,
    plan as capability_plan,
    compose as capability_compose,
    remove as capability_remove,
    sync as capability_sync,
    update as capability_update,
    repair as capability_repair,
    verify as capability_verify,
    capability_state,
    install_dependencies,
)
from skipo_maintenance import (
    inspect as maintenance_inspect,
    build_plan as maintenance_plan,
    execute_plan as execute_maintenance_plan,
    verify as maintenance_verify,
)
from skipo_environment_contract import (
    diagnose as environment_diagnose,
    plan as environment_plan,
    repair as environment_repair,
    verify as environment_verify,
)
from skipo_capabilities import retire_known_duplicates
from skipo_lifecycle import assess as assess_architecture, independent_verify, transaction_verify
from skipo_reconciliation import reconcile as reconcile_transaction

def run(cmd: list[str], cwd: Path) -> int:
    return subprocess.run(cmd, cwd=str(cwd)).returncode

def manifest(root: Path) -> dict[str, Any]:
    p = root / ".skipo" / "project.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}

def is_project(root: Path) -> bool:
    return (root / ".skipo" / "project.json").exists() or (root / "package.json").exists()

def _create_error(message: str, *, code: str = "SKIPO_CREATE_INVALID", target: Path | None = None) -> int:
    """Reject before mutation; every creation error is machine-readable."""
    print(json.dumps({"ok": False, "operation": "create", "applied": False,
                      "code": code, "target": str(target) if target else None, "error": message}))
    return 2


def create_project(name: str, target: Path, framework: str, force: bool) -> int:
    """Create into a sibling staging directory and publish only on success.

    Existing project ownership always takes precedence over --force. Updating
    previously created apps belongs to the canonical transactional reconciler.
    """
    import re
    import tempfile

    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,63}", name):
        return _create_error("Application name must start with a letter and contain only letters, numbers, _ or - (max 64 characters).", target=target)
    if ".." in target.parts or target == target.parent:
        return _create_error("Target paths may not contain traversal or point to a filesystem root.", code="SKIPO_CREATE_UNSAFE_TARGET", target=target)
    # Do not resolve a user-supplied target before this test: resolving would
    # erase symlink traversal evidence and could redirect writes elsewhere.
    for component in (target, *target.parents):
        if component.is_symlink():
            return _create_error(f"Symlink component is not an authorized create target: {component}", code="SKIPO_CREATE_SYMLINK", target=target)
    source = SCAFFOLDS / framework
    if not source.is_dir():
        return _create_error(f"Unknown scaffold: {framework}", target=target)
    if not target.parent.is_dir():
        return _create_error(f"Target parent must already exist: {target.parent}", target=target)
    try:
        existing_empty = target.exists()
        if existing_empty:
            if not target.is_dir():
                return _create_error("Target exists and is not a directory.", code="SKIPO_CREATE_CONFLICT", target=target)
            if any(target.iterdir()):
                return _create_error(
                    "Existing project files are protected, including with --force. Use skipo plan and skipo update for transactional maintenance.",
                    code="SKIPO_CREATE_EXISTING_PROJECT", target=target,
                )
    except OSError as exc:
        return _create_error(f"Cannot inspect target safely: {exc}", target=target)

    staging: Path | None = None
    removed_empty_target = False
    published = False
    try:
        staging = Path(tempfile.mkdtemp(prefix=f".{target.name}.skipo-stage-", dir=str(target.parent)))
        result = _populate_create_project(name, staging, framework)
        if result != 0:
            return result
        # Protect against concurrent target creation during generation.
        for component in (target, *target.parents):
            if component.is_symlink():
                return _create_error("Symlink target appeared during creation; refusing publish.",
                                     code="SKIPO_CREATE_SYMLINK", target=target)
        if target.exists():
            if not existing_empty or not target.is_dir() or any(target.iterdir()):
                return _create_error("Target changed while generating; refusing to overwrite.",
                                     code="SKIPO_CREATE_CONCURRENT_CHANGE", target=target)
            target.rmdir()
            removed_empty_target = True
        staging.rename(target)
        published = True
        print(json.dumps({"ok": True, "operation": "create", "name": name,
                          "framework": framework, "target": str(target),
                          "skipo_version": VERSION, "applied": True}))
        return 0
    except (OSError, ValueError, KeyError) as exc:
        return _create_error(f"Staged creation failed without publishing a project: {exc}",
                             code="SKIPO_CREATE_ROLLED_BACK", target=target)
    finally:
        if not published and removed_empty_target and not target.exists():
            target.mkdir(exist_ok=True)
        if staging is not None and staging.exists():
            shutil.rmtree(staging)


def _populate_create_project(name: str, target: Path, framework: str) -> int:
    source = SCAFFOLDS / framework
    target.mkdir(parents=True, exist_ok=True)
    for item in source.iterdir():
        if item.name in {".git", ".skipo", ".npmignore"}:
            continue
        dest = target / item.name
        shutil.copytree(item, dest) if item.is_dir() else shutil.copy2(item, dest)
    for p in target.rglob("*"):
        if p.is_file() and p.suffix in {".json",".md",".ts",".tsx",".js",".mjs",".toml",".yml",".yaml"}:
            try:
                text = p.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            p.write_text(text.replace("MyApp", name).replace("my-app", name.lower().replace(" ", "-")), encoding="utf-8")
    d = target / ".skipo"
    d.mkdir(exist_ok=True)
    (d / "project.json").write_text(
        json.dumps({"framework":"skipo","scaffold":framework,"skipo_version":VERSION,"generated_by":"skipo"}, indent=2)+"\n",
        encoding="utf-8",
    )
    capability_adopt(target)
    # The scaffold contains an auth entrypoint, but the registry-owned
    # canonical auth page must also be generated and tracked in the ledger.
    # Do not claim a valid app if this generation conflicts or fails.
    canonical_auth = capability_compose(target, ["auth"], apply=True)
    if not canonical_auth.get("ok"):
        print(json.dumps({"ok": False, "operation": "create",
                          "error": "Canonical auth generation failed",
                          "capability": canonical_auth}, indent=2))
        return 1
    # Fresh apps immediately satisfy the same strict shell contract enforced
    # during later updates. No consumer-owned code is allowed outside tabs.
    from skipo_canonical_shell import reconcile_shell
    shell = reconcile_shell(target, apply=True)
    if not shell.get("ok", False):
        print(json.dumps({"ok": False, "operation": "create", "error":
                          "Canonical shell reconciliation failed", "shell": shell}, indent=2))
        return 1
    # A fresh scaffold starts at the installed framework version. Record
    # provenance and catalogue migration state from observed generated bytes,
    # not from a guessed version or unverified owner claim.
    try:
        import hashlib
        from skipo_migrations import initialize_migration_state, atomic_write_json
        from skipo_capabilities import generated_entries
        rel = "src/libraries/skipo/auth.ts"
        auth_path = target / rel
        asset = generated_entries(capability_state(target)).get(rel)
        observed = hashlib.sha256(auth_path.read_bytes()).hexdigest()
        if not asset or asset.get("owner") != "skipo" or asset.get("checksum") != observed:
            raise ValueError("Canonical auth asset provenance does not match the capability ledger")
        atomic_write_json(d / "generated-assets.json", {
            "schema_version": 1,
            "assets": {rel: {"owner": "skipo", "sha256": observed}},
        })
        initialize_migration_state(target, VERSION)
    except (ValueError, OSError, KeyError) as exc:
        print(json.dumps({"ok": False, "operation": "create",
                          "error": f"Cannot attest new scaffold state: {exc}"}))
        return 1
    return 0

def inspect_project(root: Path) -> int:
    data = manifest(root)
    observed = maintenance_inspect(root) if is_project(root) else {}
    state = observed.get("capability_state", {})
    payload = {"project": str(root), "skipo_project": bool(data), **data,
               "capabilities": state, "maintenance_observation": observed, "architecture": assess_architecture(root)}
    print(json.dumps(payload, indent=2))
    return 0

def check_project(root: Path, json_output: bool = False) -> int:
    from skipo_guardrails import check, print_check
    report = check(root)
    print_check(report, json_output=json_output)
    return 0 if report["ok"] else 1


def clean_project(root: Path, *, timeout: int = 60, on_timeout: str = "clean",
                  approve: bool = False, plan_only: bool = False,
                  show_diff: bool = False, json_output: bool = False) -> int:
    from skipo_guardrails import clean, clean_preview, print_clean_preview
    try:
        preview = clean_preview(root, show_diff=show_diff)
    except (ValueError, OSError) as exc:
        print(json.dumps({"ok": False, "operation": "clean", "error": str(exc),
                          "applied": False}, indent=2))
        return 2
    if not preview["actions"] or plan_only:
        print_clean_preview(preview, json_output=json_output)
        return 0
    result = clean(root, timeout=timeout, on_timeout=on_timeout,
                   approve=approve, show_diff=show_diff, preview=preview,
                   json_output=json_output)
    if json_output:
        print(json.dumps({"event": "result", **result}, separators=(",", ":")), flush=True)
    else:
        print("\nSKIPO CLEAN RESULT: " + result.get("decision", "unknown").upper())
        if result.get("error"):
            print("Error: " + str(result["error"]))
        if result.get("verification"):
            print("Verification: " + json.dumps(result["verification"], sort_keys=True))
    return 0 if result.get("ok") else 1


def diagnose_project(root: Path) -> int:
    if not (root / ".skipo" / "project.json").exists():
        capabilities = capability_diagnose(root)
        environment = environment_diagnose(root)
        architecture = assess_architecture(root)
        payload = {"ok": environment.get("ok", True) and not architecture["blocked"], "operation": "diagnose",
                   "capabilities": capabilities, "environment": environment, "architecture": architecture}
        print(json.dumps(payload, indent=2))
        return 0 if payload["ok"] else 1
    try:
        planned = maintenance_plan(root, VERSION)
    except (ValueError, OSError) as exc:
        print(json.dumps({"ok": False, "operation": "diagnose", "errors": [str(exc)]}, indent=2))
        return 2
    architecture = assess_architecture(root)
    payload = {"ok": planned.get("ok", False) and not architecture["blocked"], "operation": "diagnose",
               "architecture": architecture,
               "state": planned.get("state"), "findings": planned.get("findings", []),
               "proposed_actions": planned.get("actions", []),
               "dependency_migrations": planned.get("dependency_migrations", {}),
               "framework_upgrade": planned.get("framework_upgrade", {}),
               "environment": planned.get("environment", {}),
               "errors": planned.get("errors", [])}
    print(json.dumps(payload, indent=2))
    return 0 if payload["ok"] else 1

def plan_project(root: Path) -> int:
    if not (root / ".skipo" / "project.json").exists():
        architecture = assess_architecture(root)
        payload = {"ok": not architecture["blocked"], "operation": "plan",
                   "architecture": architecture,
                   "capabilities": capability_plan(root),
                   "environment": environment_plan(root)}
        payload["ok"] = payload["ok"] and payload["environment"].get("ok", True) and payload["capabilities"].get("ok", True)
        print(json.dumps(payload, indent=2))
        return 0 if payload["ok"] else 1
    try:
        payload = maintenance_plan(root, VERSION)
    except (ValueError, OSError) as exc:
        print(json.dumps({"ok": False, "operation": "plan", "errors": [str(exc)]}, indent=2))
        return 2
    payload["architecture"] = assess_architecture(root)
    payload["ok"] = bool(payload.get("ok") and not payload["architecture"]["blocked"])
    print(json.dumps(payload, indent=2))
    return 0 if payload.get("ok", False) else 1

def parse_items(items: list[str]) -> tuple[list[str], Path]:
    if items and Path(items[-1]).exists() and len(items) > 1:
        return items[:-1], Path(items[-1]).resolve()
    return items, Path(".").resolve()

def compose_project(items: list[str], target: Path, apply: bool) -> int:
    try:
        payload = capability_compose(target, items, apply=apply)
    except (ValueError, OSError) as exc:
        print(json.dumps({"ok":False,"error":str(exc)}, indent=2)); return 2
    print(json.dumps(payload, indent=2))
    return 0 if payload.get("ok", False) else 1

def remove_project(items: list[str], target: Path, apply: bool) -> int:
    try:
        payload = capability_remove(target, items, apply=apply)
    except (ValueError, OSError) as exc:
        print(json.dumps({"ok":False,"error":str(exc)}, indent=2)); return 2
    print(json.dumps(payload, indent=2))
    return 0 if payload.get("ok", False) else 1

def adopt_project(root: Path) -> int:
    try:
        payload = capability_adopt(root)
    except OSError as exc:
        print(json.dumps({"ok":False,"error":str(exc)}, indent=2)); return 2
    print(json.dumps(payload, indent=2))
    return 0

def sync_project(root: Path, install: bool) -> int:
    try:
        payload = capability_sync(root, install=install)
    except (ValueError, OSError) as exc:
        print(json.dumps({"ok":False,"error":str(exc)}, indent=2)); return 2
    print(json.dumps(payload, indent=2))
    return 0 if payload.get("ok", False) else 1

def update_project(root: Path) -> int:
    architecture = assess_architecture(root)
    if architecture["blocked"]:
        print(json.dumps({"ok": False, "operation": "update", "applied": False,
                          "error": "Architectural preflight blocked mutation",
                          "architecture": architecture}, indent=2))
        return 2
    try:
        if (root / ".skipo" / "project.json").exists():
            payload = reconcile_transaction(
                root, True, VERSION, with_environment=True,
                verify_hook=lambda target: transaction_verify(target, VERSION),
            )
            payload["operation"] = "update"
            payload["next_stage"] = "sync" if payload.get("ok") else "diagnose"
        else:
            # One-time legacy adoption retains its explicit manifest/provenance
            # contract. All established projects use the sealed transaction.
            plan = maintenance_plan(root, VERSION)
            payload = execute_maintenance_plan(root, plan, VERSION) if plan.get("ok") else {
                "ok": False, "operation": "update", "applied": False,
                "errors": plan.get("errors", []), "plan": plan,
            }
            payload["legacy_adoption"] = True
    except (ValueError, OSError) as exc:
        print(json.dumps({"ok": False, "operation": "update", "errors": [str(exc)]}, indent=2))
        return 2
    print(json.dumps(payload, indent=2))
    return 0 if payload.get("ok", False) else 1

def repair_project(root: Path, apply: bool) -> int:
    if not (root / ".skipo" / "project.json").exists():
        try:
            planned = environment_plan(root)
            if not planned.get("ok", False):
                payload = {"ok": False, "operation": "repair", "applied": False,
                           "environment": planned}
            elif apply:
                environment_result = environment_repair(root, apply=True)
                findings = capability_diagnose(root)
                retired = retire_known_duplicates(root, findings, apply=True)
                caps = sorted({f["capability"] for f in findings if f.get("classification") in {"adapt", "retire"}})
                composition = capability_compose(root, caps, apply=True) if caps else {"ok": True, "actions": [], "applied": True}
                capability_result = {"ok": composition.get("ok", False), "findings": findings,
                                     "retired": retired, "composition": composition, "applied": True}
                manifest_path = root / ".skipo" / "project.json"
                if manifest_path.exists():
                    manifest_path.unlink()
                payload = {
                    "ok": environment_result.get("ok", False) and capability_result.get("ok", False),
                    "operation": "repair",
                    "applied": True,
                    "environment": environment_result,
                    "capabilities": capability_result,
                }
            else:
                payload = {"ok": True, "operation": "repair", "planned": True,
                           "environment": planned}
        except (ValueError, OSError) as exc:
            print(json.dumps({"ok": False, "error": str(exc)}, indent=2))
            return 2
        print(json.dumps(payload, indent=2))
        return 0 if payload.get("ok", False) else 1
    try:
        architecture = assess_architecture(root)
        if architecture["blocked"]:
            payload = {"ok": False, "operation": "repair", "applied": False,
                       "errors": ["Architectural preflight blocked mutation"],
                       "architecture": architecture}
        else:
            payload = reconcile_transaction(
                root, apply, VERSION, with_environment=True,
                verify_hook=lambda target: transaction_verify(target, VERSION),
            )
    except (ValueError, OSError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2))
        return 2
    print(json.dumps(payload, indent=2))
    return 0 if payload.get("ok", False) else 1

def verify_project(root: Path) -> int:
    # Retain the stable canonical-state diagnostic contract: certification and
    # downstream tooling consume status, diagnostics and specific rule codes.
    legacy = maintenance_verify(root, VERSION) if ((root / ".skipo/project.json").exists() or root.resolve() == ROOT.resolve()) else {
        "ok": False, "status": "unresolved", "diagnostics": [{
            "code": "SKIPO_MANIFEST_MISSING", "status": "unresolved",
            "message": "Project has not been adopted by Skipo.",
            "path": ".skipo/project.json",
        }],
    }
    independent = independent_verify(root, VERSION)
    diagnostics = list(legacy.get("diagnostics", []))
    architecture = independent.get("architecture", {})
    for finding in architecture.get("policy", {}).get("diagnostics", []):
        if finding.get("state") != "compliant":
            diagnostics.append({
                "code": finding.get("code", "SKP-POL-UNKNOWN"),
                "status": "unsafe/ambiguous" if finding.get("state") in ("ambiguous", "blocked") else "repairable",
                "message": finding.get("message", "Architectural constraint violation"),
                "path": finding.get("path"),
            })
    for finding in architecture.get("semantic", {}).get("findings", []):
        diagnostics.append({
            "code": finding.get("code", "SKP-SEM-UNKNOWN"),
            "status": "unsafe/ambiguous" if finding.get("certainty") == "ambiguous" else "unresolved",
            "message": finding.get("message", "Semantic boundary violation"),
            "path": finding.get("file"),
        })
    for finding in architecture.get("environment", {}).get("findings", []):
        diagnostics.append({
            "code": "SKIPO_CONSTRAINT_ENV-001",
            "status": "unresolved",
            "message": str(finding.get("classification", "environment")) + ": " + str(finding.get("variable", "")),
            "path": finding.get("path"),
        })
    for error in independent.get("dependency_migrations", {}).get("errors", []):
        diagnostics.append({"code": "SKIPO_DEPENDENCY_MIGRATION_INCOMPLETE",
                            "status": "unresolved", "message": error})
    if architecture.get("semantic", {}).get("status") == "blocked" and not architecture.get("semantic", {}).get("findings"):
        diagnostics.append({"code": "SKP-SEM-EXECUTION-FAILED", "status": "invalid",
                            "message": "Semantic analysis did not provide findings"})
    # A Vite application cannot be compliant if its common source diverges
    # from the Skipo scaffold. The only custom source boundary is main tabs.
    shell = {"ok": True, "noop": True, "actions": []}
    if (root / "vite.config.ts").is_file() and (root / "package.json").is_file():
        from skipo_canonical_shell import plan_shell
        try:
            shell = plan_shell(root)
        except (ValueError, OSError) as exc:
            shell = {"ok": False, "noop": False, "actions": [], "error": str(exc)}
        if not shell.get("ok", False):
            diagnostics.append({"code": "SKIPO_CANONICAL_SHELL_INVALID", "status": "unresolved",
                                "message": shell.get("error", "Cannot inspect canonical shell")})
        else:
            for action in shell.get("actions", []):
                diagnostics.append({
                    "code": "SKIPO_NONCANONICAL_SOURCE", "status": "repairable",
                    "message": f"{action['action']}: {action['path']}; run skipo update --pages",
                    "path": action["path"],
                })
    ok = bool(legacy.get("ok") and independent.get("ok")
              and shell.get("ok", False) and shell.get("noop", False))
    payload = {"operation": "verify", "ok": ok,
               "status": legacy.get("status", "clean") if ok else (
                   legacy.get("status") if not legacy.get("ok") else "unresolved"),
               "diagnostics": diagnostics, "diagnostic_count": len(diagnostics),
               "errors": [str(d.get("message")) for d in diagnostics],
               "architecture": architecture, "independent": independent,
               "canonical_shell": shell}
    print(json.dumps(payload, indent=2))
    return 0 if ok else 1

def certify_project(root: Path, require_live: bool = False, output: str | None = None,
                    commit_sha: str | None = None) -> int:
    from skipo_conformance import certify, FRAMEWORK_ROOT
    payload = certify(root, FRAMEWORK_ROOT, require_live=require_live, commit_sha=commit_sha)
    rendered = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    if output:
        path = Path(output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return {"compliant_offline": 0, "noncompliant": 1, "unresolved": 2}[payload["compliance_status"]]

def test_project(root: Path) -> int:
    """Run all four executable quality gates; never silently skip one."""
    from skipo_conformance import REQUIRED_SCRIPTS, _runner, _script_preflight

    package_path = root / "package.json"
    if not is_project(root) or not package_path.is_file():
        print(json.dumps({"ok": False, "operation": "test", "error": "Application package.json is required"}))
        return 2
    try:
        package = json.loads(package_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError) as exc:
        print(json.dumps({"ok": False, "operation": "test", "error": f"Invalid package.json: {exc}"}))
        return 2
    if not isinstance(package, dict):
        print(json.dumps({"ok": False, "operation": "test", "error": "package.json must be an object"}))
        return 2

    runner, locks = _runner(root)
    if runner is None:
        print(json.dumps({"ok": False, "operation": "test", "error":
                          "Exactly one supported lockfile is required", "lockfiles": locks}))
        return 2
    scripts = package.get("scripts")
    failures = [issue for name in REQUIRED_SCRIPTS
                if (issue := _script_preflight(name, scripts)) is not None]
    if failures:
        print(json.dumps({"ok": False, "operation": "test", "error":
                          "Required executable package scripts are missing or unsafe",
                          "diagnostics": failures}, indent=2))
        return 2

    for name in REQUIRED_SCRIPTS:
        command = [runner, "run", name]
        try:
            status = run(command, root)
        except OSError as exc:
            print(json.dumps({"ok": False, "operation": "test",
                              "error": f"Cannot execute {name}: {exc}", "command": command}))
            return 2
        if status != 0:
            print(json.dumps({"ok": False, "operation": "test",
                              "error": f"Quality gate {name} failed",
                              "command": command, "exit_code": status}))
            return 1
    return verify_project(root)

def main() -> int:
    if sys.argv[1:2] == ["package"]:
        from skipo_packager import main as package_main
        return package_main(sys.argv[2:])
    if sys.argv[1:2] == ["native-peer"]:
        from skipo_native_peer import main as native_peer_main
        return native_peer_main(sys.argv[2:])
    # Friendly full-stack page commands are aliases for the same atomic
    # reconciler as "skipo add auth/workspace/main". They never stop at JSX.
    command_aliases = {
        "auth": "auth", "login": "auth",
        "workspacemenu": "workspace", "workspace": "workspace",
        "mainpage": "main",
    }
    if len(sys.argv) > 1 and sys.argv[1].lower() in command_aliases:
        from skipo_canonical_shell import reconcile_shell
        page_parser = argparse.ArgumentParser(prog="skipo " + sys.argv[1])
        page_parser.add_argument("target", nargs="?", type=Path, default=Path.cwd())
        page_parser.add_argument("--plan", action="store_true")
        options = page_parser.parse_args(sys.argv[2:])
        try:
            result = reconcile_shell(options.target.resolve(), apply=not options.plan)
            result["requested_stack"] = command_aliases[sys.argv[1].lower()]
            print(json.dumps(result, indent=2))
            return 0 if result["ok"] else 1
        except (ValueError, OSError) as exc:
            print(json.dumps({"ok": False, "error": str(exc)}))
            return 1
    if sys.argv[1:3] in (["update", "--pages"], ["repair", "shell"]) or (
        sys.argv[1:2] == ["repair"] and
        sys.argv[2:3] in (["auth"], ["login"], ["workspace"], ["main"])
    ):
        from skipo_canonical_shell import UnsafeShellRepair, reconcile_shell
        page_parser = argparse.ArgumentParser(prog="skipo " + " ".join(sys.argv[1:3]))
        page_parser.add_argument("target", nargs="?", type=Path, default=Path.cwd())
        page_parser.add_argument("--plan", action="store_true")
        options = page_parser.parse_args(sys.argv[3:])
        try:
            result = reconcile_shell(options.target.resolve(), apply=not options.plan)
            print(json.dumps(result, indent=2))
            return 0 if result.get("ok", False) else 1
        except (ValueError, OSError) as exc:
            print(json.dumps({"ok": False, "operation": "canonical-shell", "error": str(exc)}))
            return 1
    parser=argparse.ArgumentParser(prog="skipo",description="Skipo deterministic application builder and composition framework.")
    parser.add_argument("--version", action="version", version=VERSION)
    sub=parser.add_subparsers(dest="command",required=True)
    p=sub.add_parser("create")
    p.add_argument("name"); p.add_argument("target",nargs="?",default=None)
    p.add_argument("--framework",choices=["vite"],default="vite"); p.add_argument("--force",action="store_true")

    for cmd in ["inspect","check","diagnose","plan","adopt","sync","update","repair","fix","verify","test","policy","semantic","certify","clean"]:
        q=sub.add_parser(cmd); q.add_argument("target",nargs="?",default=".")
    q=sub.choices["check"]; q.add_argument("--json",action="store_true"); q.add_argument("--human",action="store_true")
    q=sub.choices["clean"]; q.add_argument("--timeout",type=int,default=60); q.add_argument("--on-timeout",choices=["clean","cancel"],default="clean"); q.add_argument("--approve",action="store_true"); q.add_argument("--plan",action="store_true"); q.add_argument("--diff",action="store_true"); q.add_argument("--json",action="store_true")
    q=sub.choices["sync"]; q.add_argument("--install",action="store_true")
    q=sub.choices["repair"]; q.add_argument("--plan",action="store_true")
    q=sub.choices["certify"]; q.add_argument("--require-live",action="store_true"); q.add_argument("--output"); q.add_argument("--commit-sha")

    for cmd in ["add","remove"]:
        q=sub.add_parser(cmd)
        q.add_argument("items",nargs="+")
        q.add_argument("--plan",action="store_true")

    service_group=sub.add_parser("service", help="Scaffold and manage application-owned Krnl services")
    service_commands=service_group.add_subparsers(dest="service_action",required=True)
    for action in ["create", "new", "functionality", "helper", "bind", "repair", "verify"]:
        q=service_commands.add_parser(action)
        q.add_argument("name", help="Alphanumeric service name (e.g. Weather)")
        if action in {"functionality", "helper"}:
            q.add_argument("member", help="Lower-camel-case functionality/helper name")
        q.add_argument("target", nargs="?", default=".")
        if action != "verify":
            q.add_argument("--plan", action="store_true", help="Show the exact write-set without modifying files")
        if action == "repair":
            q.add_argument("--reset", action="store_true", help="Backup and restore altered Skipo-managed scaffolds")

    a, trailing = parser.parse_known_args()
    # Python 3.11 treats an optional positional after --plan/--reset as
    # unrecognized for nested subparsers. Accept exactly one service target.
    if trailing and a.command == "service" and len(trailing) == 1 and a.target == "." and not trailing[0].startswith("-"):
        a.target = trailing[0]
        trailing = []
    if trailing:
        parser.error("unrecognized arguments: " + " ".join(trailing))
    if a.command == "service":
        from skipo_service_scaffolds import perform
        try:
            result = perform(Path(a.target), a.service_action, a.name,
                             member=getattr(a, "member", None),
                             plan=getattr(a, "plan", False),
                             reset=getattr(a, "reset", False))
        except (ValueError, OSError, json.JSONDecodeError) as exc:
            result = {"ok": False, "operation": a.service_action, "applied": False, "error": str(exc)}
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0 if result.get("ok") else 2
    if a.command=="create":
        return create_project(a.name,Path(a.target or a.name).absolute(),a.framework,a.force)
    if a.command == "inspect":
        return inspect_project(Path(a.target).resolve())
    if a.command == "check":
        return check_project(Path(a.target).resolve(), json_output=(a.json or (not a.human and not sys.stdout.isatty())))
    if a.command == "clean":
        return clean_project(Path(a.target).resolve(), timeout=a.timeout,
                             on_timeout=a.on_timeout, approve=a.approve,
                             plan_only=a.plan, show_diff=a.diff, json_output=a.json)
    if a.command=="diagnose":
        return diagnose_project(Path(a.target).resolve())
    if a.command=="plan":
        return plan_project(Path(a.target).resolve())
    if a.command=="adopt":
        return adopt_project(Path(a.target).resolve())
    if a.command=="sync":
        return sync_project(Path(a.target).resolve(), a.install)
    if a.command=="update":
        return update_project(Path(a.target).resolve())
    if a.command=="verify":
        return verify_project(Path(a.target).resolve())
    if a.command=="test":
        return test_project(Path(a.target).resolve())
    if a.command=="certify":
        return certify_project(Path(a.target).resolve(), a.require_live, a.output, a.commit_sha)
    if a.command in {"policy", "semantic"}:
        layer = assess_architecture(Path(a.target).resolve())[a.command]
        print(json.dumps(layer, indent=2))
        return 0 if layer.get("state", layer.get("status")) == "compliant" else 1
    if a.command in {"repair", "fix"}:
        return repair_project(Path(a.target).resolve(), apply=not a.plan)
    if a.command == "add" and a.items[:2] == ["main", "tab"]:
        if len(a.items) not in (3, 4):
            parser.error('use skipo add main tab "Name" [target]')
        items = a.items[:3]
        target = Path(a.items[3] if len(a.items) == 4 else ".").resolve()
    else:
        items, target = parse_items(a.items)
    if a.command == "add" and items and (target / "vite.config.ts").is_file():
        page = "auth" if items[0] == "login" else items[0]
        if page in {"auth", "workspace", "main"} and (len(items) == 1 or items[:2] == ["main", "tab"]):
            from skipo_canonical_shell import reconcile_shell
            try:
                title = items[2] if len(items) == 3 else None
                result = reconcile_shell(target, apply=not a.plan, title=title)
                print(json.dumps(result, indent=2))
                return 0 if result["ok"] else 1
            except (ValueError, OSError) as exc:
                print(json.dumps({"ok": False, "error": str(exc)}))
                return 1
    if not items:
        print(json.dumps({"ok":False,"error":"No capability supplied."})); return 2
    return compose_project(items,target,apply=not a.plan) if a.command=="add" else remove_project(items,target,apply=not a.plan)

if __name__=="__main__":
    raise SystemExit(main())
