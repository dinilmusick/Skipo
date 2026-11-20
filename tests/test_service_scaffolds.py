"""Real CLI regression tests for deterministic app-owned service scaffolds."""
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "scripts" / "skipo_cli.py"


class ServiceScaffoldTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix="skipo-service-")
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        (self.root / "package.json").write_text(json.dumps({
            "name": "consumer", "dependencies": {"@ultrst-armada/krnl": "1.0.0"}
        }))
        backend = self.root / "src/backend/AppBackend.ts"
        backend.parent.mkdir(parents=True)
        backend.write_text(
            "import { existing } from './existing.js';\n"
            "export const services = {\n  existing,\n};\n"
            "export const keepUnchanged = true;\n"
        )

    def run_cli(self, *args, ok=True):
        result = subprocess.run(
            [sys.executable, str(CLI), "service", *args, str(self.root)],
            text=True, capture_output=True,
        )
        if not result.stdout.strip():
            self.fail(f'CLI emitted no JSON: status={result.returncode} stderr={result.stderr!r}')
        payload = json.loads(result.stdout)
        if ok:
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            self.assertTrue(payload["ok"], payload)
        else:
            self.assertNotEqual(result.returncode, 0, payload)
            self.assertFalse(payload["ok"], payload)
        return payload

    def test_create_idempotent_and_declared_functionality_is_user_owned(self):
        plan = self.run_cli("create", "Weather", "--plan")
        self.assertFalse(plan["applied"])
        self.assertFalse((self.root / ".skipo").exists())
        made = self.run_cli("create", "Weather")
        self.assertIn("src/backend/services/weather/service.ts", made["writes"])
        source = self.root / "src/backend/services/weather/service.ts"
        self.assertIn("createServiceDefinition", source.read_text())
        self.assertIn("createService(", source.read_text())
        self.assertNotIn("return { success: true }", source.read_text())
        state = (self.root / ".skipo/service-scaffolds.json").read_bytes()
        again = self.run_cli("create", "Weather")
        self.assertEqual(again["writes"], [])
        self.assertEqual(state, (self.root / ".skipo/service-scaffolds.json").read_bytes())
        self.run_cli("functionality", "Weather", "getForecast")
        fn = self.root / "src/backend/services/weather/functionalities/getForecast.ts"
        self.assertIn("not been implemented", fn.read_text())
        fn.write_text("export const getForecast = { id: 'WeatherService.getForecast', name: 'getForecast', handler: async () => 42 };\n")
        self.run_cli("helper", "Weather", "normalizeForecast")
        self.assertEqual(fn.read_text().count("=> 42"), 1)
        self.assertIn("normalizeForecast", (self.root / "src/backend/services/weather/helpers/index.ts").read_text())
        self.run_cli("repair", "Weather")
        self.assertIn("=> 42", fn.read_text())
        self.run_cli("verify", "Weather")

    def test_bind_is_explicit_scoped_and_repeatable(self):
        self.run_cli("new", "Weather")
        backend = self.root / "src/backend/AppBackend.ts"
        original = backend.read_text()
        self.assertEqual(original.count("...appOwnedServices"), 0)
        self.run_cli("bind", "Weather")
        self.assertIn("...appOwnedServices", backend.read_text())
        self.assertEqual(backend.read_text().count("...appOwnedServices"), 1)
        registry = self.root / "src/backend/services/__skipo/registry.ts"
        self.assertIn("WeatherServiceFacade", registry.read_text())
        before = backend.read_bytes(), registry.read_bytes()
        self.assertEqual(self.run_cli("bind", "Weather")["writes"], [])
        self.assertEqual(before, (backend.read_bytes(), registry.read_bytes()))
        self.assertIn("export const keepUnchanged = true", backend.read_text())
        self.run_cli("verify", "Weather")

    def test_repair_recovers_missing_managed_files_but_not_custom_code(self):
        self.run_cli("create", "Ledger")
        managed = self.root / "src/backend/services/ledger/functionalities/index.ts"
        managed.unlink()
        self.assertNotEqual(self.run_cli("verify", "Ledger", ok=False)["operation"], "repair")
        result = self.run_cli("repair", "Ledger")
        self.assertIn("src/backend/services/ledger/functionalities/index.ts", result["writes"])
        managed.write_text("/* manual mutation */\n")
        refused = self.run_cli("repair", "Ledger", ok=False)
        self.assertIn("src/backend/services/ledger/functionalities/index.ts", refused["conflicts"])
        self.assertEqual(managed.read_text(), "/* manual mutation */\n")
        self.run_cli("repair", "Ledger", "--reset")
        self.assertIn("functionalityOperations", managed.read_text())
        sha = hashlib.sha256(b"/* manual mutation */\n").hexdigest()
        backup = self.root / ".skipo/service-backups/ledger" / sha / "src/backend/services/ledger/functionalities/index.ts"
        self.assertEqual(backup.read_text(), "/* manual mutation */\n")
        self.run_cli("verify", "Ledger")

    def test_reject_unsafe_names_and_existing_unowned_files(self):
        self.run_cli("create", "Weather")
        for invalid in ("../escape", "__proto__", "Weather-Other", "1Weather"):
            self.run_cli("create", invalid, ok=False)
        self.run_cli("helper", "Weather", "__proto__", ok=False)
        unknown = self.run_cli("bind", "Missing", ok=False)
        self.assertIn("Unknown app-owned service", unknown["error"])
        path = self.root / "src/backend/services/weather/helpers/preexisting.ts"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("export const keep = 1;\n")
        denied = self.run_cli("helper", "Weather", "preexisting", ok=False)
        self.assertIn("src/backend/services/weather/helpers/preexisting.ts", denied["conflicts"])
        self.assertEqual(path.read_text(), "export const keep = 1;\n")
        state = json.loads((self.root / ".skipo/service-scaffolds.json").read_text())
        self.assertNotIn("preexisting", state["services"]["weather"]["helpers"])
        self.run_cli("create", "storage", ok=False)

    def test_bind_missing_anchor_is_atomic(self):
        self.run_cli("create", "Weather")
        app = self.root / "src/backend/AppBackend.ts"
        app.write_text("export const notServices = {};\n")
        result = self.run_cli("bind", "Weather", ok=False)
        self.assertIn("unique canonical services-object anchor", result["error"])
        self.assertFalse((self.root / "src/backend/services/__skipo/registry.ts").exists())
        state = json.loads((self.root / ".skipo/service-scaffolds.json").read_text())
        self.assertFalse(state["services"]["weather"]["bound"])


if __name__ == "__main__":
    unittest.main()
