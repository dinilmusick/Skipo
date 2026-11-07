from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_workspace_storage_declares_canonical_providers():
    workspace = (ROOT / "architecture/workspace-architectures/SKILL.md").read_text()
    app_contract = (ROOT / "architecture/app-architecture/SKILL.md").read_text()
    storage = (ROOT / "backend/workspace-storage/SKILL.md").read_text()

    for document in (workspace, app_contract, storage):
        assert "S3-compatible" in document
        assert "Google Drive" in document

    assert "Amazon S3 is not a selectable Skipo workspace provider" not in workspace
    assert "provider-specific SDKs and credentials" in workspace


def test_workspace_creation_dialog_is_owned_by_floks_for_all_skipo_scaffolds():
    for scaffold_name in ("nextjs", "vite"):
        root = ROOT / "scaffolds" / scaffold_name
        gate = (root / "src/frontend/components/gates/WorkspaceGate.tsx").read_text()
        package = __import__("json").loads((root / "package.json").read_text())

        assert "@ultrst-armada/floks/ui" in gate
        assert "WorkspaceTilesMenu" in gate
        assert "storageOptions" in gate
        assert "onManageStorage" in gate
        assert package["dependencies"]["@ultrst-armada/floks"] == "^1.13.18"

    generator = (ROOT / "scripts/scaffold_app_structure.py").read_text()
    root_package = __import__("json").loads((ROOT / "package.json").read_text())
    assert "WorkspaceTilesMenu" in generator
    assert "WorkspaceGate.tsx" in generator
    assert "onManageStorage" in generator
    assert '"@ultrst-armada/floks": "^1.13.18"' in generator
    assert root_package["dependencies"]["@ultrst-armada/floks"] == "^1.13.18"
