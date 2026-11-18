"""The CLI test command must not silently bypass required executable quality gates."""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import skipo_cli

SCRIPTS = {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "build": "vite build",
}


def application(tmp_path, scripts=None, locks=("pnpm-lock.yaml",)):
    root = tmp_path / "application"
    root.mkdir()
    (root / "package.json").write_text(
        json.dumps({"name": "example", "scripts": SCRIPTS if scripts is None else scripts}),
        encoding="utf-8",
    )
    for name in locks:
        (root / name).write_text("fixture-lock\n", encoding="utf-8")
    return root


@pytest.mark.parametrize("missing", sorted(SCRIPTS))
def test_missing_gate_fails_without_executing_anything(tmp_path, monkeypatch, capsys, missing):
    scripts = dict(SCRIPTS)
    del scripts[missing]
    root = application(tmp_path, scripts=scripts)
    monkeypatch.setattr(skipo_cli, "run", lambda *_: pytest.fail("preflight must block execution"))
    monkeypatch.setattr(skipo_cli, "verify_project", lambda *_: pytest.fail("verification must not substitute for missing gate"))
    assert skipo_cli.test_project(root) == 2
    evidence = json.loads(capsys.readouterr().out)
    assert evidence["ok"] is False
    assert evidence["diagnostics"][0]["code"] == "SKIPO_SCRIPT_MISSING"
    assert evidence["diagnostics"][0]["id"] == f"script_{missing}"


@pytest.mark.parametrize("placeholder", [
    "echo all tests passed",
    "true",
    "exit 0",
    "printf 'ok'",
    "skipo test .",
    "python scripts/skipo_cli.py test .",
    "npm test",
    "npm run test",
    "pnpm test",
    "yarn test",
])
def test_recursive_or_placeholder_test_script_fails_closed(tmp_path, monkeypatch, capsys, placeholder):
    root = application(tmp_path, scripts={**SCRIPTS, "test": placeholder})
    monkeypatch.setattr(skipo_cli, "run", lambda *_: pytest.fail("unsafe script must never execute"))
    assert skipo_cli.test_project(root) == 2
    evidence = json.loads(capsys.readouterr().out)
    assert any(issue["code"] == "SKIPO_SCRIPT_NONEXECUTABLE" for issue in evidence["diagnostics"])


@pytest.mark.parametrize("locks", [(), ("pnpm-lock.yaml", "package-lock.json")])
def test_ambiguous_or_missing_lockfile_is_not_guessed(tmp_path, monkeypatch, capsys, locks):
    root = application(tmp_path, locks=locks)
    monkeypatch.setattr(skipo_cli, "run", lambda *_: pytest.fail("cannot guess runner"))
    assert skipo_cli.test_project(root) == 2
    assert "Exactly one supported lockfile" in json.loads(capsys.readouterr().out)["error"]


def test_all_four_gates_execute_in_order_before_verification(tmp_path, monkeypatch):
    root = application(tmp_path)
    observed = []
    monkeypatch.setattr(skipo_cli, "run", lambda cmd, cwd: observed.append((cmd, cwd)) or 0)
    monkeypatch.setattr(skipo_cli, "verify_project", lambda path: observed.append(("verify", path)) or 0)
    assert skipo_cli.test_project(root) == 0
    assert observed == [
        (["pnpm", "run", name], root) for name in ("typecheck", "lint", "test", "build")
    ] + [("verify", root)]


def test_first_failed_script_aborts_while_preserving_failure(tmp_path, monkeypatch, capsys):
    root = application(tmp_path)
    observed = []
    def fail_lint(command, cwd):
        observed.append(command[-1])
        return 1 if command[-1] == "lint" else 0
    monkeypatch.setattr(skipo_cli, "run", fail_lint)
    monkeypatch.setattr(skipo_cli, "verify_project", lambda *_: pytest.fail("failed gate cannot be verified clean"))
    assert skipo_cli.test_project(root) == 1
    assert observed == ["typecheck", "lint"]
    assert json.loads(capsys.readouterr().out)["exit_code"] == 1


def test_non_object_package_manifest_fails_cleanly(tmp_path, capsys):
    root = application(tmp_path)
    (root / "package.json").write_text("[]", encoding="utf-8")
    assert skipo_cli.test_project(root) == 2
    assert json.loads(capsys.readouterr().out)["error"] == "package.json must be an object"


def test_delegating_to_distinct_test_script_is_allowed(tmp_path, monkeypatch):
    root = application(tmp_path, scripts={**SCRIPTS, "test": "pnpm run test:unit"})
    observed = []
    monkeypatch.setattr(skipo_cli, "run", lambda command, _cwd: observed.append(command[-1]) or 0)
    monkeypatch.setattr(skipo_cli, "verify_project", lambda _root: 0)
    assert skipo_cli.test_project(root) == 0
    assert observed == ["typecheck", "lint", "test", "build"]
