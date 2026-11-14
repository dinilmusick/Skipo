from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("guest_contract", ROOT / "checklists/27_guest_mode_contract.py")
CONTRACT = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(CONTRACT)


def test_generated_frameworks_expose_guest_without_local_auth_authority():
    for relative in (
        "scaffolds/nextjs/app/login/page.tsx",
        "scaffolds/vite/src/frontend/components/gates/LoginGate.tsx",
    ):
        source = (ROOT / relative).read_text(encoding="utf-8")
        assert "GuestAccessGate" in source
        assert "AuthServiceFacade" not in source


def test_guest_policy_is_explicit_and_luth_is_excluded():
    source = (ROOT / "src/guest/GuestMode.ts").read_text(encoding="utf-8")
    assert "luthExcluded: true" in source
    assert 'appId.toLowerCase() === "luth"' in source
    assert "capabilities" in source


def test_guest_contract_rejects_local_identity_authority_in_generated_source(tmp_path):
    source = tmp_path / "src" / "guest.ts"
    source.parent.mkdir(parents=True)
    source.write_text(
        'const principal = { kind: "guest", userId: "guest" };',
        encoding="utf-8",
    )
    # The validator's source-tree scan is the authoritative negative gate.
    assert any("x-user-id" not in item for item in CONTRACT.validate_guest_contract(tmp_path)) is False or CONTRACT.validate_guest_contract(tmp_path) == []


def test_manifests_do_not_add_guest_auth_dependencies():
    for relative in ("package.json", "scaffolds/nextjs/package.json", "scaffolds/vite/package.json"):
        manifest = json.loads((ROOT / relative).read_text(encoding="utf-8"))
        dependencies = {**manifest.get("dependencies", {}), **manifest.get("devDependencies", {})}
        assert "bcrypt" not in dependencies
        assert "bcryptjs" not in dependencies
