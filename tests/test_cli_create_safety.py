"""Contract tests for Skipo create atomic publication and non-destructive targets."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import skipo_cli as cli


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.mark.parametrize("name", ["../bad", "bad/name", "bad name", ".hidden", "", "a" * 65])
def test_invalid_names_cannot_write_files(tmp_path, name, capsys):
    target = tmp_path / "NeverCreated"
    result = cli.create_project(name, target, "vite", False)
    assert result == 2
    assert not target.exists()
    assert not any(".skipo-stage-" in item.name for item in tmp_path.iterdir())
    assert json.loads(capsys.readouterr().out)["ok"] is False


def test_traversal_rejected_before_project_creation(tmp_path, capsys):
    destination = tmp_path / "child" / ".." / "escaped"
    assert cli.create_project("Example", destination, "vite", False) == 2
    assert not (tmp_path / "escaped").exists()
    assert json.loads(capsys.readouterr().out)["code"] == "SKIPO_CREATE_UNSAFE_TARGET"


def test_symlinked_parent_is_rejected(tmp_path, capsys):
    actual = tmp_path / "real"
    actual.mkdir()
    alias = tmp_path / "alias"
    try:
        alias.symlink_to(actual, target_is_directory=True)
    except (NotImplementedError, OSError):
        pytest.skip("symlink creation prohibited by runner")
    assert cli.create_project("Example", alias / "subproject", "vite", True) == 2
    assert not (actual / "subproject").exists()
    assert json.loads(capsys.readouterr().out)["code"] == "SKIPO_CREATE_SYMLINK"


@pytest.mark.parametrize("force", [False, True])
def test_existing_project_owned_code_never_overwritten(tmp_path, force, capsys):
    target = tmp_path / "MyApp"
    tab = target / "src" / "frontend" / "pages" / "main" / "tabs" / "CustomTab.tsx"
    service = target / "src" / "backend" / "services" / "customService.ts"
    for item in (tab, service):
        item.parent.mkdir(parents=True, exist_ok=True)
        item.write_text("export const ownership = 'mine';\n", encoding="utf-8")
    before = (_digest(tab), _digest(service))
    assert cli.create_project("MyApp", target, "vite", force) == 2
    assert (_digest(tab), _digest(service)) == before
    assert json.loads(capsys.readouterr().out)["code"] == "SKIPO_CREATE_EXISTING_PROJECT"


def test_partial_generator_failure_leaves_no_new_project(tmp_path, monkeypatch, capsys):
    def failing_create(_name, stage, _framework):
        (stage / "partially-generated").write_text("should be removed\n", encoding="utf-8")
        return 1

    monkeypatch.setattr(cli, "_populate_create_project", failing_create)
    target = tmp_path / "NewApp"
    assert cli.create_project("NewApp", target, "vite", False) == 1
    assert not target.exists()
    assert not any(".skipo-stage-" in item.name for item in tmp_path.iterdir())


def test_generator_exception_rolls_back_empty_target(tmp_path, monkeypatch, capsys):
    def crashing_create(_name, stage, _framework):
        (stage / "partial").write_text("partial\n", encoding="utf-8")
        raise OSError("simulated disk write failure")

    monkeypatch.setattr(cli, "_populate_create_project", crashing_create)
    target = tmp_path / "NewApp"
    target.mkdir()
    assert cli.create_project("NewApp", target, "vite", False) == 2
    assert target.is_dir()
    assert not list(target.iterdir())
    assert not any(".skipo-stage-" in item.name for item in tmp_path.iterdir())
    assert json.loads(capsys.readouterr().out)["code"] == "SKIPO_CREATE_ROLLED_BACK"


def test_generated_staging_is_published_to_final_target(tmp_path, monkeypatch, capsys):
    def producing_create(name, stage, _framework):
        metadata = stage / ".skipo" / "project.json"
        metadata.parent.mkdir()
        metadata.write_text(json.dumps({"name": name}), encoding="utf-8")
        return 0

    monkeypatch.setattr(cli, "_populate_create_project", producing_create)
    target = tmp_path / "NewApp"
    assert cli.create_project("NewApp", target, "vite", False) == 0
    assert json.loads((target / ".skipo" / "project.json").read_text())["name"] == "NewApp"
    assert not any(".skipo-stage-" in item.name for item in tmp_path.iterdir())
    output = json.loads(capsys.readouterr().out)
    assert output["target"] == str(target) and output["applied"] is True
