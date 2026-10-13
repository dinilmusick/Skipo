#!/usr/bin/env python3
"""
boundary_fixtures.test.py - Negative Boundary Test Fixtures for Contract Boundary Enforcement.

Executes and verifies that each prohibited architectural pattern is properly caught and rejected:
- FIXTURE_01: INTERNAL_EXPORT_LEAK (Consumer imports internal-only export)
- FIXTURE_02: LOCAL_SHIM (Consumer declares local duplicate of canonical type)
- FIXTURE_03: MISSING_REQUIRED_SYMBOL (Consumer contract requires symbol absent from installed version)
- FIXTURE_04: UNAUTHORIZED_SYMBOL_EXPORT (Package exports symbol not in approved public contract)
- FIXTURE_05: RAW_SOURCE_IMPORT (Consumer imports from ../src/ or /src/ of another package)
- FIXTURE_06: FILESYSTEM_ESCAPE (tsconfig or vite references sibling directory directly)
- FIXTURE_07: DISAGGREGATED_PACKAGE_NAME (package.json declares @kloks/state-graph instead of @ultrst-armada/kloks)
"""

import json
import shutil
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKIPO_ROOT = HERE.parent

import sys
sys.path.insert(0, str(SKIPO_ROOT / "checklists"))
import importlib.util
spec = importlib.util.spec_from_file_location(
    "aspect_15",
    SKIPO_ROOT / "checklists" / "15_contract_boundary_enforcement.py"
)
aspect_15 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(aspect_15)
validate_contract_boundaries = aspect_15.validate_contract_boundaries

