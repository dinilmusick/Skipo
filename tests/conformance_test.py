"""Orchestrator contract tests. Command doubles here are NOT production evidence.

The separate real-main integration cases call the actual Skipo CLI/checklists.
"""
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("skipo_conformance", ROOT / "scripts/skipo_conformance.py")
cert = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = cert
spec.loader.exec_module(cert)
CASES = json.loads((Path(__file__).parent / "conformance_fixtures/cases.json").read_text())["cases"]
SHA = "a" * 40


def app_fixture(tmp_path, scripts=None):
    app = tmp_path / "application"
    (app / "src/frontend/components").mkdir(parents=True)
    (app / "src/backend").mkdir(parents=True)
    (app / "src/frontend/index.ts").write_text("export const a = 1;\n")
    (app / "src/backend/index.ts").write_text("export const b = 2;\n")
    (app / "package-lock.json").write_text('{"name":"fixture","lockfileVersion":3,"packages":{}}')
    (app / "sanity.js").write_text("export const ok = true;\n")
    (app / "contract.test.mjs").write_text("import {test} from 'node:test'; import {strict as assert} from 'node:assert'; test('real assertion',()=>assert.equal(2+2,4));\n")
    (app / "scripts").mkdir()
    (app / "scripts/build.mjs").write_text("import {mkdirSync,writeFileSync} from 'node:fs';mkdirSync('dist',{recursive:true});writeFileSync('dist/build.txt','built');\n")
    scripts = scripts if scripts is not None else {"lint":"node --check sanity.js", "typecheck":"node --check sanity.js", "test":"node --test contract.test.mjs", "build":"node scripts/build.mjs"}
    (app / "package.json").write_text(json.dumps({"name":"fixture", "scripts":scripts, "dependencies":{}}))
    return app


def successful_cli(monkeypatch):
    # Simulates *only* the transport/contract of existing validators.
    def fake_cli(framework_root, app, command):
        return cert._check("skipo_" + command, "passed", "SKIPO_" + command.upper() + "_PASSED", "synthetic contract output, not real validation")
    monkeypatch.setattr(cert, "_cli_check", fake_cli)


def codes(report):
    return {check["code"] for check in report["checks"]}


def test_clean_orchestration_control_is_read_only(tmp_path, monkeypatch):
    successful_cli(monkeypatch)
    app = app_fixture(tmp_path)
    before = cert.source_snapshot(app)
    result = cert.certify(app, ROOT, commit_sha=SHA)
    assert result["compliance_status"] == "compliant_offline", result["checks"]
    assert result["live_end_to_end_certified"] is False
    assert all(v["status"] == "unverified" for v in result["unverified_integrations"])
    assert cert.source_snapshot(app) == before
    assert not (app / "dist").exists(), "Build output must remain inside the disposable copy"
    assert all(c["status"] == "passed" for c in result["checks"])


@pytest.mark.parametrize("missing", ["lint", "test", "typecheck", "build"])
def test_missing_script_fails_closed(tmp_path, monkeypatch, missing):
    successful_cli(monkeypatch)
    app = app_fixture(tmp_path)
    pkg = json.loads((app / "package.json").read_text())
    del pkg["scripts"][missing]
    (app / "package.json").write_text(json.dumps(pkg))
    result = cert.certify(app, ROOT, commit_sha=SHA)
    assert result["compliance_status"] == "noncompliant"
    assert "SKIPO_SCRIPT_MISSING" in codes(result)


@pytest.mark.parametrize("script", ["echo success", "true", "skipo test ."])
def test_fake_scripts_cannot_be_certified(tmp_path, monkeypatch, script):
    successful_cli(monkeypatch)
    app = app_fixture(tmp_path)
    pkg = json.loads((app / "package.json").read_text())
    pkg["scripts"]["test"] = script
    (app / "package.json").write_text(json.dumps(pkg))
    assert "SKIPO_SCRIPT_NONEXECUTABLE" in codes(cert.certify(app, ROOT, commit_sha=SHA))


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_adversarial_injection_must_not_certify(tmp_path, monkeypatch, case):
    successful_cli(monkeypatch)
    app = app_fixture(tmp_path)
    target = app / case["path"]
    target.parent.mkdir(parents=True, exist_ok=True)
    if case["name"] == "modified_generated_file":
        (app / ".skipo").mkdir(exist_ok=True)
        (app / ".skipo/capabilities.json").write_text(json.dumps({"generated":[{"path":case["path"],"owner":"skipo","checksum":hashlib.sha256(b"original").hexdigest()}]}))
    target.write_text(case["content"])
    # Real-main-specific infra checks are exercised in separate integration tests.
    if case["name"] in {"modified_generated_file", "illegal_environment", "missing_migration"}:
        def inject_verify(framework_root, app, command):
            if command == "verify":
                return cert._check("skipo_verify", "failed", case["expected_code"], "existing verifier diagnostic injected for transport test")
            return cert._check("skipo_check", "passed", "SKIPO_CHECK_PASSED", "contract transport")
        monkeypatch.setattr(cert, "_cli_check", inject_verify)
    result = cert.certify(app, ROOT, require_live=case.get("require_live", False), commit_sha=SHA)
    assert result["compliance_status"] != "compliant_offline", (case, result["checks"])
    assert case["expected_code"] in codes(result)


