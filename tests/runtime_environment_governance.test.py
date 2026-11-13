import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "checklists" / "26_skipo_runtime_environment_governance.py"

def run(target):
    return subprocess.run([sys.executable, str(VALIDATOR), str(target)], cwd=str(ROOT / "checklists"), capture_output=True, text=True)

def test_standard_environment_passes(tmp_path):
    (tmp_path / ".env.example").write_text("APP_URL=https://example.test\nSYSTEM_DATABASE_URL=postgres://example\nSYSTEM_DATABASE_URL_2=\nSYSTEM_DATABASE_URL_3=\n")
    result = run(tmp_path)
    assert result.returncode == 0
    assert result.stdout.count("ENV-001") == 0

def test_extra_environment_is_warning_not_failure(tmp_path):
    (tmp_path / ".env.example").write_text("APP_URL=https://example.test\nSYSTEM_DATABASE_URL=postgres://example\nMY_SPECIAL_SERVICE_KEY=secret\n")
    (tmp_path / "src.ts").write_text("const value = process.env.MY_SPECIAL_SERVICE_KEY;\n")
    result = run(tmp_path)
    assert result.returncode == 0
    assert "ENV-001" in result.stdout
    assert "strongly discouraged" in result.stdout

def test_depm_exception_is_allowed_for_depm_engine(tmp_path):
    (tmp_path / "package.json").write_text('{"name":"depm-engine"}')
    (tmp_path / ".env.example").write_text("SYSTEM_DATABASE_URL=postgres://example\nDEPM_GATEWAY_DOMAIN=example.test\n")
    result = run(tmp_path)
    assert result.returncode == 0
    assert "ENV-001" not in result.stdout
