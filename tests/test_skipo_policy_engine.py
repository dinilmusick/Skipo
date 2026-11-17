"""Behavior and deterministic evidence contract tests for standalone Skipo policies."""
import copy
import hashlib
import importlib.util
import json
import sys
from datetime import date
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/skipo_policy.py"
SPEC = importlib.util.spec_from_file_location("skipo_policy_standalone", SCRIPT)
policy_module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = policy_module
SPEC.loader.exec_module(policy_module)


def selected(*ids):
    policy = copy.deepcopy(policy_module.load_policy())
    policy["rules"] = [r for r in policy["rules"] if r["id"] in ids]
    assert len(policy["rules"]) == len(ids)
    return policy


def write(root, path, contents):
    file = root / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(contents)
    return file


def fixture_app(root):
    write(root, "package.json", json.dumps({"dependencies": {
        f"@ultrst-armada/{name}": "1.0.0" for name in ("floks", "kloks", "frnlts", "krnl")}}))
    for area in ("auth", "menus/workspaces", "main", "settings"):
        write(root, f"src/frontend/pages/{area}/page.tsx", "export default function Page() { return null; }\n")


def test_default_policy_and_compliant_app(tmp_path):
    policy = policy_module.load_policy()
    fixture_app(tmp_path)
    result = policy_module.evaluate(tmp_path, policy, as_of=date(2026, 11, 17))
    assert result["state"] == "compliant", result["diagnostics"]
    assert result["rules_evaluated"] == 20
    assert result["diagnostics"] == []
    assert len(result["policy_sha256"]) == 64


def test_provider_sdk_source_and_manifest_detected_with_evidence(tmp_path):
    fixture_app(tmp_path)
    write(tmp_path, "src/backend/services/storage.ts",
          'import { S3Client } from "@aws-sdk/client-s3";\nexport const store = new S3Client({});')
    write(tmp_path, "package.json", json.dumps({"dependencies": {
        "@aws-sdk/client-s3": "3.0.0", "@ultrst-armada/floks": "2.0.0"}}))
    policy = policy_module.load_policy()
    result = policy_module.evaluate(tmp_path, policy, as_of=date(2026, 11, 17))
    assert result["state"] == "blocked"
    diagnostics = {d["code"]: d for d in result["diagnostics"]}
    assert diagnostics["SKP-POL-DEP-AWS"]["path"] == "package.json"
    sdk = diagnostics["SKP-POL-IMP-AWS-SDK"]
    assert sdk["path"] == "src/backend/services/storage.ts"
    assert sdk["line"] == 1
    assert sdk["evidence"]["module"] == "@aws-sdk/client-s3"
    assert sdk["verification"]["independent"] is True
    assert sdk["verification"]["status"] == "pending"
    assert sdk["remediation"]


def test_local_ui_implementations_distinguished_from_imports(tmp_path):
    write(tmp_path, "src/frontend/components/WorkspaceCreateDialog.tsx",
          "export function WorkspaceCreateDialog() { return null }\n")
    write(tmp_path, "src/frontend/pages/main/page.tsx",
          "import { WorkspaceCreateDialog } from '@ultrst-armada/floks/ui'\n")
    result = policy_module.evaluate(tmp_path, selected("no-local-workspacecreatedialog-component"))
    assert len(result["diagnostics"]) == 1
    assert result["diagnostics"][0]["path"] == "src/frontend/components/WorkspaceCreateDialog.tsx"
    assert result["state"] == "repairable"


