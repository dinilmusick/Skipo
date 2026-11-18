"""Full-stack canonical Skipo Vite reconciliation.

Frontend code is framework-owned except main-page tabs. Canonical backend
entrypoints and Kloks adapters are framework-owned, but application-specific
backend services survive. Unknown backend code is never erased by shell repair:
provider replacements require an explicit verified mapping and migration.
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
# Only frontend and shared client infrastructure have an exclusive code boundary.
# App backend services, tests, workflows and scripts are not disposable.
MANAGED_ROOTS = ("src/frontend", "src/libraries/client", "src/config", "src/providers")
CANONICAL_BACKEND = (
    "src/app.ts",
    "src/backend/auth/luthSession.ts",
    "src/backend/storage/canonicalCapabilityRoutes.ts",
    "src/backend/adapters/httpsAdapter.ts",
    "src/backend/BackendFacade.ts",
    "src/backend/BackendFacadeTypes.ts",
    "src/backend/BackendCapabilityCatalog.ts",
    "src/backend/LuthAuthServiceFacade.ts",
)
FULL_STACK = {
    "auth": {
        "frontend": ("src/frontend/App.tsx", "src/frontend/components/skipo/pages/auth.tsx",
                     "src/frontend/pages/auth/page.tsx"),
        "backend": ("src/app.ts", "src/backend/auth/luthSession.ts",
                    "src/backend/adapters/httpsAdapter.ts"),
        "services": ("@ultrst-armada/floks/auth", "@ultrst-armada/kloks/auth"),
        "routes": ("/api/auth/*", "/api/session"),
    },
    "workspace": {
        "frontend": ("src/frontend/pages/menus/workspaces/page.tsx",
                     "src/frontend/components/gates/WorkspaceGate.tsx"),
        "backend": ("src/backend/storage/canonicalCapabilityRoutes.ts",
                    "src/backend/adapters/httpsAdapter.ts"),
        "services": ("@ultrst-armada/floks/ui", "@ultrst-armada/kloks/backend/krnl-services"),
        "routes": ("/api/auth/workspaces", "/api/auth/storage/*"),
    },
    "main": {
        "frontend": ("src/frontend/pages/main/page.tsx",
                     "src/frontend/pages/main/MainTabs.tsx",
                     "src/frontend/pages/main/tabRegistry.tsx"),
        "backend": ("src/backend/BackendFacade.ts",),
        "services": ("@ultrst-armada/floks/ui", "@ultrst-armada/krnl"),
        "routes": (),
    },
}
CANONICAL_CONFIG = (
    "index.html", "server.ts", "vite.config.ts", "tsconfig.json",
    "vercel.json", "wrangler.toml", "skipo.providers.json",
    "scripts/skipo-build.mjs", "scripts/skipo-lint.mjs",
    ".env.example", "db/skipo-ecosystem-deployments.sql",
    "src/App.tsx", "src/index.css",
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
    for relative in CANONICAL_BACKEND:
        path = _checked(root, relative)
        if path.exists():
            if not path.is_file():
                raise UnsafeShellRepair(f"Non-file canonical backend adapter: {relative}")
            found[relative] = path.read_bytes()
    return found


def _desired(root: Path, title: str | None = None) -> dict[str, bytes]:
    package_path = _checked(root, "package.json")
    vite_path = _checked(root, "vite.config.ts")
    if not package_path.is_file() or not vite_path.is_file():
        raise UnsafeShellRepair("Strict repair requires an existing Skipo Vite project")
    pkg = json.loads(package_path.read_text(encoding="utf-8"))
    name = pkg.get("name")
    if not isinstance(name, str) or not name.strip():
        raise UnsafeShellRepair("App package.json must declare a valid name")
    desired: dict[str, bytes] = {}
    for managed_root in MANAGED_ROOTS:
        for src in sorted((SOURCE / managed_root).rglob("*")):
            if not src.is_file():
                continue
            relative = src.relative_to(SOURCE).as_posix()
            if is_tab(relative):
                continue
            raw = src.read_bytes()
            if src.suffix in {".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md"}:
                raw = raw.decode("utf-8").replace("MyApp", name).replace("my-app", name).encode("utf-8")
            desired[relative] = raw
    for relative in CANONICAL_BACKEND:
        template = SOURCE / relative
        desired[relative] = template.read_bytes()

    # Capability-generated standard pages are also Skipo assets. The Vite
    # template alone omits its generated Luth auth page; deleting those files
    # would break a working application. Include the baseline capabilities and
    # any explicitly installed standard capabilities from the registry.
    from skipo_capabilities import capability_state, resolve_capabilities
    installed = capability_state(root).get("installed", {})
    if not isinstance(installed, dict):
        raise UnsafeShellRepair("Invalid Skipo capability state")
    baseline = {"auth", "workspace", "settings", "accounts", "storage"}
    resolved = resolve_capabilities(sorted(baseline | set(installed)))
    for _, spec in resolved:
        for asset in spec.get("generated", []):
            relative = asset["path"]
            if not relative.startswith("src/") or is_tab(relative):
                raise UnsafeShellRepair(f"Invalid generated capability path: {relative}")
            raw = asset["content"].encode("utf-8")
            if relative in desired and desired[relative] != raw:
                raise UnsafeShellRepair(f"Conflicting canonical owners: {relative}")
            desired[relative] = raw

    # The full-stack command pins the shared provider packages. Retain
    # application-specific dependencies and scripts rather than copying a
    # generic app package.json over them. Lockfile generation remains a
    # separate install step checked by downstream CI.
    packages = json.loads(package_path.read_text(encoding="utf-8"))
    dependencies = dict(packages.get("dependencies", {}))
    for _, capability in resolved:
        dependencies.update(capability.get("dependencies", {}))
    packages["dependencies"] = dependencies
    desired["package.json"] = (json.dumps(packages, indent=2) + "\n").encode("utf-8")

    # Auditable install receipt: each page command has mandatory UI + server
    # assets, routes and actual canonical provider package resolution.
    desired[".skipo/full-stack.json"] = (
        json.dumps({
            "schemaVersion": 1,
            "generator": "skipo",
            "framework": "vite",
            "stacks": {
                stack: {**spec, "frontend": list(spec["frontend"]),
                        "backend": list(spec["backend"]),
                        "services": list(spec["services"]),
                        "routes": list(spec["routes"])}
                for stack, spec in sorted(FULL_STACK.items())
            },
            "capabilities": sorted(name for name, _ in resolved),
        }, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")

    for relative in CANONICAL_CONFIG:
        src = SOURCE / relative
        raw = src.read_bytes()
        if src.suffix in {".ts", ".tsx", ".js", ".mjs", ".json", ".html", ".toml", ".sql", ".css"}:
            raw = raw.decode("utf-8").replace("MyApp", name).replace("my-app", name).encode("utf-8")
        desired[relative] = raw
    desired[DESCRIPTOR] = (
        json.dumps({"schemaVersion": 2, "layout": "canonical",
                    "customCodeRoot": "src/frontend/pages/main/tabs"},
                   indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")
    if title is not None:
        from skipo_pages import plan_tab
        planned = {}
        plan_tab(root, title, planned)
        for path, content in planned.items():
            relative = path.relative_to(root).as_posix()
            if not is_tab(relative):
                raise UnsafeShellRepair(f"Tab generator escaped custom-code boundary: {relative}")
            desired[relative] = content.encode("utf-8")
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


def plan_shell(root: Path, title: str | None = None) -> dict:
    root = Path(root).resolve()
    desired = _desired(root, title)
    current = _source_tree(root)
    # The registry also defines canonical service facades outside the frontend
    # roots. Read their actual state; otherwise every repeat looks like a create.
    for relative in desired:
        if relative in current or is_tab(relative):
            continue
        path = _checked(root, relative)
        if path.exists():
            if not path.is_file():
                raise UnsafeShellRepair(f"Non-file canonical asset: {relative}")
            current[relative] = path.read_bytes()
    actions = []
    for relative in sorted(desired.keys() | current.keys()):
        if is_tab(relative) and relative not in desired:
            continue
        before, after = current.get(relative), desired.get(relative)
        if before == after:
            continue
        action = ("create-tab" if is_tab(relative) else
                  ("retire" if after is None else ("create" if before is None else "rewrite")))
        actions.append({"action": action, "path": relative,
                        "before_sha256": _digest(before), "after_sha256": _digest(after)})
    return {"ok": True, "operation": "canonical-shell", "actions": actions,
            "noop": not actions, "tab_files": len(_snapshot_tabs(root)),
            "stacks": {name: {**spec, "complete": all(relative in desired for relative in
                         (*spec["frontend"], *spec["backend"]))}
                       for name, spec in FULL_STACK.items()},
            "ownership": {"managed": "canonical frontend outside tabs, shared client and defined backend adapters",
                          "custom_frontend": "src/frontend/pages/main/tabs/**",
                          "custom_backend": "src/backend/** except canonical backend adapter paths"}}


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


def reconcile_shell(root: Path, apply: bool = True, title: str | None = None) -> dict:
    """Reproduce the standard shell. Never silently preserve non-tab drift.

    Plans are nonmutating. Applying snapshots all planned paths, enforces
    expected old hashes, verifies exact replan/no-op and tab digests, and rolls
    back touched files on failure. Existing app business logic outside tabs
    is reported as a 'retire' operation only within frontend ownership.
    Custom application backend services are retained for conformance checks.
    """
    root = Path(root).resolve()
    plan = plan_shell(root, title)
    if not apply:
        return {**plan, "applied": False}

    actions = plan["actions"]
    if not actions:
        return {**plan, "applied": True, "verification": {"ok": True, "idempotent": True}}
    desired = _desired(root, title)
    protected_tabs = _snapshot_tabs(root)
    expected_tabs = dict(protected_tabs)
    for item in actions:
        if is_tab(item["path"]):
            expected_tabs[item["path"]] = item["after_sha256"]
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
            # Journal before mutation so even a write which raises after its
            # replace is rolled back from the original exact bytes.
            touched.append(rel)
            if item["action"] == "retire":
                path.unlink()
            else:
                mode = backups[rel][1] if backups[rel] else 0o644
                _atomic_write(path, desired[rel], mode)
        if not plan_shell(root, title)["noop"]:
            raise UnsafeShellRepair("Repaired shell still differs from Skipo canonical assets")
        if _snapshot_tabs(root) != expected_tabs:
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
