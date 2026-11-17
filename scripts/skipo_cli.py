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

def create_project(name: str, target: Path, framework: str, force: bool) -> int:
    source = SCAFFOLDS / framework
    if not source.is_dir():
        print(json.dumps({"ok": False, "error": f"Unknown scaffold: {framework}"})); return 2
    if target.exists() and any(target.iterdir()) and not force:
        print(json.dumps({"ok": False, "error": f"Target is not empty: {target}"})); return 2
    target.mkdir(parents=True, exist_ok=True)
    for item in source.iterdir():
        if item.name in {".git", ".skipo"}:
            continue
        dest = target / item.name
        if dest.exists() and force:
            shutil.rmtree(dest) if dest.is_dir() else dest.unlink()
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
    print(json.dumps({"ok":True,"operation":"create","name":name,"framework":framework,"target":str(target),"skipo_version":VERSION}))
    return 0

def inspect_project(root: Path) -> int:
    data = manifest(root)
    observed = maintenance_inspect(root) if is_project(root) else {}
    state = observed.get("capability_state", {})
    payload = {"project": str(root), "skipo_project": bool(data), **data,
               "capabilities": state, "maintenance_observation": observed, "architecture": assess_architecture(root)}
    print(json.dumps(payload, indent=2))
    return 0

def check_project(root: Path) -> int:
    if not is_project(root):
        print(json.dumps({"ok":False,"error":"Not a recognized Skipo project."})); return 2
    result = subprocess.run(
        [sys.executable,str(ROOT/"checklists/full_system_validator.py"),str(root),"--json"],
        cwd=str(ROOT), capture_output=True, text=True
    )
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        payload={"overall_passed":result.returncode==0,"stdout":result.stdout,"stderr":result.stderr}
    payload["skipo_cli_version"]=VERSION
    payload["architecture"]=assess_architecture(root)
    payload["overall_passed"]=bool(payload.get("overall_passed") and payload["architecture"]["compliant"])
    print(json.dumps(payload, indent=2))
    return 0 if result.returncode == 0 and payload["overall_passed"] else 1

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
    ok = bool(legacy.get("ok") and independent.get("ok"))
    payload = {"operation": "verify", "ok": ok,
               "status": legacy.get("status", "clean") if ok else (
                   legacy.get("status") if not legacy.get("ok") else "unresolved"),
               "diagnostics": diagnostics, "diagnostic_count": len(diagnostics),
               "errors": [str(d.get("message")) for d in diagnostics],
               "architecture": architecture, "independent": independent}
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
    if not is_project(root):
        return 2
    pkg=root/"package.json"
    if not pkg.exists():
        return 2
    scripts=json.loads(pkg.read_text(encoding="utf-8")).get("scripts",{})
    runner = "pnpm" if (root / "pnpm-lock.yaml").exists() else ("yarn" if (root / "yarn.lock").exists() else "npm")
    commands=[]
    for name in ("typecheck","lint","test","build"):
        command = scripts.get(name)
        if command and "skipo_cli.py test" not in command and "skipo test" not in command:
            commands.append([runner,"run",name])
    for cmd in commands:
        if run(cmd,root):
            return 1
    if verify_project(root):
        return 1
    return 0

def main() -> int:
    parser=argparse.ArgumentParser(prog="skipo",description="Skipo deterministic application builder and composition framework.")
    sub=parser.add_subparsers(dest="command",required=True)
    p=sub.add_parser("create")
    p.add_argument("name"); p.add_argument("target",nargs="?",default=None)
    p.add_argument("--framework",choices=["nextjs","vite"],default="vite"); p.add_argument("--force",action="store_true")

    for cmd in ["inspect","check","diagnose","plan","adopt","sync","update","repair","fix","verify","test","policy","semantic","certify"]:
        q=sub.add_parser(cmd); q.add_argument("target",nargs="?",default=".")
    q=sub.choices["sync"]; q.add_argument("--install",action="store_true")
    q=sub.choices["repair"]; q.add_argument("--plan",action="store_true")
    q=sub.choices["certify"]; q.add_argument("--require-live",action="store_true"); q.add_argument("--output"); q.add_argument("--commit-sha")

    for cmd in ["add","remove"]:
        q=sub.add_parser(cmd)
        q.add_argument("items",nargs="+")
        q.add_argument("--plan",action="store_true")

    a=parser.parse_args()
    if a.command=="create":
        return create_project(a.name,Path(a.target or a.name).resolve(),a.framework,a.force)
    if a.command in {"inspect","check"}:
        return {"inspect":inspect_project,"check":check_project}[a.command](Path(a.target).resolve())
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
    items, target = parse_items(a.items)
    if not items:
        print(json.dumps({"ok":False,"error":"No capability supplied."})); return 2
    return compose_project(items,target,apply=not a.plan) if a.command=="add" else remove_project(items,target,apply=not a.plan)

if __name__=="__main__":
    raise SystemExit(main())
