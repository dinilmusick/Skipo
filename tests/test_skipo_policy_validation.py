"""Malformed rules, collisions, and strictly scoped exception regression tests."""
import copy
import importlib.util
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/skipo_policy.py"
SPEC = importlib.util.spec_from_file_location("skipo_policy_validation", SCRIPT)
mod = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = mod
SPEC.loader.exec_module(mod)


def policy_with(*names):
    p = copy.deepcopy(mod.load_policy())
    p["rules"] = [r for r in p["rules"] if r["id"] in names]
    assert len(p["rules"]) == len(names)
    return p


def exception(rule_id="canonical-auth-page", path="src/frontend/pages/auth/page.tsx",
              issued="2026-11-01", expires="2026-12-01"):
    return {"id":"waiver-auth-1","rule_id":rule_id,"path":path,
            "rationale":"Temporary migration ticket for this exact asset only",
            "approved_by":"architecture-reviewer","ticket":"https://github.com/example/issues/124",
            "issued":issued,"expires":expires}


def test_explicit_exception_preserves_violation_evidence_and_expiry(tmp_path):
    p = policy_with("canonical-auth-page")
    e = exception()
    report = mod.evaluate(tmp_path, p, exceptions=[e], as_of=date(2026, 11, 17))
    assert report["state"] == "compliant"
    finding = report["diagnostics"][0]
    assert finding["code"] == "SKP-POL-STRUCT-AUTH"
    assert finding["evidence"]["kind"] == "missing_path"
    assert finding["exception"]["id"] == "waiver-auth-1"
    assert finding["verification"]["status"] == "exception_active"
    after = mod.evaluate(tmp_path, p, exceptions=[e], as_of=date(2027, 1, 1))
    assert after["state"] == "blocked"
    assert any(d["code"] == "SKP-POL-EXCEPTION-EXPIRED" for d in after["diagnostics"])
    assert any(d["code"] == "SKP-POL-STRUCT-AUTH" and d["state"] == "repairable" for d in after["diagnostics"])


@pytest.mark.parametrize("mutation", [
    lambda e: e.update(path="src/frontend/pages/auth/**"),
    lambda e: e.update(path="src/frontend/pages/main/page.tsx"),
    lambda e: e.update(rationale="short"),
    lambda e: e.update(ticket="http://not-https.example"),
    lambda e: e.update(expires="2027-07-01"),
    lambda e: e.update(rule_id="nonexistent"),
    lambda e: e.update(approved_by=""),
])
def test_broad_mis_scoped_or_unaudited_exceptions_rejected(mutation):
    p = policy_with("canonical-auth-page")
    e = exception()
    mutation(e)
    with pytest.raises(mod.PolicyError):
        mod.validate_exceptions({"schema_version":1,"policy_id":p["policy_id"],"policy_version":p["policy_version"],"exceptions":[e]},p)


def test_duplicate_scope_and_critical_exception_rejected():
    p = policy_with("canonical-auth-page")
    e = exception()
    e2 = dict(e, id="waiver-auth-2")
    with pytest.raises(mod.PolicyError):
        mod.validate_exceptions({"schema_version":1,"policy_id":p["policy_id"],"policy_version":p["policy_version"],"exceptions":[e,e2]},p)
    p2 = policy_with("forbid-direct-aws-sdk-import")
    e3 = exception(rule_id="forbid-direct-aws-sdk-import", path="src/backend/services/storage.ts")
    with pytest.raises(mod.PolicyError):
        mod.validate_exceptions({"schema_version":1,"policy_id":p2["policy_id"],"exceptions":[e3]},p2)


def test_invalid_schema_and_duplicate_diagnostic_codes():
    p = policy_with("canonical-auth-page", "canonical-main-page")
    p["rules"][1]["code"] = p["rules"][0]["code"]
    with pytest.raises(mod.PolicyError, match="duplicate rule"):
        mod.validate_policy(p)
    p = policy_with("canonical-auth-page")
    p["schema_version"] = 999
    with pytest.raises(mod.PolicyError, match="unsupported policy"):
        mod.validate_policy(p)


def test_conflicting_path_and_dependency_rules_rejected():
    p = policy_with("canonical-auth-page", "no-legacy-module-runtime")
    p["rules"][1]["check"]["pattern"] = "src/frontend/pages/auth/**"
    with pytest.raises(mod.PolicyError, match="simultaneously"):
        mod.validate_policy(p)
    p = policy_with("canonical-kloks-dependency", "forbid-direct-aws-dependency")
    p["rules"][1]["check"]["package"] = "@ultrst-armada/kloks"
    with pytest.raises(mod.PolicyError, match="conflicting dependency"):
        mod.validate_policy(p)


def test_unsupported_checks_and_incomplete_evidence_are_invalid():
    p = policy_with("canonical-auth-page")
    p["rules"][0]["check"] = {"kind":"execute_python", "source":"print('unsafe')"}
    with pytest.raises(mod.PolicyError, match="unsupported"):
        mod.validate_policy(p)
    p = policy_with("canonical-auth-page")
    p["rules"][0]["verification"]["independent"] = False
    with pytest.raises(mod.PolicyError, match="independent verification"):
        mod.validate_policy(p)


def test_reject_duplicate_json_keys_and_directory_traversal(tmp_path):
    invalid = tmp_path / "policy.json"
    invalid.write_text('{"schema_version":1,"schema_version":2}')
    with pytest.raises(mod.PolicyError, match="duplicate JSON key"):
        mod.load_policy(invalid)
    p = policy_with("canonical-auth-page")
    p["rules"][0]["check"]["path"] = "../secret"
    with pytest.raises(mod.PolicyError, match="unsafe"):
        mod.validate_policy(p)


def test_cli_exit_codes_and_invalid_definition_fail_closed(tmp_path):
    p = policy_with("canonical-auth-page")
    policy_file = tmp_path / "policy.json"
    policy_file.write_text(json.dumps(p))
    proc = subprocess.run([sys.executable,str(SCRIPT),str(tmp_path),"--policy",str(policy_file),
                           "--as-of","2026-11-17"],capture_output=True,text=True)
    assert proc.returncode == 2
    assert json.loads(proc.stdout)["state"] == "repairable"
    p["rules"][0]["check"]["kind"] = "evil"
    policy_file.write_text(json.dumps(p))
    bad = subprocess.run([sys.executable,str(SCRIPT),str(tmp_path),"--policy",str(policy_file)],
                         capture_output=True,text=True)
    assert bad.returncode == 3
    assert json.loads(bad.stdout)["diagnostics"][0]["code"] == "SKP-POL-POLICY-INVALID"
