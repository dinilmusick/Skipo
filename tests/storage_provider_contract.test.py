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

def test_google_drive_uses_kloks_adapter_in_every_canonical_scaffold():
    for scaffold_name in ("nextjs", "vite"):
        root = ROOT / "scaffolds" / scaffold_name
        backend = (root / "src/backend/AppBackend.ts").read_text()
        adapter = (root / "src/backend/storage/googleDriveWorkspaceStorage.ts").read_text()
        storage_types = (root / "src/libraries/types/storage.ts").read_text()
        env_example = (root / ".env.example").read_text()

        assert "storageProviders" in backend
        assert "googleDrive: { create: createGoogleDriveWorkspaceStorage }" in backend
        assert "GoogleDriveStorageService" in adapter
        assert "refreshGoogleDriveAccessToken" in adapter
        assert "googleAccessTokenExpiresAt" in storage_types
        assert "GOOGLE_DRIVE_CLIENT_SECRET" in env_example
        assert "GOOGLE_DRIVE_CLIENT_SECRET" not in backend

    generator = (ROOT / "scripts/scaffold_app_structure.py").read_text()
    assert "createGoogleDriveWorkspaceStorage" in generator
    assert "GoogleDriveStorageService" in generator
    assert "storageProviders" in generator
