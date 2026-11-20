"""Adversarial checks for real worker boundaries and asynchronous purity grading."""
from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "checklists"))


def load_aspect(filename: str, namespace: str):
    spec = importlib.util.spec_from_file_location(namespace, ROOT / "checklists" / filename)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


state = load_aspect("13_state_execution_governance.py", "skipo_test_state_13")
purity = load_aspect("04_code_limits_purity.py", "skipo_test_purity_04")


def errors(result, rule_id: str) -> list:
    return [v for v in result.violations if v.rule_id == rule_id and v.severity == "error"]


class RealBackendBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.backend = self.root / "src/backend"
        self.backend.mkdir(parents=True)
        self.reference = ROOT / "scaffolds/vite/src/backend"
        self.app_backend = self.backend / "AppBackend.ts"
        self.alias = self.backend / "UniversalBackend.ts"
        self.app_backend.write_bytes((self.reference / "AppBackend.ts").read_bytes())
        self.alias.write_bytes((self.reference / "UniversalBackend.ts").read_bytes())

    def verify(self):
        return state.validate_state_execution(self.root)

    def test_canonical_worker_owner_and_pure_alias_are_valid(self):
        self.assertFalse(errors(self.verify(), "backend-facade-missing-worker-boundary"))

    def test_alias_does_not_sanitize_missing_worker_in_real_target(self):
        self.app_backend.write_text(
            self.app_backend.read_text(encoding="utf-8").replace(
                "new WorkerExecutionBoundary('app_worker_main')",
                "undefined",
            ), encoding="utf-8",
        )
        found = errors(self.verify(), "backend-facade-missing-worker-boundary")
        self.assertEqual({v.file_path for v in found},
                         {"src/backend/AppBackend.ts", "src/backend/UniversalBackend.ts"})

    def test_arbitrary_executable_alias_code_is_not_exempt(self):
        self.alias.write_text(
            self.alias.read_text(encoding="utf-8") +
            "\nexport const unguarded = await fetch('https://invalid.example');\n",
            encoding="utf-8",
        )
        found = errors(self.verify(), "backend-facade-missing-worker-boundary")
        self.assertEqual([v.file_path for v in found], ["src/backend/UniversalBackend.ts"])

    def test_comment_only_worker_marker_is_not_proof(self):
        (self.backend / "UntrustedBackend.ts").write_text(
            "// WorkerExecutionBoundary is intentionally not implemented\n"
            "export const untrustedBackend = { execute() {} };\n",
            encoding="utf-8",
        )
        found = errors(self.verify(), "backend-facade-missing-worker-boundary")
        self.assertIn("src/backend/UntrustedBackend.ts", [v.file_path for v in found])


class RuntimePurityClassificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.folder = self.root / "src/backend/ecosystem"
        self.folder.mkdir(parents=True)

    def verify(self):
        return purity.validate_code_limits_and_purity(self.root)

    def test_actual_async_auth_runtime_is_impure_not_passive_facade(self):
        canonical = (ROOT / "scaffolds/vite/src/backend/ecosystem/AppEcosystem_Impure.ts")
        (self.folder / canonical.name).write_bytes(canonical.read_bytes())
        self.assertFalse(errors(self.verify(), "purity-grade-mismatch"))

    def test_async_auth_runtime_cannot_be_falsely_named_facade(self):
        canonical = (ROOT / "scaffolds/vite/src/backend/ecosystem/AppEcosystem_Impure.ts")
        (self.folder / "NotActuallyA_Facade.ts").write_bytes(canonical.read_bytes())
        found = errors(self.verify(), "purity-grade-mismatch")
        self.assertEqual([v.file_path for v in found],
                         ["src/backend/ecosystem/NotActuallyA_Facade.ts"])

    def test_passive_local_module_cannot_call_itself_impure(self):
        source = "\n".join((
            "import { a } from './a.js';",
            "import { b } from './b.js';",
            "import { c } from './c.js';",
            "import { d } from './d.js';",
            "export const registry = { a, b, c, d };",
        ))
        (self.folder / "Registry_Impure.ts").write_text(source, encoding="utf-8")
        found = errors(self.verify(), "purity-grade-mismatch")
        self.assertEqual([v.file_path for v in found],
                         ["src/backend/ecosystem/Registry_Impure.ts"])


if __name__ == "__main__":
    unittest.main()
