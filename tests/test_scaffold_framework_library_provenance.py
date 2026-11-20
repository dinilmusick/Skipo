"""Adversarial SHA-256 framework-source provenance: edited and user code never exempt."""
from __future__ import annotations

import hashlib
import importlib.util
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "checklists"))
sys.path.insert(0, str(ROOT / "scripts"))


def load_module(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "checklists" / filename)
    assert spec and spec.loader
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


validator = load_module("18_scoped_library_governance.py", "skipo_attested_scoped_library")
from generate_scaffold_library_attestation import canonical_bytes, ATTESTATION


def hard_errors(result):
    return [v for v in result.violations if v.severity == "error"]


class ImmutableFrameworkSourceTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.app = Path(self.scratch.name)
        (self.app / "package.json").write_text('{"name":"custom-app"}\n', encoding="utf-8")
        self.library = self.app / "src/libraries/types/urlRouting.ts"
        self.library.parent.mkdir(parents=True)
        self.library.write_bytes((ROOT / "scaffolds/vite/src/libraries/types/urlRouting.ts").read_bytes())

    def validate(self):
        return validator.validate_scoped_libraries(self.app)

    def test_canonical_template_is_not_falsely_application_authored(self):
        self.assertEqual(hard_errors(self.validate()), [])

    def test_crlf_and_lf_normalization_are_cryptographically_equivalent(self):
        self.library.write_bytes(self.library.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
        self.assertEqual(hard_errors(self.validate()), [])

    def test_modified_framework_source_loses_exemption(self):
        self.library.write_bytes(self.library.read_bytes() + b"\n// actual consumer customization\n")
        violations = hard_errors(self.validate())
        self.assertTrue(any(v.rule_id == "app-library-asset-naming" for v in violations))

    def test_new_app_library_is_never_automatically_whitelisted(self):
        name = self.app / "src/libraries/types/customDomain.ts"
        name.write_text("export interface UnscopedRecord { principal: string; }\n", encoding="utf-8")
        violations = hard_errors(self.validate())
        self.assertIn("app-library-asset-naming", [v.rule_id for v in violations])

    def test_tampered_manifest_fails_closed(self):
        fake = self.app / "spoofed_manifest.json"
        fake.write_bytes(ATTESTATION.read_bytes().replace(b"sha", b"SHA"))
        with patch.object(validator, "FRAMEWORK_MANIFEST_PATH", fake):
            violations = hard_errors(self.validate())
        self.assertIn("framework-library-attestation-invalid", [v.rule_id for v in violations])
        self.assertIn("app-library-asset-naming", [v.rule_id for v in violations])

    def test_missing_attestation_does_not_grant_exemptions(self):
        missing = self.app / "nonexistent-attestation.json"
        with patch.object(validator, "FRAMEWORK_MANIFEST_PATH", missing):
            violations = hard_errors(self.validate())
        self.assertIn("app-library-asset-naming", [v.rule_id for v in violations])

    def test_symlink_to_canonical_file_is_not_trusted(self):
        pointer = self.app / "src/libraries/types/urlRouting.ts"
        pointer.unlink()
        source = ROOT / "scaffolds/vite/src/libraries/types/urlRouting.ts"
        try:
            pointer.symlink_to(source)
        except (OSError, NotImplementedError):
            self.skipTest("Unprivileged runner cannot create file symlinks")
        violations = hard_errors(self.validate())
        self.assertIn("app-library-asset-naming", [v.rule_id for v in violations])


class CanonicalAttestationTests(unittest.TestCase):
    def test_manifest_is_byte_identical_to_generator_output(self):
        data = canonical_bytes()
        self.assertEqual(ATTESTATION.read_bytes(), data)
        self.assertEqual(hashlib.sha256(data).hexdigest(),
                         validator.TRUSTED_FRAMEWORK_MANIFEST_SHA256)

    def test_all_unmodified_default_vite_libraries_pass_scope(self):
        app = ROOT / "scaffolds" / "vite"
        violations = hard_errors(validator.validate_scoped_libraries(app))
        self.assertEqual(
            [v.rule_id for v in violations if v.rule_id == "app-library-asset-naming"],
            [],
        )


if __name__ == "__main__":
    unittest.main()
