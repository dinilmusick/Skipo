"""Regression tests for the strict four-variable application contract."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from skipo_environment_contract import diagnose, plan, repair, verify


def seed(root: Path, text: str) -> Path:
    env = root / ".env.example"
    env.write_text(text, encoding="utf-8")
    return env


def test_clean_canonical_environment(tmp_path):
    seed(tmp_path, "SYSTEM_DATABASE_URL=postgres://example\\nAPP_URL=https://example.test\\n".replace("\\n", "\n"))
    assert diagnose(tmp_path)["ok"]
    assert verify(tmp_path)["ok"]


def test_unknown_application_credential_fails_closed(tmp_path):
    file = seed(tmp_path, "SYSTEM_DATABASE_URL=postgres://example\nAPP_URL=https://example.test\nUNDECLARED_API_TOKEN=secret\n")
    original = file.read_bytes()
    assert not diagnose(tmp_path)["ok"]
    assert not plan(tmp_path)["ok"]
    assert not repair(tmp_path, apply=True)["ok"]
    assert file.read_bytes() == original


def test_deprecated_alias_repaired_without_changing_unknown_code(tmp_path):
    seed(tmp_path, "SYSTEM_DATABASE_URL=postgres://example\nAPP_URL=https://example.test\n")
    env = tmp_path / ".env"
    env.write_text("DEPM_GATEWAY_DOMAIN=https://app.example\n")
    owned = tmp_path / "custom.ts"
    owned.write_text("export const custom = 42;\n")
    before = owned.read_bytes()
    proposed = plan(tmp_path)
    assert proposed["ok"] and proposed["actions"]
    result = repair(tmp_path, apply=True)
    assert result["ok"], result
    assert "APP_URL=https://app.example" in env.read_text()
    assert owned.read_bytes() == before
