"""Adversarial stress testing of Skipo CLI test gate fail-closed behavior.

Tests real subprocess execution and edge cases:
- Placeholder / dummy test scripts
- Obfuscated whitespace in dummy scripts
- Recursive self-invocations
- Missing lockfiles, conflicting multiple lockfiles
- Subprocess exit code enforcement (exit code != 0)
"""
import json
import subprocess
import sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[1]
CLI_SCRIPT = ROOT / "scripts" / "skipo_cli.py"

BASE_SCRIPTS = {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "build": "vite build",
}

def make_fixture_app(tmp_path, scripts=None, locks=("pnpm-lock.yaml",)):
    app = tmp_path / "adversarial_fixture"
    app.mkdir(parents=True, exist_ok=True)
    pkg = {
        "name": "adversarial-test-app",
        "version": "1.0.0",
        "scripts": BASE_SCRIPTS if scripts is None else scripts,
    }
    (app / "package.json").write_text(json.dumps(pkg, indent=2), encoding="utf-8")
    for lock in locks:
        (app / lock).write_text("lockfile fixture content\n", encoding="utf-8")
    return app


@pytest.mark.parametrize("placeholder", [
    "echo ok",
    "echo   tests passed",
    "echo \"all tests passed\"",
    "printf 'passed'",
    "printf 'all tests completed successfully\\n'",
    "true",
    "exit 0",
    "exit   0",
    ":",
    "skipo test",
    "skipo test .",
    "python scripts/skipo_cli.py test",
    "npm test",
    "npm run test",
    "pnpm test",
    "pnpm run test",
    "yarn test",
    "yarn run test",
])
def test_adversarial_placeholder_scripts_fail_closed_via_cli_subprocess(tmp_path, placeholder):
    """Real CLI subprocess must reject placeholder scripts with exit code 2."""
    scripts = {**BASE_SCRIPTS, "test": placeholder}
    app = make_fixture_app(tmp_path, scripts=scripts, locks=("pnpm-lock.yaml",))

    proc = subprocess.run(
        [sys.executable, str(CLI_SCRIPT), "test", str(app)],
        capture_output=True,
        text=True,
    )

    assert proc.returncode == 2, f"Expected exit code 2 for placeholder '{placeholder}', got {proc.returncode}. Output: {proc.stdout}"
    data = json.loads(proc.stdout)
    assert data["ok"] is False
    assert any(d["code"] == "SKIPO_SCRIPT_NONEXECUTABLE" for d in data.get("diagnostics", []))


@pytest.mark.parametrize("locks", [
    (), # 0 lockfiles
    ("pnpm-lock.yaml", "package-lock.json"), # 2 lockfiles
    ("pnpm-lock.yaml", "yarn.lock"), # 2 lockfiles
    ("package-lock.json", "yarn.lock"), # 2 lockfiles
    ("pnpm-lock.yaml", "package-lock.json", "yarn.lock"), # 3 lockfiles
])
def test_adversarial_lockfiles_missing_or_ambiguous_fail_closed_via_subprocess(tmp_path, locks):
    """Real CLI subprocess must reject missing or multiple lockfiles with exit code 2."""
    app = make_fixture_app(tmp_path, locks=locks)

    proc = subprocess.run(
        [sys.executable, str(CLI_SCRIPT), "test", str(app)],
        capture_output=True,
        text=True,
    )

    assert proc.returncode == 2, f"Expected exit code 2 for locks {locks}, got {proc.returncode}"
    data = json.loads(proc.stdout)
    assert data["ok"] is False
    assert "lockfile" in data.get("error", "").lower()


@pytest.mark.parametrize("omitted_gate", ["typecheck", "lint", "test", "build"])
def test_adversarial_omitted_gate_fails_closed_via_subprocess(tmp_path, omitted_gate):
    """Real CLI subprocess must reject missing required gate with exit code 2."""
    scripts = dict(BASE_SCRIPTS)
    del scripts[omitted_gate]
    app = make_fixture_app(tmp_path, scripts=scripts, locks=("pnpm-lock.yaml",))

    proc = subprocess.run(
        [sys.executable, str(CLI_SCRIPT), "test", str(app)],
        capture_output=True,
        text=True,
    )

    assert proc.returncode == 2, f"Expected exit code 2 for missing {omitted_gate}, got {proc.returncode}"
    data = json.loads(proc.stdout)
    assert data["ok"] is False
    assert any(d["code"] == "SKIPO_SCRIPT_MISSING" and d["id"] == f"script_{omitted_gate}" for d in data.get("diagnostics", []))


def test_adversarial_empty_package_json_fails_closed(tmp_path):
    """Empty or non-existent package.json must fail closed with exit code 2."""
    app = tmp_path / "empty_app"
    app.mkdir()
    proc = subprocess.run(
        [sys.executable, str(CLI_SCRIPT), "test", str(app)],
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 2
