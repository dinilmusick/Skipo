"""Install or repair canonical pages in a generated Vite app."""
from difflib import SequenceMatcher
import hashlib
import json
from pathlib import Path
import re

SOURCE = Path(__file__).resolve().parents[1] / "scaffolds/vite"
APP = "src/frontend/App.tsx"
MAIN = "src/frontend/pages/main/page.tsx"
TABS = "src/frontend/pages/main/MainTabs.tsx"
ADAPTER = "src/backend/adapters/httpsAdapter.ts"
COMMON = ("src/frontend/main.tsx", APP)
AUTH = ("src/app.ts", "src/backend/auth/luthSession.ts", "src/libraries/client/luthAuthClient.ts")
WORKSPACE = (ADAPTER, "src/backend/storage/canonicalCapabilityRoutes.ts",
             "src/frontend/pages/menus/workspaces/page.tsx", "src/frontend/components/gates/WorkspaceGate.tsx")
GROUPS = {"auth": COMMON + AUTH, "workspace": COMMON + AUTH + WORKSPACE, "main": COMMON + (MAIN, TABS)}
IMPORT = re.compile(r"""(?:from\s*|import\s*)['"](\.[^'"]+)['"]""")


def dependencies(template):
    for spec in IMPORT.findall(template.read_text()):
        path = template.parent / spec
        paths = (path, path.with_suffix(".tsx"), path.with_suffix(".ts"), path / "index.ts")
        for candidate in paths:
            if candidate.is_file():
                yield candidate.resolve().relative_to(SOURCE).as_posix()
                break


def restore(current, canonical, name):
    """Standard Skipo assets have no app-owned extension points.

    Any drift outside src/frontend/pages/main/tabs is rewritten to the
    authoritative template. Application code belongs in main-page tabs.
    """
    return canonical


def plan_files(root, page, title=None):
    root = root.resolve()
    if not (root / "package.json").is_file() or not (root / "vite.config.ts").is_file():
        raise ValueError("Expected a Skipo Vite application")
    app_id = json.loads((root / "package.json").read_text()).get("name", "my-app")
    config = root / ".skipo/pages.json"
    if config.exists():
        descriptor = json.loads(config.read_text())
        if descriptor.get("schemaVersion") == 2 and descriptor.get("layout") == "canonical":
            pass  # Strict canonical shell; use authoritative template groups below.
        elif descriptor.get("schemaVersion") == 1 and descriptor.get("layout") == "integrated":
            names = {"auth": "src/frontend/components/skipo/pages/auth.tsx",
                     "workspace": "src/frontend/components/skipo/pages/workspace.tsx",
                     "main": "src/frontend/pages/main/tabRegistry.tsx"}
            name = names[page]
            target = root / name
            if target.resolve() != target:
                raise ValueError(f"Refusing symlinked project path: {name}")
            value = (SOURCE / name).read_text()
            writes = {} if target.is_file() and target.read_text() == value else {target: value}
            from skipo_page_bindings import repair_bindings
            repair_bindings(root, page, descriptor.get("bindings", []), writes)
            plan_tab(root, title, writes)
            return writes
        else:
            raise ValueError("Unsupported .skipo/pages.json")
    managed = GROUPS[page]
    pending = list(managed)
    seen = set()
    writes = {}
    while pending:
        name = pending.pop()
        if name in seen:
            continue
        seen.add(name)
        template = SOURCE / name
        dest = root / name
        if dest.resolve() != dest:
            raise ValueError(f"Refusing symlinked project path: {name}")
        current = dest.read_text() if dest.exists() else None
        canonical = template.read_text().replace("my-app", app_id)
        desired = canonical if current is None else current
        if current is not None and name in managed:
            desired = restore(current, canonical, name)
        if desired != current:
            writes[dest] = desired
        pending.extend(dependencies(template))
    plan_tab(root, title, writes)
    return writes


def compose_page(root, page, title=None, apply=True):
    from skipo_capabilities import compose, resolve_capabilities

    writes = plan_files(root, page, title)
    result = {"ok": True, "actions": [], "conflicts": []}
    if page != "main" and not (root / ".skipo/pages.json").exists():
        result = compose(root, [page], apply=False)
        desired = {
            item["path"]: item["content"]
            for _, spec in resolve_capabilities([page])
            for item in spec.get("generated", [])
        }
        # Repair missing managed lines in registry-owned pages in the same preflight.
        unresolved = []
        for conflict in result["conflicts"]:
            path = root / conflict["path"]
            canonical = desired[conflict["path"]]
            try:
                repaired = restore(path.read_text(), canonical, conflict["path"])
            except ValueError:
                repaired = None
            if repaired == canonical and path.resolve() == path:
                writes[path] = repaired
            else:
                unresolved.append(conflict)
        result.update(conflicts=unresolved, ok=not unresolved)
    if apply and result["ok"]:
        for dest, value in writes.items():
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(value)
        if page != "main" and not (root / ".skipo/pages.json").exists():
            result = compose(root, [page], apply=True)
    result["page_paths"] = [str(path.relative_to(root)) for path in writes]
    return result