def test_failed_dependency_install_still_produces_unresolved_report(tmp_path, monkeypatch):
    successful_cli(monkeypatch)
    app = app_fixture(tmp_path)
    result = cert.certify(app, ROOT, commit_sha=SHA, dependency_install_failed=True)
    assert result["compliance_status"] == "unresolved"
    assert "SKIPO_DEPENDENCY_INSTALL_FAILED" in codes(result)
    assert result["live_end_to_end_certified"] is False
    assert result["source_sha256"]


def test_nested_tracked_app_commit_sha_is_not_misattributed(tmp_path):
    if shutil.which("git") is None:
        pytest.skip("Git unavailable")
    repository = tmp_path / "repo"
    repository.mkdir()
    app = app_fixture(repository)
    subprocess.run(["git", "init", "-q", str(repository)], check=True)
    subprocess.run(["git", "-C", str(repository), "add", "application"], check=True)
    subprocess.run(["git", "-C", str(repository), "-c", "user.name=Conformance", "-c", "user.email=cert@example.test", "commit", "-qm", "baseline"], check=True)
    committed = cert._git_sha(app)
    assert committed is not None and len(committed) == 40
    (app / "src/frontend/index.ts").write_text("export const a = 2;\n")
    assert cert._git_sha(app) is None, "Dirty application cannot be attributed to an unchanged commit"


def test_existing_main_minimal_verification_does_not_imply_full_conformance(tmp_path):
    """Main verification and full conformance are distinct evidence surfaces."""
    if not (ROOT / "scripts/skipo_cli.py").is_file():
        pytest.skip("A full Skipo checkout is required")
    app = app_fixture(tmp_path)
    (app / ".env.example").write_text("SYSTEM_DATABASE_URL=postgresql://localhost/sample\nAPP_URL=http://localhost:3000\n")
    state = app / ".skipo"
    state.mkdir()
    version = json.loads((ROOT / "package.json").read_text())["version"]
    (state / "project.json").write_text(json.dumps({"framework":"skipo", "skipo_version":version}))
    (state / "capabilities.json").write_text(json.dumps({"schemaVersion":1,"installed":{},"generated":[]}))
    (state / "dependencies.json").write_text("{}")
    (state / "migration-state.json").write_text(json.dumps({"schemaVersion":1,"applied":["1.1.0-capability-composition"],"pending":[]}))
    before = cert.source_snapshot(app)
    checked = cert._cli_check(ROOT, app, "check")
    verified = cert._cli_check(ROOT, app, "verify")
    assert checked["status"] == "failed", checked  # Minimal app lacks canonical build/docs/adapters.
    assert any(a.get("error_count", 0) > 0 for a in checked["failing_aspects"])
    assert verified["status"] == "failed", verified  # Isolated canonical state is insufficient under integrated governance.
    assert verified.get("diagnostics"), "An uncertified partial application must supply actionable evidence."
    assert cert.source_snapshot(app) == before


def test_no_commit_or_lockfile_is_unresolved(tmp_path, monkeypatch):
    successful_cli(monkeypatch)
    app = app_fixture(tmp_path)
    (app / "package-lock.json").unlink()
    monkeypatch.setattr(cert, "_git_sha", lambda root: None)
    report = cert.certify(app, ROOT)
    assert "SKIPO_LOCKFILE_AMBIGUOUS" in codes(report)
    assert "SKIPO_COMMIT_UNKNOWN" in codes(report)
    assert report["compliance_status"] == "unresolved"


def test_non_json_cli_output_is_unresolved(tmp_path, monkeypatch):
    app = app_fixture(tmp_path)
    monkeypatch.setattr(cert, "_execute", lambda *args, **kwargs: (0, "not json", "", None))
    result = cert._cli_check(ROOT, app, "check")
    assert result["code"] == "SKIPO_CLI_MISSING" or result["code"] == "SKIPO_INVALID_EVIDENCE"


def test_malformed_full_validator_evidence_fails_closed(tmp_path, monkeypatch):
    app = app_fixture(tmp_path)
    fixture_root = tmp_path / "framework"
    cli = fixture_root / "scripts/skipo_cli.py"
    cli.parent.mkdir(parents=True)
    cli.write_text("# synthetic command transport path\n")
    monkeypatch.setattr(cert, "_execute", lambda *args, **kwargs: (0, json.dumps({"overall_passed":True,"total_errors":0,"profile":"harness","aspects":[]}), "", None))
    result = cert._cli_check(fixture_root, app, "check")
    assert result["status"] == "unresolved"
    assert result["code"] == "SKIPO_VALIDATION_SURFACE_INCOMPLETE"