def test_generated_asset_provenance_missing_mismatch_and_matching(tmp_path):
    policy = selected("generated-auth-provenance")
    artifact = write(tmp_path, "src/libraries/skipo/auth.ts", "generated\n")
    initial = policy_module.evaluate(tmp_path, policy)
    assert initial["state"] == "ambiguous"
    assert initial["diagnostics"][0]["evidence"]["kind"] == "unverifiable_generated_asset"
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    manifest = {"schema_version": 1, "assets": {"src/libraries/skipo/auth.ts": {
        "owner": "skipo", "sha256": digest}}}
    write(tmp_path, ".skipo/generated-assets.json", json.dumps(manifest))
    assert policy_module.evaluate(tmp_path, policy)["state"] == "compliant"
    artifact.write_text("manually modified\n")
    changed = policy_module.evaluate(tmp_path, policy)
    assert changed["state"] == "ambiguous"
    assert changed["diagnostics"][0]["evidence"]["expected_sha256"] == digest
    assert changed["diagnostics"][0]["verification"]["status"] == "pending"


def test_protected_entrypoints_allow_custom_main_and_block_local_auth_extension(tmp_path):
    write(tmp_path, "src/frontend/pages/main/tabs/custom.tsx", "custom")
    write(tmp_path, "src/frontend/pages/auth/page.tsx", "canonical")
    policy = selected("reserved-canonical-pages")
    assert policy_module.evaluate(tmp_path, policy)["state"] == "compliant"
    write(tmp_path, "src/frontend/pages/auth/LocalLogin.tsx", "custom")
    report = policy_module.evaluate(tmp_path, policy)
    assert report["state"] == "repairable"
    assert report["diagnostics"][0]["path"] == "src/frontend/pages/auth/LocalLogin.tsx"


def test_computed_import_is_ambiguous_and_static_import_is_not(tmp_path):
    policy = selected("forbid-direct-aws-sdk-import")
    f = write(tmp_path, "src/backend/example.ts", 'const a = await import("@ultrst-armada/kloks");\n')
    assert policy_module.evaluate(tmp_path, policy)["state"] == "compliant"
    f.write_text("const a = await import(packageName);\n")
    report = policy_module.evaluate(tmp_path, policy)
    assert report["state"] == "ambiguous"
    assert report["diagnostics"][0]["evidence"]["kind"] == "computed_import"


def test_symlinks_are_blocked_not_followed(tmp_path):
    outside = tmp_path.parent / "outside-skipo-policy-test.txt"
    outside.write_text("bad")
    (tmp_path / "outside.ts").symlink_to(outside)
    report = policy_module.evaluate(tmp_path, selected("canonical-auth-page"))
    assert any(d["code"] == "SKP-POL-UNSAFE-PATH" and d["state"] == "blocked" for d in report["diagnostics"])
    outside.unlink()


def test_order_deterministic_independent_of_rule_listing_and_file_creation(tmp_path):
    policy = selected("canonical-auth-page", "canonical-main-page", "no-legacy-module-runtime")
    write(tmp_path, "src/module-runtime/b.ts", "bad")
    write(tmp_path, "src/module-runtime/a.ts", "bad")
    first = policy_module.evaluate(tmp_path, policy, as_of=date(2026, 11, 17))["diagnostics"]
    policy["rules"].reverse()
    second = policy_module.evaluate(tmp_path, policy, as_of=date(2026, 11, 17))["diagnostics"]
    assert first == second
    assert [d["path"] for d in first] == [
        "src/frontend/pages/auth/page.tsx", "src/frontend/pages/main/page.tsx",
        "src/module-runtime/a.ts", "src/module-runtime/b.ts"]


def test_missing_manifest_fails_closed_ambiguous_not_clean(tmp_path):
    result = policy_module.evaluate(tmp_path, selected("canonical-kloks-dependency"))
    assert result["state"] == "ambiguous"
    assert result["diagnostics"][0]["evidence"]["kind"] == "unreadable_manifest"


def test_unreadable_source_fails_closed(tmp_path):
    candidate = tmp_path / "src/backend/invalid.ts"
    candidate.parent.mkdir(parents=True)
    candidate.write_bytes(b"\xff\xfe")
    report = policy_module.evaluate(tmp_path, selected("forbid-direct-aws-sdk-import"))
    assert report["state"] == "ambiguous"
    assert report["diagnostics"][0]["evidence"]["kind"] == "unreadable_source"
