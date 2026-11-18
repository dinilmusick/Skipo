"""Strict canonical Skipo Vite shell reconciliation.

All application source outside main-page tab subtrees is framework-owned. The
canonical Vite scaffold is authoritative; unknown source is retired, never
treated as an app-owned extension. Local configuration/credentials, Git history,
tab source and external data are not in the source-repair boundary.
"""
from __future__ import annotations

import hashlib
import json
import os
import stat
import tempfile
from pathlib import Path, PurePosixPath

SOURCE = Path(__file__).resolve().parents[1] / "scaffolds/vite"
TABS = ("src", "frontend", "pages", "main", "tabs")
MANAGED_ROOTS = ("src", "scripts", "api", "backend", "ui", "generators", "mutators")
CANONICAL_CONFIG = (
    "index.html", "server.ts", "vite.config.ts", "tsconfig.json",
    "vercel.json", "wrangler.toml", "skipo.providers.json",
    "scripts/skipo-build.mjs", "scripts/skipo-lint.mjs",
)
DESCRIPTOR = ".skipo/pages.json"


class UnsafeShellRepair(ValueError):
    pass


def is_tab(relative: str) -> bool:
    parts = PurePosixPath(relative).parts
    return parts[:len(TABS)] == TABS and len(parts) > len(TABS)


def _checked(root: Path, relative: str) -> Path:
    path = PurePosixPath(relative)
    if path.is_absolute() or not path.parts or any(part in {".", ".."} for part in path.parts):
        raise UnsafeShellRepair(f"Unsafe canonical path: {relative}")
    current = root
    for part in path.parts:
        current /= part
        if current.is_symlink():
            raise UnsafeShellRepair(f"Symlink in canonical repair boundary: {relative}")
    return current


def _digest(raw: bytes | None) -> str | None:
    return hashlib.sha256(raw).hexdigest() if raw is not None else None


def _source_tree(root: Path) -> dict[str, bytes]:
    """Inventory all shared executable roots, excluding only main tab code."""
    found: dict[str, bytes] = {}
    for name in MANAGED_ROOTS:
        start = root / name
        if not start.exists():
            continue
        if start.is_symlink() or not start.is_dir():
            raise UnsafeShellRepair(f"{name} must be a real directory")
        for directory, dirs, names in os.walk(start, followlinks=False):
            base = Path(directory)
            for dirname in dirs:
                relative = (base / dirname).relative_to(root).as_posix()
                _checked(root, relative)
            for filename in names:
                relative = (base / filename).relative_to(root).as_posix()
                if is_tab(relative):
                    continue
                path = _checked(root, relative)
                if not path.is_file():
                    raise UnsafeShellRepair(f"Non-file source asset: {relative}")
                found[relative] = path.read_bytes()
    return found


