"""Contract v2 adversarial, safety and deterministic migration coverage."""
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE / "scripts"))
import skipo_environment_contract as env


def project(tmp_path, text="SYSTEM_DATABASE_URL=postgres://fixture\nAPP_URL=https://example.test\n"):
    (tmp_path / ".env.example").write_text(text)
    return tmp_path


def put(root, path, content):
    p = root / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    return p


def names(root):
    return {(f["variable"], f["classification"]) for f in env.diagnose(root)["findings"]}


def test_only_four_exact_application_names(tmp_path):
    root = project(tmp_path)
    put(root, ".env.production", "SYSTEM_DATABASE_URL_2=second\nSYSTEM_DATABASE_URL_3=third\n")
    assert env.verify(root)["ok"]
    assert set(env.load_contract()["canonical"]["required"]) == {"SYSTEM_DATABASE_URL", "APP_URL"}
    assert set(env.load_contract()["canonical"]["optional"]) == {"SYSTEM_DATABASE_URL_2", "SYSTEM_DATABASE_URL_3"}


@pytest.mark.parametrize("bad", ["GEMINI_API_KEY", "STORAGE_SECRET_ACCESS_KEY", "STORAGE_REGION", "MY_SERVICE_TOKEN", "GITHUB_CUSTOM_SECRET", "VERCEL_MAGIC", "NEXT_PUBLIC_API_KEY", "ADMIN_PASSWORD"])
def test_extra_application_variable_rejected(tmp_path, bad):
    root = project(tmp_path)
    path = put(root, ".env.local", f"{bad}=secret-value\n")
    before = path.read_bytes()
    assert (bad, "undeclared_framework_configuration") in names(root)
    assert not env.repair(root)["ok"]
    assert path.read_bytes() == before


def test_required_both_missing(tmp_path):
    root = project(tmp_path, "SYSTEM_DATABASE_URL_2=unused\n")
    assert {"APP_URL", "SYSTEM_DATABASE_URL"} <= {f["variable"] for f in env.plan(root)["blocked_findings"]}


def test_missing_app_url_is_not_optional(tmp_path):
    root = project(tmp_path, "SYSTEM_DATABASE_URL=postgres://fixture\n")
    assert ("APP_URL", "missing_required") in names(root)


def test_alias_can_satisfy_required_preflight(tmp_path):
    root = project(tmp_path, "SYSTEM_DATABASE_URL_1=postgres://old\nDEPM_GATEWAY_DOMAIN=https://legacy.test\n")
    assert env.plan(root)["ok"]
    assert env.repair(root)["ok"]
    assert env.verify(root)["ok"]
    assert "SYSTEM_DATABASE_URL=postgres://old\nAPP_URL=https://legacy.test\n" == (root / ".env.example").read_text()
    assert env.repair(root)["actions"] == []


def test_preserve_secret_values_and_unrelated_words(tmp_path):
    root = project(tmp_path)
    path = put(root, ".env.local", 'DEPM_GATEWAY_DOMAIN="https://secret.test/DEPM_GATEWAY_DOMAIN?key=sensitive"\n')
    assert env.repair(root)["ok"]
    assert path.read_text() == 'APP_URL="https://secret.test/DEPM_GATEWAY_DOMAIN?key=sensitive"\n'


def test_source_reference_migrates_without_changing_comments(tmp_path):
    root = project(tmp_path)
    source = put(root, "src/config.ts", "// DEPM_GATEWAY_DOMAIN must not change\nconst x = process.env.DEPM_GATEWAY_DOMAIN;\nconst y = process.env['DEPM_GATEWAY_DOMAIN'];\n")
    assert env.repair(root)["ok"]
    assert source.read_text().splitlines() == [
        "// DEPM_GATEWAY_DOMAIN must not change", "const x = process.env.APP_URL;", "const y = process.env['APP_URL'];"
    ]


def test_duplicates_fail_closed(tmp_path):
    root = project(tmp_path, "SYSTEM_DATABASE_URL=one\nSYSTEM_DATABASE_URL=two\nAPP_URL=https://example.test\n")
    assert ("SYSTEM_DATABASE_URL", "duplicate_declaration") in names(root)
    assert not env.plan(root)["ok"]


def test_alias_target_conflict_is_ambiguous(tmp_path):
    root = project(tmp_path)
    path = put(root, ".env.production", "APP_URL=one\nDEPM_GATEWAY_DOMAIN=two\n")
    original = path.read_bytes()
    assert not env.repair(root)["ok"]
    assert path.read_bytes() == original


def test_cross_file_defaults_do_not_conflict(tmp_path):
    root = project(tmp_path)
    path = put(root, ".env.production", "DEPM_GATEWAY_DOMAIN=https://prod.test\n")
    assert env.repair(root)["ok"]
    assert path.read_text() == "APP_URL=https://prod.test\n"


def test_unknown_blocks_all_other_rewrites(tmp_path):
    root = project(tmp_path)
    alias = put(root, "src/index.js", "const x = process.env.DEPM_GATEWAY_DOMAIN;\n")
    put(root, "src/secret.js", "const y = process.env.GEMINI_API_KEY;\n")
    assert not env.repair(root)["ok"]
    assert "DEPM_GATEWAY_DOMAIN" in alias.read_text()


