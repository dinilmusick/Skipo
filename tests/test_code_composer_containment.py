"""Skipo CodeComposer must never escape a project or partially apply a failed write."""
from __future__ import annotations

import importlib
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def composer_types(monkeypatch, tmp_path):
    for var in ("SKIPO_KLOKS_ROOT", "SKIPO_FLOKS_ROOT", "SKIPO_KRNL_ROOT"):
        monkeypatch.setenv(var, str(tmp_path / "no-install-required"))
    monkeypatch.syspath_prepend(str(ROOT / "scripts"))
    module = importlib.import_module("skipo_builder")
    return module.CodeComposer, module.CodeOperation


def op(operation_type, file_name, module, target=None, symbol="Safe"):
    return module(
        type=operation_type,
        file=file_name,
        target=target if target is not None else {"file": file_name, "section": "imports"},
        payload={"import": symbol, "from": "@ultrst-armada/krnl"},
    )


def test_in_root_composition_is_deterministic_and_dry_run_is_read_only(tmp_path, composer_types):
    Composer, Operation = composer_types
    root = tmp_path / "app"
    root.mkdir()
    file = root / "main.ts"
    file.write_text("export const answer = 42;\n")
    compose = Composer(root)
    operation = op("add-import", "main.ts", Operation)
    ok, _ = compose.apply_operations([operation], dry_run=True)
    assert ok
    assert file.read_text() == "export const answer = 42;\n"
    ok, _ = compose.apply_operations([operation])
    assert ok
    assert file.read_text().startswith("import { Safe } from '@ultrst-armada/krnl';")
    ok, _ = compose.apply_operations([operation])
    assert ok
    assert file.read_text().count("import { Safe }") == 1


@pytest.mark.parametrize("escape", [
    "../outside.ts",
    "../../outside.ts",
    "/tmp/absolute-outside.ts",
    "C:\\\\outside.ts",
])
def test_parent_traversal_and_absolute_targets_are_rejected(tmp_path, composer_types, escape):
    Composer, Operation = composer_types
    root = tmp_path / "app"
    root.mkdir()
    outside = tmp_path / "outside.ts"
    outside.write_text("original")
    ok, logs = Composer(root).apply_operations([op("add-import", escape, Operation)])
    assert not ok, logs
    assert outside.read_text() == "original"


def test_symlink_outside_root_and_mismatched_semantic_target_are_rejected(tmp_path, composer_types):
    Composer, Operation = composer_types
    root = tmp_path / "app"
    root.mkdir()
    outside = tmp_path / "outside.ts"
    outside.write_text("original")
    try:
        (root / "link.ts").symlink_to(outside)
    except (NotImplementedError, OSError):
        pytest.skip("File symlinks unavailable on this platform")
    compose = Composer(root)
    ok, _ = compose.apply_operations([op("add-import", "link.ts", Operation)])
    assert not ok
    assert outside.read_text() == "original"
    inside = root / "inside.ts"
    inside.write_text("export const before = true;\n")
    mismatch = op("add-import", "inside.ts", Operation, {"file": "../outside.ts"})
    ok, _ = compose.apply_operations([mismatch])
    assert not ok
    assert inside.read_text() == "export const before = true;\n"


def test_failure_in_second_write_rolls_back_all_touched_files(tmp_path, composer_types, monkeypatch):
    Composer, Operation = composer_types
    root = tmp_path / "app"
    root.mkdir()
    first, second = root / "first.ts", root / "second.ts"
    first.write_text("first-original")
    second.write_text("second-original")
    real_write = Path.write_text
    triggered = False

    def fail_once(self, content, *args, **kwargs):
        nonlocal triggered
        if self == second and not triggered:
            triggered = True
            real_write(self, "partial", *args, **kwargs)
            raise OSError("simulated write interruption")
        return real_write(self, content, *args, **kwargs)

    monkeypatch.setattr(Path, "write_text", fail_once)
    ok, logs = Composer(root).apply_operations([
        op("add-import", "first.ts", Operation, symbol="One"),
        op("add-import", "second.ts", Operation, symbol="Two"),
    ])
    assert not ok
    assert triggered
    assert any("rollback attempted" in message for message in logs)
    assert first.read_text() == "first-original"
    assert second.read_text() == "second-original"


def test_unknown_operation_fails_closed_before_writes(tmp_path, composer_types):
    Composer, Operation = composer_types
    root = tmp_path / "app"
    root.mkdir()
    file = root / "main.ts"
    file.write_text("before")
    ok, _ = Composer(root).apply_operations([op("delete-everything", "main.ts", Operation)])
    assert not ok
    assert file.read_text() == "before"