def _desired(root: Path) -> dict[str, bytes]:
    package_path = _checked(root, "package.json")
    vite_path = _checked(root, "vite.config.ts")
    if not package_path.is_file() or not vite_path.is_file():
        raise UnsafeShellRepair("Strict repair requires an existing Skipo Vite project")
    pkg = json.loads(package_path.read_text(encoding="utf-8"))
    name = pkg.get("name")
    if not isinstance(name, str) or not name.strip():
        raise UnsafeShellRepair("App package.json must declare a valid name")
    desired: dict[str, bytes] = {}
    for src in sorted((SOURCE / "src").rglob("*")):
        if not src.is_file():
            continue
        relative = src.relative_to(SOURCE).as_posix()
        if is_tab(relative):
            continue
        raw = src.read_bytes()
        if src.suffix in {".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md"}:
            text = raw.decode("utf-8")
            raw = text.replace("MyApp", name).replace("my-app", name).encode("utf-8")
        desired[relative] = raw
    # Capability-generated standard pages are also Skipo assets. The Vite
    # template alone omits its generated Luth auth page; deleting those files
    # would break a working application. Include the baseline capabilities and
    # any explicitly installed standard capabilities from the registry.
    from skipo_capabilities import capability_state, resolve_capabilities
    installed = capability_state(root).get("installed", {})
    if not isinstance(installed, dict):
        raise UnsafeShellRepair("Invalid Skipo capability state")
    baseline = {"auth", "workspace", "settings", "accounts"}
    for _, spec in resolve_capabilities(sorted(baseline | set(installed))):
        for asset in spec.get("generated", []):
            relative = asset["path"]
            if not relative.startswith("src/") or is_tab(relative):
                raise UnsafeShellRepair(f"Invalid generated capability path: {relative}")
            raw = asset["content"].encode("utf-8")
            if relative in desired and desired[relative] != raw:
                raise UnsafeShellRepair(f"Conflicting canonical owners: {relative}")
            desired[relative] = raw

    # Standard scripts and adapters are also framework assets; unknown
    # executable files in these roots are retired, not accepted as extensions.
    for managed_root in MANAGED_ROOTS:
        if managed_root == "src" or not (SOURCE / managed_root).is_dir():
            continue
        for src in sorted((SOURCE / managed_root).rglob("*")):
            if not src.is_file():
                continue
            relative = src.relative_to(SOURCE).as_posix()
            raw = src.read_bytes()
            if src.suffix in {".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md"}:
                raw = raw.decode("utf-8").replace("MyApp", name).replace("my-app", name).encode("utf-8")
            desired[relative] = raw

    for relative in CANONICAL_CONFIG:
        src = SOURCE / relative
        raw = src.read_bytes()
        if src.suffix in {".ts", ".tsx", ".js", ".mjs", ".json", ".html", ".toml"}:
            raw = raw.decode("utf-8").replace("MyApp", name).replace("my-app", name).encode("utf-8")
        desired[relative] = raw
    desired[DESCRIPTOR] = (
        json.dumps({"schemaVersion": 2, "layout": "canonical",
                    "customCodeRoot": "src/frontend/pages/main/tabs"},
                   indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")
    return desired


def _snapshot_tabs(root: Path) -> dict[str, str]:
    location = root.joinpath(*TABS)
    if not location.exists():
        return {}
    if location.is_symlink():
        raise UnsafeShellRepair("Custom tab root may not be a symlink")
    if not location.is_dir():
        raise UnsafeShellRepair("Custom tab root must be a directory")
    snapshot: dict[str, str] = {}
    for base, directories, names in os.walk(location, followlinks=False):
        for directory in directories:
            rel = (Path(base) / directory).relative_to(root).as_posix()
            _checked(root, rel)
        for name in names:
            rel = (Path(base) / name).relative_to(root).as_posix()
            file = _checked(root, rel)
            if not file.is_file():
                raise UnsafeShellRepair(f"Nonregular tab file: {rel}")
            snapshot[rel] = _digest(file.read_bytes())
    return snapshot


def plan_shell(root: Path) -> dict:
    root = Path(root).resolve()
    desired = _desired(root)
    current = _source_tree(root)
    for relative in (*CANONICAL_CONFIG, DESCRIPTOR):
        path = _checked(root, relative)
        if path.exists():
            if not path.is_file():
                raise UnsafeShellRepair(f"Non-file standard asset: {relative}")
            current[relative] = path.read_bytes()
    actions = []
    for relative in sorted(desired.keys() | current.keys()):
        if is_tab(relative):
            continue
        before, after = current.get(relative), desired.get(relative)
        if before == after:
            continue
        action = "retire" if after is None else ("create" if before is None else "rewrite")
        actions.append({"action": action, "path": relative,
                        "before_sha256": _digest(before), "after_sha256": _digest(after)})
    return {"ok": True, "operation": "canonical-shell", "actions": actions,
            "noop": not actions, "tab_files": len(_snapshot_tabs(root)),
            "ownership": {"managed": "all executable roots outside main tabs, plus canonical build/deployment assets",
                          "custom": "src/frontend/pages/main/tabs/**"}}


def _atomic_write(path: Path, data: bytes, mode: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".skipo-shell-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode if mode is not None else 0o644)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def reconcile_shell(root: Path, apply: bool = True) -> dict:
    """Reproduce the standard shell. Never silently preserve non-tab drift.

    Plans are nonmutating. Applying snapshots all planned paths, enforces
    expected old hashes, verifies exact replan/no-op and tab digests, and rolls
    back touched files on failure. Existing app business logic outside tabs
    is deliberately reported as a 'retire' operation.
    """
    root = Path(root).resolve()
    plan = plan_shell(root)
    if not apply:
        return {**plan, "applied": False}

    actions = plan["actions"]
    if not actions:
        return {**plan, "applied": True, "verification": {"ok": True, "idempotent": True}}
    desired = _desired(root)
    protected_tabs = _snapshot_tabs(root)
    backups: dict[str, tuple[bytes, int] | None] = {}
    new_directories: set[Path] = set()
    for item in actions:
        rel = item["path"]
        path = _checked(root, rel)
        backups[rel] = (path.read_bytes(), stat.S_IMODE(path.stat().st_mode)) if path.exists() else None
        parent = path.parent
        while parent != root and not parent.exists():
            new_directories.add(parent)
            parent = parent.parent

    touched: list[str] = []
    try:
        for item in actions:
            rel = item["path"]
            path = _checked(root, rel)
            before = path.read_bytes() if path.exists() else None
            if _digest(before) != item["before_sha256"]:
                raise UnsafeShellRepair(f"Concurrent mutation of {rel}; refusing stale plan")
            if item["action"] == "retire":
                path.unlink()
            else:
                mode = backups[rel][1] if backups[rel] else 0o644
                _atomic_write(path, desired[rel], mode)
            touched.append(rel)
        if not plan_shell(root)["noop"]:
            raise UnsafeShellRepair("Repaired shell still differs from Skipo canonical assets")
        if _snapshot_tabs(root) != protected_tabs:
            raise UnsafeShellRepair("Application tab code changed during shell reconciliation")
    except Exception as exc:
        errors = []
        for rel in reversed(touched):
            path = _checked(root, rel)
            original = backups[rel]
            try:
                if original is None:
                    if path.exists():
                        path.unlink()
                else:
                    _atomic_write(path, original[0], original[1])
            except Exception as error:
                errors.append(f"{rel}: {error}")
        for directory in sorted(new_directories, key=lambda path: len(path.parts), reverse=True):
            try:
                directory.rmdir()
            except OSError:
                pass
        return {"ok": False, "operation": "canonical-shell", "applied": False,
                "actions": actions, "error": str(exc),
                "rollback": {"status": "failed" if errors else "restored", "errors": errors}}

    return {**plan, "applied": True,
            "verification": {"ok": True, "idempotent": True, "tab_code_preserved": True}}