def plan_tab(root, title, writes):
    if title is not None:
        title = title.strip()
        if not title or len(title) > 100 or any(ord(c) < 32 for c in title):
            raise ValueError("Supply a tab name of 1 to 100 printable characters")
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:48] or "tab"
        key = hashlib.sha256(title.encode()).hexdigest()[:12]
        tab = root / Path(MAIN).parent / "tabs" / f"{slug}-{key}" / "page.tsx"
        if tab.resolve() != tab:
            raise ValueError("Refusing symlinked tab path")
        if not tab.exists():
            writes[tab] = (f"export const title = {json.dumps(title)};\n\n"
                           "export default function TabPage() {\n  return <h2>{title}</h2>;\n}\n")


def reconcile_pages(root, pages, title=None, apply=True):
    """Reconcile one or more canonical pages as a fail-closed CLI transaction.

    Preflight *all* requested pages before touching the project. Snapshot only
    declared framework-managed outputs and binding locations, then verify that
    a second reconciliation is a no-op. A failed write or verification restores
    the original files; app-owned tab bodies are never in the replacement set.
    """
    import os
    import stat

    from skipo_capabilities import resolve_capabilities

    root = Path(root).resolve()
    pages = ["auth" if page == "login" else page for page in pages]
    if not pages or any(page not in GROUPS for page in pages):
        raise ValueError("Expected auth, workspace, or main pages")
    if title is not None and pages != ["main"]:
        raise ValueError("Named tabs belong to the main page")

    previews = []
    candidates = set()
    for page in pages:
        preview = compose_page(root, page, title if page == "main" else None, apply=False)
        previews.append({"page": page, **preview})
        if not preview.get("ok", False):
            return {"ok": False, "applied": False, "pages": previews,
                    "conflicts": preview.get("conflicts", []),
                    "error": "Page preflight rejected an ambiguous or app-owned change"}
        candidates.update(preview.get("page_paths", []))
        if page != "main" and not (root / ".skipo/pages.json").exists():
            for _, spec in resolve_capabilities([page]):
                candidates.update(item["path"] for item in spec.get("generated", []))

    pending_capability_actions = any(
        action.get("action") != "unchanged"
        for preview in previews for action in preview.get("actions", [])
    )
    if not apply:
        return {"ok": True, "applied": False, "pages": previews,
                "page_paths": sorted(candidates),
                "noop": not candidates and not pending_capability_actions}

    # The capability composer updates these state files when installing a
    # canonical page. They must participate in the same rollback boundary.
    if any(page != "main" for page in pages) and not (root / ".skipo/pages.json").exists():
        candidates.update({
            "package.json", ".skipo/project.json", ".skipo/capabilities.json",
            ".skipo/dependencies.json", ".skipo/overrides.json",
            ".skipo/migration-state.json",
        })

    before = {}
    new_directories = set()
    for relative in sorted(candidates):
        path = root / relative
        if path.resolve() != path or (path.exists() and not path.is_file()):
            raise ValueError(f"Unsafe managed page target: {relative}")
        before[path] = (
            (path.read_bytes(), stat.S_IMODE(path.stat().st_mode))
            if path.exists() else None
        )
        parent = path.parent
        while parent != root and not parent.exists():
            new_directories.add(parent)
            parent = parent.parent

    results = []
    try:
        for page in pages:
            result = compose_page(root, page, title if page == "main" else None, apply=True)
            if not result.get("ok", False):
                raise ValueError(f"{page}: reconciliation failed: {result.get('conflicts')}")
            results.append({"page": page, **result})
        post = [
            {"page": page, **compose_page(root, page, title if page == "main" else None, apply=False)}
            for page in pages
        ]
        dirty = [
            item for item in post
            if not item.get("ok") or item.get("page_paths") or any(
                action.get("action") != "unchanged" for action in item.get("actions", [])
            )
        ]
        if dirty:
            raise ValueError("Canonical pages remain dirty after reconciliation")
    except Exception as exc:
        rollback_errors = []
        for path, original in before.items():
            try:
                if original is None:
                    if path.exists():
                        path.unlink()
                else:
                    data, mode = original
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(data)
                    os.chmod(path, mode)
            except OSError as error:
                rollback_errors.append(f"{path.relative_to(root)}: {error}")
        for path in sorted(new_directories, key=lambda item: len(item.parts), reverse=True):
            try:
                path.rmdir()
            except OSError:
                pass
        return {"ok": False, "applied": False, "pages": results,
                "error": str(exc), "rollback": {
                    "status": "failed" if rollback_errors else "restored",
                    "errors": rollback_errors,
                }}

    changed = sorted(
        path.relative_to(root).as_posix()
        for path, original in before.items()
        if (path.read_bytes() if path.exists() else None) !=
        (original[0] if original is not None else None)
    )
    return {"ok": True, "applied": True, "pages": results,
            "page_paths": changed, "noop": not changed,
            "verification": {"ok": True, "idempotent": True}}
