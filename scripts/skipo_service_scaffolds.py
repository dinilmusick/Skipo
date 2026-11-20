"""Fail-closed service-scaffold planning, ownership, and transactional file writes."""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any

from skipo_service_templates import (
    binding_source, functionality_source, helper_source, members_index,
    service_class, service_id, service_index, service_manifest, service_source,
    member_name,
)

STATE_PATH = ".skipo/service-scaffolds.json"
REGISTRY_PATH = "src/backend/services/__skipo/registry.ts"
APP_BACKEND = "src/backend/AppBackend.ts"
APP_IMPORT = "import { appOwnedServices } from './services/__skipo/registry.js';"
APP_SPREAD = "  ...appOwnedServices,"


def digest(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def load_state(root: Path) -> dict[str, Any]:
    file = root / STATE_PATH
    if not file.exists():
        return {"schemaVersion": 1, "services": {}, "managed": {}}
    data = json.loads(file.read_text(encoding="utf-8"))
    if (data.get("schemaVersion") != 1 or
            not isinstance(data.get("services"), dict) or
            not isinstance(data.get("managed"), dict)):
        raise ValueError("Unsupported or damaged service scaffold state; no files changed.")
    return data


def validate_path(root: Path, rel: str) -> Path:
    relative = Path(rel)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError(f"Refusing unsafe relative path: {rel}")
    path = root / relative
    # Only reject links *inside* the selected project. On macOS, /var is a
    # system link to /private/var, outside the project ownership boundary.
    paths = [root.joinpath(*relative.parts[:i]) for i in range(1, len(relative.parts) + 1)]
    if any(component.is_symlink() for component in paths):
        raise ValueError(f"Refusing symlink path: {rel}")
    if path.exists() and not path.is_file():
        raise ValueError(f"Expected a regular file, not a directory: {rel}")
    return path


def backend_with_registration(source: str) -> str:
    if APP_IMPORT not in source:
        source = APP_IMPORT + "\n" + source
    if APP_SPREAD not in source:
        marker = "export const services = {"
        if source.count(marker) != 1:
            raise ValueError("AppBackend.ts lacks a unique canonical services-object anchor.")
        source = source.replace(marker, marker + "\n" + APP_SPREAD, 1)
    return source


def desired_files(service: str, metadata: dict, all_services: dict) -> dict[str, str]:
    base = f"src/backend/services/{service}/"
    funcs = sorted(metadata["functionalities"])
    helpers = sorted(metadata["helpers"])
    files = {
        base + "service.ts": service_source(service),
        base + "index.ts": service_index(service),
        base + "functionalities/index.ts": members_index(funcs, "functionalityOperations"),
        base + "helpers/index.ts": members_index(helpers, None),
        base + "manifest.json": json.dumps(service_manifest(service, funcs, helpers), sort_keys=True, indent=2) + "\n",
    }
    for name in funcs:
        files[base + f"functionalities/{name}.ts"] = functionality_source(service, name)
    for name in helpers:
        files[base + f"helpers/{name}.ts"] = helper_source(service, name)
    bound = sorted(s for s, m in all_services.items() if m["bound"])
    if bound:
        files[REGISTRY_PATH] = binding_source(bound)
    return files


def commit_files(root: Path, writes: dict[str, str]) -> None:
    """Best-effort transaction with original-byte rollback and state committed last."""
    originals: dict[str, bytes | None] = {}
    changed: list[str] = []
    try:
        for rel, content in writes.items():
            path = validate_path(root, rel)
            previous = path.read_bytes() if path.exists() else None
            originals[rel] = previous
            if previous == content.encode("utf-8"):
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            fd, temporary = tempfile.mkstemp(prefix=".skipo-write-", dir=path.parent)
            try:
                with os.fdopen(fd, "wb") as handle:
                    handle.write(content.encode("utf-8"))
                os.replace(temporary, path)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)
            changed.append(rel)
    except Exception:
        for rel in reversed(changed):
            path = root / rel
            previous = originals[rel]
            if previous is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(previous)
        raise


