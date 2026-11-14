from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_generic_scaffold_contains_canonical_guest_contract(tmp_path):
    target = tmp_path / "GuestDemo"
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "scaffold_app_structure.py"), str(target), "--name", "GuestDemo"],
        cwd=ROOT, capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert (target / "src/guest/GuestMode.ts").is_file()
    gate = (target / "src/frontend/components/gates/GuestAccessGate.tsx").read_text(encoding="utf-8")
    assert "Continue as Guest" in gate
    assert "/api/guest/lease" in gate


def test_next_and_vite_scaffolds_expose_guest_entry_without_local_identity_authority():
    next_login = (ROOT / "scaffolds/nextjs/app/login/page.tsx").read_text(encoding="utf-8")
    next_gate = (ROOT / "scaffolds/nextjs/src/frontend/components/gates/GuestAccessGate.tsx").read_text(encoding="utf-8")
    vite_gate = (ROOT / "scaffolds/vite/src/frontend/components/gates/LoginGate.tsx").read_text(encoding="utf-8")
    assert "GuestAccessGate" in next_login
    assert "Continue as Guest" in next_gate
    assert "GuestAccessGate" in vite_gate
    assert "AuthServiceFacade" not in next_login
    assert "AuthServiceFacade" not in vite_gate
