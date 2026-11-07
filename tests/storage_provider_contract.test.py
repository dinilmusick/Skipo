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
