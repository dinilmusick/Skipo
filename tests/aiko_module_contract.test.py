from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_aiko_scaffold_is_mandatory():
    source = (ROOT / "scripts" / "scaffold_app_structure.py").read_text(encoding="utf-8")
    assert "AikoModule" in source
    assert "createAikoRuntime" in source
    assert "AIKO_ENGINE_URL" in source
    assert "resolve-intelligence" in source
    assert "module/keys/export" in source

def test_aiko_contract_is_allowed():
    source = (ROOT / "checklists" / "15_contract_boundary_enforcement.py").read_text(encoding="utf-8")
    assert '"aiko"' in source
    assert '"canvas-ui/aiko"' in source
