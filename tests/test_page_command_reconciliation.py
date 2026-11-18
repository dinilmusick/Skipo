"""Canonical Skipo CLI: only main-page tab code is consumer-owned."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import skipo_pages
import skipo_canonical_shell


def app(tmp_path: Path, bindings=None) -> Path:
    target = tmp_path / "consumer"
    (target / ".skipo").mkdir(parents=True)
    (target / "package.json").write_text('{"name":"reconciliation-fixture","dependencies":{}}\n', encoding="utf-8")
    (target / "vite.config.ts").write_text("export default {};\n", encoding="utf-8")
    (target / ".skipo/pages.json").write_text(
        json.dumps({"schemaVersion": 1, "layout": "integrated",
                    "bindings": bindings or []}) + "\n", encoding="utf-8"
    )
    return target


def invoke(*args: str):
    return subprocess.run(
        [sys.executable, str(ROOT / "scripts/skipo_cli.py"), *args],
        capture_output=True, text=True, cwd=ROOT
    )


def test_update_aggressively_replaces_ambiguous_integrated_shell(tmp_path):
    target = app(tmp_path, [{"page": "workspace",
                             "path": "src/frontend/app.tsx",
                             "name": "workspace-component",
                             "source": "import { WorkspacePage } from './custom.js';"}])
    rogue = target / "src/frontend/app.tsx"
    rogue.parent.mkdir(parents=True)
    rogue.write_text("const customWorkspaceAuth = true;\n")
    result = invoke("update", "--pages", str(target))
    assert result.returncode == 0, result.stdout + result.stderr
    assert not rogue.exists()
    assert (target / "src/frontend/App.tsx").is_file()
    assert json.loads((target / ".skipo/pages.json").read_text())["layout"] == "canonical"
    assert not (target / "src/frontend/App.tsx").read_text().count("customWorkspaceAuth")


def test_update_repairs_dirty_shell_and_protects_custom_tabs(tmp_path):
    target = app(tmp_path)
    tab = target / "src/frontend/pages/main/tabs/mixer/page.tsx"
    tab.parent.mkdir(parents=True)
    tab.write_text(
        "export const title = 'Mixer';\n"
        "export default function Mixer() { return <div>Custom MIDI mixing</div>; }\n",
        encoding="utf-8"
    )
    original_tab = tab.read_bytes()
    first = invoke("update", "--pages", str(target))
    assert first.returncode == 0, first.stdout + first.stderr
    assert tab.read_bytes() == original_tab
    auth = target / "src/frontend/components/skipo/pages/auth.tsx"
    main = target / "src/frontend/pages/main/page.tsx"
    auth.write_text("const localAuth = 'invalid';\n")
    main.write_text("export default function Main() { return null; }\n")
    legacy = target / "src/backend/legacyCustomSession.ts"
    legacy.write_text("export const bypassLuth = true;\n")
    stray_script = target / "scripts/local-auth.cjs"
    stray_script.parent.mkdir(parents=True)
    stray_script.write_text("module.exports = { bypass: true };\n")
    dirty_plan = invoke("update", "--pages", str(target), "--plan")
    assert dirty_plan.returncode == 0, dirty_plan.stdout + dirty_plan.stderr
    actions = json.loads(dirty_plan.stdout)["actions"]
    assert {"rewrite", "retire"} <= {item["action"] for item in actions}
    assert auth.read_text() == "const localAuth = 'invalid';\n"
    assert legacy.exists()

    repaired = invoke("update", "--pages", str(target))
    assert repaired.returncode == 0, repaired.stdout + repaired.stderr
    assert "LuthAuthPage" in auth.read_text()
    assert "MainTabs" in main.read_text()
    assert not legacy.exists()
    assert not stray_script.exists()
    assert tab.read_bytes() == original_tab
    second = invoke("update", "--pages", str(target))
    assert second.returncode == 0, second.stdout + second.stderr
    receipt = json.loads(second.stdout)
    assert receipt["noop"] is True
    assert receipt["verification"]["idempotent"] is True

    # All future page and tab commands must understand canonical layout v2.
    new_tab = invoke("add", "main", "tab", "Diagnostics", str(target))
    assert new_tab.returncode == 0, new_tab.stdout + new_tab.stderr
    assert len(list((tab.parent.parent).glob("*/page.tsx"))) == 2
    assert tab.read_bytes() == original_tab


def test_strict_shell_rolls_back_partial_commit_and_preserves_tabs(tmp_path, monkeypatch):
    target = app(tmp_path)
    tab = target / "src/frontend/pages/main/tabs/keys/page.tsx"
    tab.parent.mkdir(parents=True)
    tab.write_text("export default function Keys() { return 'custom'; }\n")
    original = skipo_canonical_shell._atomic_write
    invocations = 0

    def fail_once(path, data, mode=None):
        nonlocal invocations
        invocations += 1
        if invocations == 4:
            raise OSError("injected shell write failure")
        return original(path, data, mode)

    monkeypatch.setattr(skipo_canonical_shell, "_atomic_write", fail_once)
    result = skipo_canonical_shell.reconcile_shell(target)
    assert result["ok"] is False
    assert result["rollback"]["status"] == "restored"
    assert not (target / "src/frontend/App.tsx").exists()
    assert json.loads((target / ".skipo/pages.json").read_text())["layout"] == "integrated"
    assert tab.read_text() == "export default function Keys() { return 'custom'; }\n"


def test_add_named_main_tab_keeps_application_owned_body_on_repeat(tmp_path):
    target = app(tmp_path)
    first = invoke("add", "main", "tab", "Mixer", str(target))
    assert first.returncode == 0, first.stdout + first.stderr
    tabs = list((target / "src/frontend/pages/main/tabs").glob("*/page.tsx"))
    assert len(tabs) == 1
    tabs[0].write_text(tabs[0].read_text() + "// app-owned instrument UI\n", encoding="utf-8")
    before = tabs[0].read_bytes()

    again = invoke("add", "main", "tab", "Mixer", str(target))
    assert again.returncode == 0, again.stdout + again.stderr
    assert tabs[0].read_bytes() == before
    assert json.loads(again.stdout)["noop"] is True
    assert len(list((target / "src/frontend/pages/main/tabs").glob("*/page.tsx"))) == 1


def test_failure_during_page_commit_restores_first_page_and_app_files(tmp_path, monkeypatch):
    target = app(tmp_path)
    original = skipo_pages.compose_page

    def fail_second_page(root, page, title=None, apply=True):
        if apply and page == "workspace":
            raise OSError("simulated workspace write failure")
        return original(root, page, title, apply=apply)

    monkeypatch.setattr(skipo_pages, "compose_page", fail_second_page)
    result = skipo_pages.reconcile_pages(target, ["auth", "workspace"], apply=True)
    assert result["ok"] is False
    assert result["rollback"]["status"] == "restored"
    assert not (target / "src/frontend/components/skipo/pages/auth.tsx").exists()
    assert not (target / "src/frontend/components/skipo/pages/workspace.tsx").exists()
    assert (target / "package.json").read_text() == '{"name":"reconciliation-fixture","dependencies":{}}\n'