class BoundaryFixturesTest(unittest.TestCase):

    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp(prefix="skipo_fixture_"))

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_fixture_01_internal_export_leak(self):
        """FIXTURE_01: Consumer imports internal-only export -> REJECTED."""
        code_file = self.temp_dir / "src" / "frontend" / "Consumer.ts"
        code_file.parent.mkdir(parents=True, exist_ok=True)
        code_file.write_text(
            "import { SecretInternalState } from '@ultrst-armada/kloks/internal/secret';\n"
            "export const data = SecretInternalState;\n",
            encoding="utf-8"
        )

        res = validate_contract_boundaries(self.temp_dir)
        self.assertFalse(res.passed, "FIXTURE_01 must fail contract boundary check")
        rule_ids = [v.rule_id for v in res.violations]
        self.assertIn("15.1-internal-import-banned", rule_ids)

    def test_fixture_02_local_shim(self):
        """FIXTURE_02: Consumer declares local duplicate of canonical type -> REJECTED."""
        code_file = self.temp_dir / "src" / "frontend" / "LocalShim.ts"
        code_file.parent.mkdir(parents=True, exist_ok=True)
        code_file.write_text(
            "export interface GraphEntityMetadata {\n"
            "  id: string;\n"
            "  customField: boolean;\n"
            "}\n",
            encoding="utf-8"
        )

        res = validate_contract_boundaries(self.temp_dir)
        self.assertFalse(res.passed, "FIXTURE_02 must fail duplicate declaration check")
        rule_ids = [v.rule_id for v in res.violations]
        self.assertIn("15.2-local-canonical-shim-detected", rule_ids)

    def test_fixture_03_missing_required_symbol(self):
        """FIXTURE_03: Consumer contract requires symbol absent from installed version -> REJECTED."""
        contract_dir = self.temp_dir / ".skipo" / "contracts"
        contract_dir.mkdir(parents=True, exist_ok=True)
        req_file = contract_dir / "kloks.json"
        req_file.write_text(json.dumps({
            "requiredSymbols": ["RequiredSymbolAbsentFromLibrary"],
            "publicSymbols": ["ExistingValidSymbolA", "ExistingValidSymbolB"]
        }), encoding="utf-8")

        res = validate_contract_boundaries(self.temp_dir)
        self.assertFalse(res.passed, "FIXTURE_03 must fail compatibility check")
        rule_ids = [v.rule_id for v in res.violations]
        self.assertIn("15.4-incompatible-contract-requirement", rule_ids)

    def test_fixture_04_unauthorized_symbol_export(self):
        """FIXTURE_04: Package exports symbol not in approved public contract -> REJECTED."""
        contract_dir = self.temp_dir / ".skipo" / "contracts"
        contract_dir.mkdir(parents=True, exist_ok=True)
        req_file = contract_dir / "floks.json"
        req_file.write_text(json.dumps({
            "approvedExports": ["ButtonProps", "PanelProps"],
            "exportedSymbols": ["ButtonProps", "PanelProps", "UnauthorizedInternalHackedSymbol"]
        }), encoding="utf-8")

        res = validate_contract_boundaries(self.temp_dir)
        self.assertFalse(res.passed, "FIXTURE_04 must fail export authorization check")
        rule_ids = [v.rule_id for v in res.violations]
        self.assertIn("15.5-unauthorized-symbol-export", rule_ids)

    def test_fixture_05_raw_source_import(self):
        """FIXTURE_05: Consumer imports from ../src/ or /src/ of another package -> REJECTED."""
        code_file = self.temp_dir / "src" / "frontend" / "RawSourceConsumer.ts"
        code_file.parent.mkdir(parents=True, exist_ok=True)
        code_file.write_text(
            "import { TopToolbar } from '../Floks/packages/ui/src/index';\n"
            "export const header = TopToolbar;\n",
            encoding="utf-8"
        )

        res = validate_contract_boundaries(self.temp_dir)
        self.assertFalse(res.passed, "FIXTURE_05 must fail import boundary check")
        rule_ids = [v.rule_id for v in res.violations]
        self.assertIn("15.6-raw-src-import-banned", rule_ids)

    def test_fixture_06_filesystem_escape(self):
        """FIXTURE_06: tsconfig or vite references sibling directory directly -> REJECTED."""
        tsconfig = self.temp_dir / "tsconfig.json"
        tsconfig.write_text(json.dumps({
            "compilerOptions": {
                "paths": {
                    "@ultrst-armada/floks/*": ["../Floks/packages/*/dist"]
                }
            }
        }), encoding="utf-8")

        res = validate_contract_boundaries(self.temp_dir)
        self.assertFalse(res.passed, "FIXTURE_06 must fail encapsulation check")
        rule_ids = [v.rule_id for v in res.violations]
        self.assertIn("15.7-filesystem-escape-detected", rule_ids)

    def test_fixture_07_disaggregated_package_name(self):
        """FIXTURE_07: package.json declares @kloks/state-graph instead of @ultrst-armada/kloks -> REJECTED."""
        pkg_json = self.temp_dir / "package.json"
        pkg_json.write_text(json.dumps({
            "name": "consumer-app",
            "dependencies": {
                "@kloks/state-graph": "^1.0.0"
            }
        }), encoding="utf-8")

        res = validate_contract_boundaries(self.temp_dir)
        self.assertFalse(res.passed, "FIXTURE_07 must fail naming check")
        rule_ids = [v.rule_id for v in res.violations]
        self.assertIn("15.8-disaggregated-package-name-detected", rule_ids)

    def test_positive_canonical_consumer_passes(self):
        """Positive control: valid consumer using public @ultrst-armada/kloks passes with 0 violations."""
        pkg_json = self.temp_dir / "package.json"
        pkg_json.write_text(json.dumps({
            "name": "valid-app",
            "dependencies": {
                "@ultrst-armada/kloks": "^1.0.0",
                "@ultrst-armada/floks": "^1.1.0"
            }
        }), encoding="utf-8")

        code_file = self.temp_dir / "src" / "frontend" / "ValidApp.ts"
        code_file.parent.mkdir(parents=True, exist_ok=True)
        code_file.write_text(
            "import { AudioHardwareServiceFacade } from '@ultrst-armada/kloks/audio-midi';\n"
            "export const facade = AudioHardwareServiceFacade;\n",
            encoding="utf-8"
        )

        res = validate_contract_boundaries(self.temp_dir)
        self.assertTrue(res.passed, f"Positive control should pass, got violations: {res.violations}")
        self.assertEqual(len(res.violations), 0)

if __name__ == "__main__":
    unittest.main()