def perform(root: Path, command: str, name: str, member: str | None = None,
            plan: bool = False, reset: bool = False) -> dict[str, Any]:
    root = root.resolve()
    if not (root / "package.json").is_file():
        raise ValueError("A Skipo project with package.json is required.")
    service = service_id(name)
    state = load_state(root)
    services: dict = state["services"]
    existing = services.get(service)
    previously_owned = set(existing.get("userOwned", [])) if existing else set()
    if command in {"create", "new"}:
        if not existing:
            registry = json.loads((Path(__file__).resolve().parents[1] /
                                   "architecture/capabilities/registry.json").read_text())
            if service in registry["capabilities"]:
                raise ValueError(f"'{service}' is a canonical Kloks/Floks capability. Use skipo add service {service}.")
            package = json.loads((root / "package.json").read_text())
            dependencies = {**package.get("dependencies", {}), **package.get("devDependencies", {})}
            if "@ultrst-armada/krnl" not in dependencies:
                raise ValueError("App-owned Krnl services require an existing @ultrst-armada/krnl dependency.")
            services[service] = {
                "name": service_class(service), "functionalities": [], "helpers": [],
                "bound": False, "userOwned": [],
            }
    elif not existing:
        raise ValueError(f"Unknown app-owned service '{service}'; create it first.")
    meta = services[service]
    if command in {"functionality", "helper"}:
        value = member_name(member or "")
        field = "functionalities" if command == "functionality" else "helpers"
        meta[field] = sorted(set(meta[field]) | {value})
        path = f"src/backend/services/{service}/{field}/{value}.ts"
        meta["userOwned"] = sorted(set(meta["userOwned"]) | {path})
    elif command == "bind":
        meta["bound"] = True
    elif command not in {"create", "new", "repair", "verify"}:
        raise ValueError(f"Unknown service operation: {command}")

    desired = desired_files(service, meta, services)
    managed = state["managed"]
    user_owned = set(meta["userOwned"])
    writes: dict[str, str] = {}
    conflicts: list[str] = []
    preserved: list[str] = []
    if meta["bound"]:
        app_path = validate_path(root, APP_BACKEND)
        if not app_path.is_file():
            raise ValueError("Missing canonical src/backend/AppBackend.ts integration target.")
        existing_backend = app_path.read_text(encoding="utf-8")
        updated_backend = backend_with_registration(existing_backend)
        if updated_backend != existing_backend:
            writes[APP_BACKEND] = updated_backend
    for rel, expected in sorted(desired.items()):
        path = validate_path(root, rel)
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if rel in user_owned:
            if current is None:
                writes[rel] = expected
            elif rel not in previously_owned:
                conflicts.append(rel)
            else:
                preserved.append(rel)
            continue
        previous_hash = managed.get(rel)
        if current == expected:
            managed[rel] = digest(expected)
        elif current is None:
            writes[rel] = expected
            managed[rel] = digest(expected)
        elif previous_hash is not None and digest(current) == previous_hash:
            writes[rel] = expected
            managed[rel] = digest(expected)
        elif previous_hash is not None and reset and command == "repair":
            backup = f".skipo/service-backups/{service}/{digest(current)}/{rel}"
            backup_path = validate_path(root, backup)
            if backup_path.exists() and backup_path.read_text(encoding="utf-8") != current:
                conflicts.append(backup)
                continue
            if not backup_path.exists():
                writes[backup] = current
            writes[rel] = expected
            managed[rel] = digest(expected)
        else:
            conflicts.append(rel)
    if conflicts:
        return {"ok": False, "operation": command, "service": service,
                "applied": False, "conflicts": sorted(conflicts),
                "error": "Unowned or modified managed files cannot be overwritten. Repair requires explicit --reset for recorded managed files."}
    for rel in user_owned:
        validate_path(root, rel)
    changed_state = json.dumps(state, indent=2, sort_keys=True) + "\n"
    state_file = root / STATE_PATH
    if not state_file.exists() or state_file.read_text(encoding="utf-8") != changed_state:
        writes[STATE_PATH] = changed_state
    if command == "verify":
        drift = [rel for rel, expected in desired.items()
                 if not (root / rel).is_file() or
                 (rel not in user_owned and (root / rel).read_text(encoding="utf-8") != expected)]
        if meta["bound"] and APP_BACKEND in writes:
            drift.append(APP_BACKEND)
        return {"ok": not drift, "operation": "verify-service", "service": service,
                "verified": not drift, "drift": sorted(drift), "scope": "structural"}
    if plan:
        return {"ok": True, "operation": command, "service": service,
                "applied": False, "writes": sorted(writes), "preserved": sorted(preserved)}
    commit_files(root, writes)
    return {"ok": True, "operation": command, "service": service,
            "applied": True, "writes": sorted(writes), "preserved": sorted(preserved)}
