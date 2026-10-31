from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]

def test_canonical_scaffold_emits_both_mandatory_modules():
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / "DemoApp"
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "scaffold_app_structure.py"), str(target), "--name", "DemoApp"],
            cwd=ROOT, capture_output=True, text=True,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        required = [
            "src/frontend/pages/main/tabs/fod/page.tsx",
            "src/frontend/pages/main/tabs/aiko/page.tsx",
            "src/backend/aikoRuntime.ts",
            "src/backend/DemoAppBackend.ts",
            "src/frontend/App.tsx",
        ]
        for rel in required:
            assert (target / rel).is_file(), rel
        backend = (target / "src/backend/DemoAppBackend.ts").read_text()
        app = (target / "src/frontend/App.tsx").read_text()
        assert "createFodRuntime" in backend
        assert "createAikoRuntime" in backend
        assert "FodTab" in app
        assert "AikoTab" in app

def test_composite_generator_delegates_to_canonical_scaffold():
    source = (ROOT / "generators" / "generate.py").read_text(encoding="utf-8")
    assert "from scripts.scaffold_app_structure import scaffold_structure" in source
    assert "canonical Skipo scaffold" in source
    assert "mandatory FOD+Aiko application scaffold" in source

def test_vite_and_nextjs_templates_have_both_tabs_and_aiko_api():
    for name in ("vite", "nextjs"):
        base = ROOT / "scaffolds" / name
        assert (base / "src/frontend/pages/main/tabs/fod/page.tsx").is_file()
        assert (base / "src/frontend/pages/main/tabs/aiko/page.tsx").is_file()
        assert (base / "src/backend/aikoRuntime.ts").is_file()
        assert "createAikoRuntime" in (base / "src/backend/AppBackend.ts").read_text()
        assert "Aiko" in (base / "src/frontend/pages/main/page.tsx").read_text()
    assert (ROOT / "scaffolds/nextjs/app/api/aiko/route.ts").is_file()
    assert (ROOT / "scaffolds/vite/src/backend/adapters/aikoRoutes.ts").is_file()
