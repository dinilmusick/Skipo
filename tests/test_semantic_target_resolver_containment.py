"""Independent semantic-target path safety tests.

These tests exercise the stand-alone resolver, not CodeComposer's path guard.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from target_resolver import SemanticTargetResolver


def test_valid_marker_and_backend_property_resolution_remains_available(tmp_path):
    app = tmp_path / "app"
    app.mkdir()
    target = app / "src/main.ts"
    target.parent.mkdir()
    target.write_text(
        "// SKIPO:TARGET imports\n"
        "export const services = { midi: { enabled: true } };\n"
    )
    resolver = SemanticTargetResolver(app)
    marker = resolver.resolve({"file": "src/main.ts", "section": "imports"})
    assert marker.found
    assert marker.insertion_point > 0
    prop = resolver.resolve({"file": "src/main.ts", "property": "services", "key": "midi"})
    assert prop.found
    assert prop.reason == "Property already contains key"
    assert prop.file_path == target.resolve()


@pytest.mark.parametrize("selector", [
    "../outside.ts",
    "../../outside.ts",
    "/tmp/outside.ts",
    r"C:\\outside.ts",
    r"C:relative-drive.ts",
    r"..\\outside.ts",
    "",
    None,
    123,
    ".",
])
def test_invalid_or_external_targets_are_not_read(tmp_path, selector):
    root = tmp_path / "app"
    root.mkdir()
    outside = tmp_path / "outside.ts"
    outside.write_text("// SKIPO:TARGET evidence\nsecret=never-disclose")
    result = SemanticTargetResolver(root).resolve({"file": selector, "section": "evidence"})
    assert not result.found
    assert result.matched_text == ""
    assert result.insertion_point == -1


def test_symlinked_external_file_cannot_be_resolved(tmp_path):
    root = tmp_path / "app"
    root.mkdir()
    external = tmp_path / "external.ts"
    external.write_text("// SKIPO:TARGET evidence\nsecret=never-disclose")
    link = root / "alias.ts"
    try:
        link.symlink_to(external)
    except (NotImplementedError, OSError):
        pytest.skip("Symlinks unavailable")
    result = SemanticTargetResolver(root).resolve({"file": "alias.ts", "section": "evidence"})
    assert not result.found
    assert result.matched_text == ""


def test_directories_and_missing_files_return_not_found(tmp_path):
    root = tmp_path / "app"
    root.mkdir()
    (root / "src").mkdir()
    resolver = SemanticTargetResolver(root)
    for file in ("src", "missing.ts"):
        result = resolver.resolve({"file": file, "symbol": "App"})
        assert not result.found
        assert result.insertion_point == -1


def test_spec_object_and_nested_inside_root_supported(tmp_path):
    from target_resolver import TargetSpec

    root = tmp_path / "app"
    nested = root / "src" / "backend" / "service.ts"
    nested.parent.mkdir(parents=True)
    nested.write_text("export const services = { auth: 1 };\n")
    result = SemanticTargetResolver(root).resolve(TargetSpec(file="src/backend/service.ts", property="services"))
    assert result.found
    assert result.file_path == nested.resolve()
