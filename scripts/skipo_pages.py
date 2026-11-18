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
    if not current.strip():
        return canonical
    if current == canonical:
        return canonical
    # A pure removal from the scaffold is recoverable without discarding app edits.
    diff = SequenceMatcher(None, current.splitlines(True), canonical.splitlines(True), autojunk=False)
    if all(op in ("equal", "insert") for op, *_ in diff.get_opcodes()):
        return canonical
    # Upgrade the historical child slot in place, preserving consumer extensions.
    if name == MAIN and ": children}</main>" in current and "import MainTabs " not in current and "import SettingsPage" in current:
        return current.replace("import SettingsPage", "import MainTabs from './MainTabs.js';\nimport SettingsPage", 1).replace(
            ": children}</main>", ": <MainTabs>{children}</MainTabs>}</main>", 1)
    if name == MAIN and "<MainTabs>" in current and "import MainTabs " in current:
        return current
    # Preserve additions to canonical files, including custom HTTP routes.
    if all(op in ("equal", "delete") for op, *_ in diff.get_opcodes()):
        return current
    raise ValueError(f"{name} contains app-specific changes overlapping managed wiring")


def plan_files(root, page, title=None):
    root = root.resolve()
    if not (root / "package.json").is_file() or not (root / "vite.config.ts").is_file():
        raise ValueError("Expected a Skipo Vite application")
    app_id = json.loads((root / "package.json").read_text()).get("name", "my-app")
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
    return writes


def compose_page(root, page, title=None, apply=True):
    from skipo_capabilities import compose, resolve_capabilities

    writes = plan_files(root, page, title)
    result = {"ok": True, "actions": [], "conflicts": []}
    if page != "main":
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
        if page != "main":
            result = compose(root, [page], apply=True)
    result["page_paths"] = [str(path.relative_to(root)) for path in writes]
    return result
