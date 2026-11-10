import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "checklists"))
spec = importlib.util.spec_from_file_location("module_architecture", ROOT / "checklists" / "24_module_architecture.py")
validator = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = validator
spec.loader.exec_module(validator)

CONTRACT = """export interface SkipoModule {}\nexport interface SkipoModuleHost {}\nexport interface SkipoModuleManifest {}\nexport interface ModuleBackendFacade {}\nexport interface ModuleUIExport {}\nexport type packageDependencies = string[];\n"""


class ModuleArchitectureTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="skipo_module_arch_"))
        (self.tmp / "src/modules").mkdir(parents=True)
        self.write("src/modules/module-contract.ts", CONTRACT)
        self.write("src/modules/catalog/module.json", json.dumps({
            "id": "catalog", "name": "Catalog", "version": "1.0.0",
            "capabilities": ["catalog.read"], "dependencies": [], "packageDependencies": []
        }))
        self.write("src/modules/catalog/module.ts", """import type { SkipoModule, SkipoModuleHost } from '../module-contract.js';
export const module: SkipoModule = {
  manifest: { id: 'catalog', name: 'Catalog', version: '1.0.0', capabilities: ['catalog.read'], dependencies: [], packageDependencies: [] },
  activate(host: SkipoModuleHost) { void host.backend.invoke('catalog.read', {}); },
  createUI(host: SkipoModuleHost) { return { routes: [] }; },
};
""")
        self.write("src/modules/catalog/standalone.ts", """import { createStandaloneModuleHost } from '../module-contract.js';
import { module } from './module.js';
export async function runStandalone() { const host = createStandaloneModuleHost({ 'catalog.read': () => [] }); await module.activate(host); }
""")
        self.write("src/modules/catalog/module.test.ts", "// module-local isolated host test\n")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def write(self, path, content):
        target = self.tmp / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return target

    def violations(self):
        return validator.validate_module_architecture(self.tmp).violations

    def rules(self):
        return {v.rule_id for v in self.violations()}

    def test_canonical_module_passes_all_architecture_rules(self):
        result = validator.validate_module_architecture(self.tmp)
        self.assertTrue(result.passed, [v.to_dict() for v in result.violations])

    def test_module_manifest_must_declare_capabilities_and_dependencies_even_when_empty(self):
        self.write("src/modules/catalog/module.json", json.dumps({"id": "catalog", "name": "Catalog", "version": "1"}))
        self.assertIn("24.5-explicit-field", self.rules())

    def test_module_entrypoint_must_use_canonical_contract_and_ui_export(self):
        self.write("src/modules/catalog/module.ts", "export const module = { activate() {} };")
        rules = self.rules()
        self.assertIn("24.6-contract-use", rules)
        self.assertIn("24.7-ui-export", rules)
        self.assertIn("24.8-host-contract", rules)

    def test_parent_backend_implementation_import_is_rejected(self):
        self.write("src/backend/internal.ts", "export const secret = 1;")
        self.write("src/modules/catalog/module.ts", "import { secret } from '../../backend/internal.js';\nexport const module = secret;")
        self.assertIn("24.11-parent-import", self.rules())

    def test_parent_backend_facade_bypass_is_rejected(self):
        self.write("src/modules/catalog/module.ts", "import { BackendFacade } from '../../backend/BackendFacade.js';\nexport const module = BackendFacade;")
        rules = self.rules()
        self.assertIn("24.11-parent-import", rules)
        self.assertIn("24.13-host-infrastructure-bypass", rules)

    def test_direct_http_backend_access_is_rejected(self):
        self.write("src/modules/catalog/module.ts", "export const module = { run: () => fetch('/api/private') };")
        self.assertIn("24.14-direct-backend-access", self.rules())

    def test_direct_host_bottom_bar_manipulation_is_rejected(self):
        self.write("src/modules/catalog/module.ts", "export const module = { update: (bottomBar) => bottomBar.setItems([]) };")
        self.assertIn("24.13-host-infrastructure-bypass", self.rules())

    def test_external_dependencies_must_be_declared(self):
        self.write("src/modules/catalog/module.ts", "import React from 'react';\nexport const module = React;")
        self.assertIn("24.12-explicit-package-dependency", self.rules())

    def test_capability_invocation_must_be_declared(self):
        self.write("src/modules/catalog/module.ts", "import type { SkipoModule, SkipoModuleHost } from '../module-contract.js';\nexport const module: SkipoModule = { manifest: {}, activate(host: SkipoModuleHost) { void host.backend.invoke('catalog.delete', {}); }, createUI(host: SkipoModuleHost) { return { routes: [] }; } };")
        self.assertIn("24.15-undeclared-capability", self.rules())

    def test_alias_import_into_parent_backend_is_rejected(self):
        self.write("src/modules/catalog/module.ts", "import { secret } from '@/backend/internal';\nexport const module = secret;")
        self.assertIn("24.11-parent-import", self.rules())

    def test_module_outside_src_modules_is_rejected(self):
        self.write("src/features/rogue/module.json", '{"id":"rogue"}')
        self.assertIn("24.2-location", self.rules())

    def test_standalone_entrypoint_is_required_and_uses_standalone_host(self):
        self.write("src/modules/catalog/standalone.ts", "export function runStandalone() {}")
        self.assertIn("24.9-standalone-host", self.rules())

    def test_module_local_test_is_required(self):
        (self.tmp / "src/modules/catalog/module.test.ts").unlink()
        self.assertIn("24.10-independent-test", self.rules())

    def test_contract_file_must_define_required_contract_surfaces(self):
        self.write("src/modules/module-contract.ts", "export interface SkipoModule {}")
        self.assertIn("24.1-contract-incomplete", self.rules())


if __name__ == "__main__":
    unittest.main()
