import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def run(*args):
    return subprocess.run([sys.executable, str(ROOT / "scripts/skipo_cli.py"), *args], capture_output=True, text=True)

def test_add_auth_and_workspace_is_deterministic():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "package.json").write_text(json.dumps({"name":"demo","dependencies":{}}))
        first = run("add", "auth", "workspace", str(root))
        assert first.returncode == 0, first.stdout + first.stderr
        state = json.loads((root / ".skipo/capabilities.json").read_text())
        assert set(state["installed"]) == {"auth","workspace"}
        assert (root / "src/libraries/skipo/auth.ts").is_file()
        assert (root / "src/libraries/skipo/workspace.ts").is_file()
        second = run("add", "auth", "workspace", str(root))
        assert second.returncode == 0, second.stdout + second.stderr
        assert json.loads((root / ".skipo/capabilities.json").read_text()) == state

def test_diagnose_and_repair_retire_safe_duplicate():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "package.json").write_text(json.dumps({"name":"demo","dependencies":{}}))
        dup = root / "src/frontend/components/WorkspaceCreateDialog.tsx"
        dup.parent.mkdir(parents=True)
        dup.write_text("export function WorkspaceCreateDialog(){ return null }")
        diagnosed = run("diagnose", str(root))
        assert diagnosed.returncode == 0
        assert "retire" in diagnosed.stdout
        repaired = run("repair", str(root))
        assert repaired.returncode == 0, repaired.stdout + repaired.stderr
        assert not dup.exists()
        verify = run("verify", str(root))
        assert verify.returncode == 0, verify.stdout + verify.stderr

def test_adopt_does_not_overwrite_existing_project_manifest():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "package.json").write_text(json.dumps({"name":"demo","dependencies":{}}))
        original = {"framework":"skipo","skipo_version":"0.9.0","custom":True}
        (root / ".skipo").mkdir()
        (root / ".skipo/project.json").write_text(json.dumps(original))
        result = run("adopt", str(root))
        assert result.returncode == 0
        assert json.loads((root / ".skipo/project.json").read_text()) == original
