from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def test_canonical_app_scaffold_recognizes_modules_directory():
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / "DemoApp"
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "scaffold_app_structure.py"), str(target), "--name", "DemoApp"],
            cwd=ROOT, capture_output=True, text=True,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        readme = target / "src" / "modules" / "README.md"
        assert readme.is_file()
        assert "complete" in readme.read_text(encoding="utf-8").lower()
        assert (target / "src" / "frontend").is_dir()
        assert (target / "src" / "backend").is_dir()
        assert (target / "src" / "libraries").is_dir()
