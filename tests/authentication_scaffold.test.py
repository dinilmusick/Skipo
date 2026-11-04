from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("skipo_auth_contract", ROOT / "checklists" / "21_skipo_authentication_contract.py")
AUTH_CONTRACT = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(AUTH_CONTRACT)
scan_source_tree = AUTH_CONTRACT.scan_source_tree


def test_generic_scaffold_generates_canonical_floks_kloks_auth(tmp_path):
    target = tmp_path / "CanonicalDemo"
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "scaffold_app_structure.py"), str(target), "--name", "CanonicalDemo"],
        cwd=ROOT, capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr

    auth_page = target / "src/frontend/pages/auth/page.tsx"
    adapter = target / "src/frontend/pages/auth/LuthAuthPage.tsx"
    guard = target / "src/backend/auth/luthSession.ts"
    backend = target / "src/backend/CanonicalDemoBackend.ts"
    manifest = json.loads((target / "package.json").read_text(encoding="utf-8"))

    assert auth_page.is_file() and adapter.is_file() and guard.is_file()
    assert "@ultrst-armada/floks/auth" in adapter.read_text(encoding="utf-8")
    assert "@ultrst-armada/kloks/auth" in adapter.read_text(encoding="utf-8")
    assert "LuthAuthPage" in auth_page.read_text(encoding="utf-8")
    assert "requireLuthSession" in guard.read_text(encoding="utf-8")
    assert "AuthServiceFacade" not in backend.read_text(encoding="utf-8")
    assert manifest["dependencies"]["@ultrst-armada/krnl"] == "^1.0.11"
    assert scan_source_tree(target) == []


def test_negative_scaffold_with_password_hashing_is_rejected(tmp_path):
    source = tmp_path / "src/auth/login.ts"
    source.parent.mkdir(parents=True)
    source.write_text("import bcrypt from 'bcryptjs';\nconst hash = await bcrypt.hash(password, 12);\n")
    assert any("bcrypt" in item for item in scan_source_tree(tmp_path))


def test_negative_scaffold_with_local_password_verification_is_rejected(tmp_path):
    source = tmp_path / "app/api/auth/route.ts"
    source.parent.mkdir(parents=True)
    source.write_text("export async function POST() { return verifyPassword(input.password, row.passwordHash); }\n")
    violations = scan_source_tree(tmp_path)
    assert any("password verification" in item or "credential hash" in item for item in violations)


def test_negative_scaffold_with_local_session_issuance_is_rejected(tmp_path):
    source = tmp_path / "src/auth/session.ts"
    source.parent.mkdir(parents=True)
    source.write_text("export const issue = (user) => jwt.sign({ sub: user.id }, secret);\n")
    assert any("JWT issuance" in item for item in scan_source_tree(tmp_path))


def test_negative_scaffold_with_direct_better_auth_database_is_rejected(tmp_path):
    source = tmp_path / "src/auth/server.ts"
    source.parent.mkdir(parents=True)
    source.write_text("import { betterAuth } from 'better-auth';\nexport const auth = betterAuth({ database: adapter });\n")
    assert any("Better Auth" in item for item in scan_source_tree(tmp_path))


def test_negative_scaffold_with_legacy_kloks_auth_facade_is_rejected(tmp_path):
    source = tmp_path / "src/backend/AppBackend.ts"
    source.parent.mkdir(parents=True)
    source.write_text("import { AuthServiceFacade } from '@ultrst-armada/kloks/backend';\nexport const services = { auth: AuthServiceFacade };\n")
    assert any("AuthServiceFacade" in item for item in scan_source_tree(tmp_path))


def test_negative_scaffold_with_local_credential_storage_is_rejected(tmp_path):
    source = tmp_path / "src/auth/credentials.ts"
    source.parent.mkdir(parents=True)
    source.write_text("localStorage.setItem('app-password', password);\n")
    assert any("credential persistence" in item for item in scan_source_tree(tmp_path))
