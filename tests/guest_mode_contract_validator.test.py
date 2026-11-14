from __future__ import annotations

from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("guest_contract", ROOT / "checklists/27_guest_mode_contract.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def test_guest_contract_validator_accepts_canonical_tree():
    assert MODULE.validate_guest_contract(ROOT) == []


def test_guest_contract_rejects_guest_identity_synthesis(tmp_path):
    (tmp_path / "src").mkdir(parents=True)
    (tmp_path / "src/guest.ts").write_text(
        'const guest = true; const headers = {"x-user-id": "guest"};',
        encoding="utf-8",
    )
    assert any("x-user-id" in item for item in MODULE.validate_guest_contract(tmp_path))