def test_platform_and_tooling_not_app_env(tmp_path):
    root = project(tmp_path)
    put(root, "src/runtime.ts", "const env = process.env.NODE_ENV; const port = process.env.PORT;\n")
    put(root, ".github/workflows/build.yml", "env:\n  SKIPO_OPERATION: verify\n  GITHUB_ACTIONS: 'true'\n")
    assert env.verify(root)["ok"], env.verify(root)["errors"]
    put(root, "src/runtime.ts", "const x = process.env.SKIPO_OPERATION;\n")
    assert ("SKIPO_OPERATION", "undeclared_framework_configuration") in names(root)


def test_platform_declaration_in_dotenv_is_not_permitted(tmp_path):
    root = project(tmp_path)
    put(root, ".env.local", "NODE_ENV=production\n")
    assert ("NODE_ENV", "undeclared_framework_configuration") in names(root)


def test_unknown_prefix_not_exempt(tmp_path):
    root = project(tmp_path)
    put(root, ".github/workflows/test.yml", "env:\n  GITHUB_CUSTOM_KEY: foo\n")
    assert ("GITHUB_CUSTOM_KEY", "undeclared_framework_configuration") in names(root)


def test_symlink_environment_is_blocker(tmp_path):
    root = project(tmp_path)
    outside = put(root, "original", "safe=secret\n")
    (root / ".env.local").symlink_to(outside)
    assert ("<symlink>", "unsafe_path") in names(root)
    assert not env.repair(root)["ok"]


def test_shell_and_yaml_and_toml_migrate(tmp_path):
    root = project(tmp_path)
    sh = put(root, "scripts/start.sh", "export DEPM_GATEWAY_DOMAIN=https://example.test\n")
    yaml = put(root, ".github/workflows/build.yml", "jobs:\n  run:\n    env:\n      DEPM_GATEWAY_DOMAIN: https://example.test\n")
    toml = put(root, "deploy.toml", '[env]\nDEPM_GATEWAY_DOMAIN = "https://example.test"\n')
    assert env.repair(root)["ok"]
    assert "export APP_URL=" in sh.read_text()
    assert "APP_URL:" in yaml.read_text()
    assert "APP_URL =" in toml.read_text()


def test_source_string_not_mutated(tmp_path):
    root = project(tmp_path)
    path = put(root, "src/index.ts", 'const docs = "DEPM_GATEWAY_DOMAIN";\nconst x = import.meta.env.DEPM_GATEWAY_DOMAIN;\n')
    assert env.repair(root)["ok"]
    assert '"DEPM_GATEWAY_DOMAIN"' in path.read_text()
    assert "import.meta.env.APP_URL" in path.read_text()


def test_repair_noop_does_not_touch_mtime(tmp_path):
    root = project(tmp_path)
    path = root / ".env.example"
    before = path.stat().st_mtime_ns
    result = env.repair(root)
    assert result["ok"] and not result["applied"] and result["actions"] == []
    assert path.stat().st_mtime_ns == before


def test_reference_like_text_in_literal_and_inline_comment_is_preserved(tmp_path):
    root = project(tmp_path)
    path = put(root, 'src/index.ts',
               'const s = "process.env.DEPM_GATEWAY_DOMAIN";\n'
               'const x = process.env.DEPM_GATEWAY_DOMAIN; // process.env.DEPM_GATEWAY_DOMAIN\n')
    assert env.repair(root)["ok"]
    assert path.read_text() == ('const s = "process.env.DEPM_GATEWAY_DOMAIN";\n'
                                'const x = process.env.APP_URL; // process.env.DEPM_GATEWAY_DOMAIN\n')


def test_python_generator_literal_is_not_application_runtime(tmp_path):
    root = project(tmp_path)
    put(root, "generators/storage.py", 'template = f"""const c = process.env.STORAGE_ACCESS_KEY_ID;"""\n')
    assert env.verify(root)["ok"]
    put(root, "src/generated.ts", 'const c = process.env.STORAGE_ACCESS_KEY_ID;\n')
    assert ("STORAGE_ACCESS_KEY_ID", "undeclared_framework_configuration") in names(root)


def test_optional_chaining_reference_is_scanned_and_migrated(tmp_path):
    root = project(tmp_path)
    p = put(root, "src/env.ts", "const u = process.env?.DEPM_GATEWAY_DOMAIN;\n")
    assert env.repair(root)["ok"]
    assert "process.env?.APP_URL" in p.read_text()


def test_atomic_rollback_after_injected_second_write_failure(tmp_path, monkeypatch):
    root = project(tmp_path)
    first = put(root, ".env.local", "DEPM_GATEWAY_DOMAIN=https://old.test\n")
    second = put(root, "src/index.ts", "const u = process.env.DEPM_GATEWAY_DOMAIN;\n")
    old_first, old_second = first.read_bytes(), second.read_bytes()
    original_write = env._write_atomic
    calls = {"n": 0}

    def flaky(path, data):
        calls["n"] += 1
        if calls["n"] == 2:
            raise OSError("injected write failure")
        return original_write(path, data)

    monkeypatch.setattr(env, "_write_atomic", flaky)
    result = env.repair(root)
    assert not result["ok"]
    assert result["rollback"]["ok"]
    assert first.read_bytes() == old_first
    assert second.read_bytes() == old_second