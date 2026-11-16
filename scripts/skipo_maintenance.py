"""Deterministic, state-aware maintenance orchestration for Skipo applications.

Planning is read-only. Execution consumes the exact plan, applies only declared
operations, then independently re-inspects the resulting application.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Callable

from skipo_state_registry import load_registry
from skipo_capabilities import (
    capability_state, generated_entries, sha256_text, compose,
)

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_PATH = ROOT / "architecture" / "capabilities" / "migrations.json"


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def version_tuple(value: str | None) -> tuple[int, ...]:
    match = re.search(r"(\d+(?:\.\d+){0,2})", value or "")
    return tuple(int(part) for part in match.group(1).split(".")) if match else (0,)


def _command_version(command: list[str]) -> str | None:
    if not shutil.which(command[0]):
        return None
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        return result.stdout.strip().splitlines()[0] if result.returncode == 0 and result.stdout.strip() else None
    except OSError:
        return None


def inspect(root: Path, environment: dict[str, str | None] | None = None,
            git_status: str | None = None) -> dict[str, Any]:
    """Observe target state without creating or modifying any files."""
    root = root.resolve()
    pkg_path = root / "package.json"
    manifest_path = root / ".skipo" / "project.json"
    package_error = None
    try:
        package = read_json(pkg_path, {})
        project = read_json(manifest_path, {})
        if not isinstance(package, dict) or not isinstance(project, dict):
            raise ValueError("package.json and .skipo/project.json must contain JSON objects")
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        package, project, package_error = {}, {}, str(exc)

    if environment is None:
        environment = {
            "node": _command_version(["node", "--version"]),
            "pnpm": _command_version(["pnpm", "--version"]),
            "npm": _command_version(["npm", "--version"]),
            "yarn": _command_version(["yarn", "--version"]),
        }
    if git_status is None:
        try:
            result = subprocess.run(
                ["git", "status", "--porcelain"], cwd=root,
                capture_output=True, text=True, check=False,
            )
            git_status = result.stdout if result.returncode == 0 else ""
        except OSError:
            git_status = ""

    state_dir = root / ".skipo"
    generated_drift = []
    cap_file = state_dir / "capabilities.json"
    cap_state = read_json(cap_file, {"schemaVersion": 1, "installed": {}, "generated": []})
    for rel, entry in generated_entries(cap_state).items():
        file_path = root / rel
        if not file_path.is_file():
            generated_drift.append({"path": rel, "reason": "missing"})
        elif entry.get("checksum") and sha256_text(file_path.read_text(encoding="utf-8")) != entry["checksum"]:
            generated_drift.append({"path": rel, "reason": "checksum-mismatch"})

    return {
        "root": str(root),
        "package": package,
        "project": project,
        "package_error": package_error,
        "git_dirty": bool(git_status.strip()),
        "git_status": sorted(line for line in git_status.splitlines() if line.strip()),
        "lockfile": next((name for name in ("pnpm-lock.yaml", "yarn.lock", "package-lock.json") if (root / name).exists()), None),
        "capability_state": cap_state,
        "generated_drift": sorted(generated_drift, key=lambda item: item["path"]),
        "environment": dict(sorted(environment.items())),
    }


def _environment_errors(state: dict[str, Any], contract: dict[str, Any]) -> list[str]:
    required = contract.get("environment", {})
    actual = state["environment"]
    errors = []
    node_required = required.get("node")
    node_actual = actual.get("node")
    if node_required and (not node_actual or version_tuple(node_actual) < version_tuple(node_required)):
        errors.append(f"Node {node_required} is required; detected {node_actual or 'unavailable'}.")
    manager_spec = required.get("packageManager", "")
    manager, _, manager_version = manager_spec.partition("@")
    manager_actual = actual.get(manager)
    if manager and (not manager_actual or (manager_version and version_tuple(manager_actual) < version_tuple(manager_version))):
        errors.append(f"{manager_spec} is required; detected {manager_actual or 'unavailable'}.")
    return errors


def build_plan(root: Path, framework_version: str,
               environment: dict[str, str | None] | None = None,
               git_status: str | None = None) -> dict[str, Any]:
    """Produce a stable, mutation-free plan from observed and canonical state."""
    canonical = load_registry()["applicationState"]
    state = inspect(root, environment=environment, git_status=git_status)
    actions: list[dict[str, Any]] = []
    errors = list(_environment_errors(state, canonical))
    if state["package_error"]:
        errors.append(state["package_error"])
    if not state["package"]:
        errors.append("Target package.json is missing or invalid.")

    project = state["project"]
    previous_framework = project.get("skipo_version", "0.0.0")
    if version_tuple(previous_framework) < version_tuple(framework_version):
        actions.append({"phase": "update", "action": "framework", "from": previous_framework, "to": framework_version})

    package = state["package"]
    current_dependencies = dict(package.get("dependencies", {}))
    canonical_dependencies = canonical.get("dependencies", {})
    for name, desired in sorted(canonical_dependencies.items()):
        current = current_dependencies.get(name)
        if current != desired:
            actions.append({"phase": "update", "action": "dependency", "package": name, "from": current, "to": desired})

    migrations = read_json(MIGRATIONS_PATH, {"migrations": []}).get("migrations", [])
    migration_state = read_json(root / canonical["migrations"]["stateFile"], {"applied": [], "pending": []})
    applied = set(migration_state.get("applied", []))
    pending_migrations = []
    for migration in sorted(migrations, key=lambda item: (version_tuple(item.get("version")), item.get("id", ""))):
        migration_id = migration.get("id")
        migration_version = migration.get("version", "0.0.0")
        if migration_id not in applied and version_tuple(migration_version) <= version_tuple(framework_version):
            paths = sorted(path for path in migration.get("retirePaths", []) if (Path(state["root"]) / path).exists())
            action = {"phase": "update", "action": "migration", "id": migration_id, "version": migration_version, "retire_paths": paths}
            actions.append(action)
            pending_migrations.append(migration_id)

    if not state["capability_state"].get("installed") and not (root / ".skipo" / "capabilities.json").exists():
        actions.append({"phase": "repair", "action": "initialize-capability-state"})
    for drift in state["generated_drift"]:
        actions.append({"phase": "repair", "action": "restore-generated-file", **drift})

    if state["lockfile"] is None or any(action["action"] == "dependency" for action in actions):
        actions.append({"phase": "sync", "action": "reconcile-lockfile", "lockfile": canonical.get("environment", {}).get("lockfile", "package-lock.json")})

    # Git dirtiness is a hard stop: the observed plan remains available, but update
    # will not mix framework-owned mutations with uncommitted application work.
    if state["git_dirty"]:
        errors.append("Working tree is dirty; commit or stash application changes before running skipo update.")

    ordered = sorted(actions, key=lambda item: (
        {"update": 0, "repair": 1, "sync": 2}.get(item["phase"], 9),
        item["action"], item.get("package", ""), item.get("id", ""), item.get("path", ""),
    ))
    return {
        "ok": not errors,
        "operation": "maintenance-plan",
        "schema_version": 1,
        "framework_version": framework_version,
        "state": state,
        "actions": ordered,
        "errors": sorted(errors),
        "pending_migrations": sorted(pending_migrations),
    }


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _run_lockfile_sync(root: Path, package: dict[str, Any]) -> dict[str, Any]:
    manager = package.get("packageManager", "").split("@", 1)[0]
    if not manager:
        manager = "pnpm" if (root / "pnpm-lock.yaml").exists() else ("yarn" if (root / "yarn.lock").exists() else "npm")
    commands = {
        "pnpm": ["pnpm", "install", "--lockfile-only", "--ignore-scripts"],
        "npm": ["npm", "install", "--package-lock-only", "--ignore-scripts"],
        "yarn": ["yarn", "install", "--mode=update-lockfile"],
    }
    command = commands.get(manager)
    if not command or not shutil.which(manager):
        return {"ok": False, "error": f"Required package manager '{manager}' is unavailable."}
    result = subprocess.run(command, cwd=root, capture_output=True, text=True, check=False)
    return {"ok": result.returncode == 0, "command": command, "returncode": result.returncode,
            "stdout": result.stdout[-4000:], "stderr": result.stderr[-4000:]}


def execute_plan(root: Path, plan: dict[str, Any], framework_version: str,
                 lockfile_sync: Callable[[Path, dict[str, Any]], dict[str, Any]] | None = None) -> dict[str, Any]:
    """Apply the precomputed plan, then verify by independently re-reading disk."""
    if not plan.get("ok"):
        return {"ok": False, "operation": "update", "applied": False, "errors": plan.get("errors", [])}
    if plan.get("framework_version") != framework_version:
        return {"ok": False, "operation": "update", "applied": False, "errors": ["Plan framework version does not match executor."]}

    root = root.resolve()
    state = plan["state"]
    package = dict(state["package"])
    project = dict(state["project"])
    actions = plan["actions"]
    migration_state_path = root / ".skipo" / "migration-state.json"
    migration_state = read_json(migration_state_path, {"schemaVersion": 1, "applied": [], "pending": []})
    completed = []

    for action in actions:
        if action["action"] == "dependency":
            package.setdefault("dependencies", {})[action["package"]] = action["to"]
        elif action["action"] == "framework":
            project.update({"framework": "skipo", "skipo_version": framework_version,
                            "updated_by": "skipo", "migration_policy": "deterministic-idempotent"})
        elif action["action"] == "migration":
            for rel in action["retire_paths"]:
                path = (root / rel).resolve()
                if root not in path.parents:
                    return {"ok": False, "operation": "update", "applied": False,
                            "errors": [f"Migration path escapes project root: {rel}"]}
                if path.is_dir():
                    shutil.rmtree(path)
                elif path.is_file():
                    path.unlink()
            if action["id"] not in migration_state.setdefault("applied", []):
                migration_state["applied"].append(action["id"])
            completed.append(action["id"])

    # Commit manifest/state only after the full plan has been validated.
    if any(action["action"] in {"dependency", "framework", "migration"} for action in actions):
        (root / "package.json").write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")
        if project:
            _write_json(root / ".skipo" / "project.json", project)
        migration_state["pending"] = []
        _write_json(migration_state_path, migration_state)

    if any(action["action"] == "initialize-capability-state" for action in actions):
        capability_state(root)
    installed = sorted(read_json(root / ".skipo" / "capabilities.json", {}).get("installed", {}))
    if installed:
        repaired = compose(root, installed, apply=True)
        if not repaired.get("ok"):
            return {"ok": False, "operation": "update", "applied": True,
                    "errors": repaired.get("conflicts", ["Capability repair failed."]), "actions": actions}

    sync_result = {"ok": True, "skipped": True}
    if any(action["action"] == "reconcile-lockfile" for action in actions):
        sync_result = (lockfile_sync or _run_lockfile_sync)(root, package)
        if not sync_result.get("ok"):
            return {"ok": False, "operation": "update", "applied": True,
                    "errors": ["Lockfile reconciliation failed."], "sync": sync_result, "actions": actions}

    verification = verify(root, framework_version)
    return {
        "ok": verification["ok"], "operation": "update", "applied": True,
        "actions": actions, "completed_migrations": sorted(completed),
        "sync": sync_result, "verification": verification,
        "errors": verification["errors"],
    }


def verify(root: Path, framework_version: str) -> dict[str, Any]:
    """Independent read-only verification; never creates missing state."""
    root = root.resolve()
    errors = []
    try:
        package = read_json(root / "package.json", {})
        project = read_json(root / ".skipo" / "project.json", {})
        canonical = load_registry()["applicationState"]
        for name, desired in sorted(canonical.get("dependencies", {}).items()):
            if package.get("dependencies", {}).get(name) != desired:
                errors.append(f"Dependency contract mismatch: {name}")
        if version_tuple(project.get("skipo_version")) < version_tuple(framework_version):
            errors.append("Framework version is not current.")
        migration_state = read_json(root / canonical["migrations"]["stateFile"], {"applied": []})
        for migration in read_json(MIGRATIONS_PATH, {"migrations": []}).get("migrations", []):
            if version_tuple(migration.get("version")) <= version_tuple(framework_version) and migration.get("id") not in migration_state.get("applied", []):
                errors.append(f"Migration not applied: {migration.get('id')}")
        cap_state = read_json(root / ".skipo" / "capabilities.json", {"installed": {}, "generated": []})
        for rel, entry in generated_entries(cap_state).items():
            path = root / rel
            if not path.is_file():
                errors.append(f"Generated file missing: {rel}")
            elif entry.get("checksum") and sha256_text(path.read_text(encoding="utf-8")) != entry["checksum"]:
                errors.append(f"Generated file drift: {rel}")
        if canonical.get("environment", {}).get("lockfile") and not (root / canonical["environment"]["lockfile"]).exists():
            errors.append(f"Canonical lockfile missing: {canonical['environment']['lockfile']}")
        registry_capabilities = load_registry().get("capabilities", {})
        for capability_id in cap_state.get("installed", {}):
            if capability_id not in registry_capabilities:
                errors.append(f"Unknown installed capability: {capability_id}")
            elif registry_capabilities[capability_id].get("status") == "deprecated":
                errors.append(f"Deprecated installed capability: {capability_id}")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        errors.append(str(exc))
    return {"ok": not errors, "operation": "verify", "errors": sorted(set(errors))}