def test_actual_main_cli_detects_checksum_and_migration_violations(tmp_path):
    """Use actual main verifier with temporary app and valid state shapes, no doubles."""
    cli = ROOT / "scripts/skipo_cli.py"
    if not cli.is_file():
        pytest.skip("Only available in a full Skipo checkout")
    app = tmp_path / "app"
    result = subprocess.run([sys.executable, str(cli), "create", "ConformanceFixture", str(app), "--framework", "vite"], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr + result.stdout
    cap_path = app / ".skipo/capabilities.json"
    state = json.loads(cap_path.read_text())
    files = sorted((app / "src/frontend").rglob("*.ts")) + sorted((app / "src/frontend").rglob("*.tsx"))
    assert files, "Generated project must have frontend sources"
    path = files[0]
    relative = path.relative_to(app).as_posix()
    state.setdefault("generated", []).append({"path": relative, "owner": "skipo", "checksum": hashlib.sha256(path.read_bytes()).hexdigest()})
    cap_path.write_text(json.dumps(state))
    path.write_bytes(path.read_bytes() + b"\n// tampered\n")
    check = subprocess.run([sys.executable, str(cli), "verify", str(app)], capture_output=True, text=True)
    payload = json.loads(check.stdout)
    assert check.returncode != 0
    assert "SKIPO_CHECKSUM_MISMATCH" in {item["code"] for item in payload["diagnostics"]}
    state_file = app / ".skipo/migration-state.json"
    state_file.write_text(json.dumps({"applied": [], "pending": ["nonexistent-migration-2026"]}))
    check = subprocess.run([sys.executable, str(cli), "verify", str(app)], capture_output=True, text=True)
    payload = json.loads(check.stdout)
    assert "SKIPO_MIGRATION_UNKNOWN" in {item["code"] for item in payload["diagnostics"]}


@pytest.mark.parametrize("case", CASES, ids=["main_" + c["name"] for c in CASES])
def test_actual_main_adversarial_surface_evidence(tmp_path, case):
    """Real main CLI verification, distinct from synthetic orchestration tests."""
    cli = ROOT / "scripts/skipo_cli.py"
    if not cli.is_file():
        pytest.skip("Full Skipo main checkout unavailable; test runs in GitHub Actions")
    app = tmp_path / "actual-main-app"
    created = subprocess.run([sys.executable, str(cli), "create", "ConformanceFixture", str(app), "--framework", "vite"], capture_output=True, text=True)
    assert created.returncode == 0, created.stderr + created.stdout
    target = app / case["path"]
    target.parent.mkdir(parents=True, exist_ok=True)
    if case["name"] == "modified_generated_file":
        target.write_text("export const source = 1;\n")
        data_path = app / ".skipo/capabilities.json"
        data = json.loads(data_path.read_text())
        data.setdefault("generated", []).append({"owner": "skipo", "path": case["path"], "checksum": hashlib.sha256(target.read_bytes()).hexdigest()})
        data_path.write_text(json.dumps(data))
    target.write_text(case["content"])
    if case["name"] in {"duplicated_auth", "local_workspace_ui", "forbidden_import"}:
        gaps = cert._coverage_gaps(app)
        assert "SKIPO_CANONICAL_OWNERSHIP_AMBIGUOUS" in {g["code"] for g in gaps}
        if case["name"] == "forbidden_import":
            full = cert._cli_check(ROOT, app, "check")
            assert full["status"] in {"failed", "unresolved"}, full
    elif case["name"] in {"modified_generated_file", "missing_migration"}:
        verified = cert._cli_check(ROOT, app, "verify")
        assert verified["status"] == "failed", verified
        assert case["expected_code"] in {d["code"] for d in verified.get("diagnostics", [])}
    elif case["name"] == "illegal_environment":
        verified = cert._cli_check(ROOT, app, "verify")
        full = cert._cli_check(ROOT, app, "check")
        assert verified["status"] != "passed" or full["status"] != "passed"
        # The current main verifier surfaces unknown variables through existing
        # environment governance as SKIPO_CONSTRAINT_ENV-001. Some forbidden
        # framework-owned names also emit SKIPO_FORBIDDEN_ENVIRONMENT_VARIABLE.
        # Both are explicit evidence; never invent a diagnostic code.
        assert ({"SKIPO_FORBIDDEN_ENVIRONMENT_VARIABLE", "SKIPO_CONSTRAINT_ENV-001"}
                & {d["code"] for d in verified.get("diagnostics", [])}
                or any(a.get("aspect_id") == "aspect_26" for a in full.get("failing_aspects", [])))
    elif case["name"] == "incomplete_integration":
        report = cert.certify(app, ROOT, require_live=True, commit_sha=SHA)
        assert "SKIPO_LIVE_INTEGRATIONS_UNVERIFIED" in codes(report)
        assert report["live_end_to_end_certified"] is False