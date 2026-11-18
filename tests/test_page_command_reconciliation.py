"""Regression contract for command-based canonical pages and idempotent tab repair."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import skipo_pages


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


def test_update_pages_fails_before_writing_when_later_binding_is_ambiguous(tmp_path):
    binding = {"page": "workspace", "path": "src/frontend/app.tsx",
               "name": "workspace-component", "source": "import { WorkspacePage } from './canonical.js';"}
    target = app(tmp_path, [binding])
    source = target / binding["path"]
    source.parent.mkdir(parents=True)
    source.write_text("const appOwned = true;\n", encoding="utf-8")
    before = source.read_bytes()

    result = invoke("update", "--pages", str(target))
    assert result.returncode != 0, result.stdout
    assert "cannot identify" in result.stdout
    assert source.read_bytes() == before
    assert not (target / "src/frontend/components/skipo/pages/auth.tsx").exists()


def test_update_repairs_managed_content_and_is_byte_idempotent(tmp_path):
    binding = {"page": "workspace", "path": "src/frontend/consumer.tsx",
               "name": "workspace-component",
               "source": "import { WorkspacePage } from './canonical.js';"}
    target = app(tmp_path, [binding])
    source = target / binding["path"]
    source.parent.mkdir(parents=True)
    source.write_text(
        "// consumer-owned header\n// skipo:begin workspace-component\n"
        "const broken = true;\n// skipo:end workspace-component\n"
        "// consumer-owned footer\n", encoding="utf-8"
    )
    first = invoke("update", "--pages", str(target))
    assert first.returncode == 0, first.stdout + first.stderr
    assert binding["source"] in source.read_text()
    auth = target / "src/frontend/components/skipo/pages/auth.tsx"
    auth.write_text("broken", encoding="utf-8")
    source.write_text(source.read_text().replace(binding["source"], "broken;"), encoding="utf-8")

    repaired = invoke("update", "--pages", str(target))
    assert repaired.returncode == 0, repaired.stdout + repaired.stderr
    assert "LuthAuthPage" in auth.read_text()
    assert binding["source"] in source.read_text()
    assert source.read_text().startswith("// consumer-owned header\n")
    assert source.read_text().endswith("// consumer-owned footer\n")

    second = invoke("update", "--pages", str(target))
    assert second.returncode == 0, second.stdout + second.stderr
    receipt = json.loads(second.stdout)
    assert receipt["noop"] is True
    assert receipt["verification"]["idempotent"] is True


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


def test_failure_during_commit_restores_first_page_and_app_files(tmp_path, monkeypatch):
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
