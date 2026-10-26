#!/usr/bin/env python3
import shutil
import tempfile
import unittest
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "aspect_22",
    ROOT / "checklists" / "22_import_direction_governance.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
validate_import_direction = MODULE.validate_import_direction


class ImportDirectionTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="skipo_import_direction_"))
        for directory in (
            "src/frontend",
            "src/backend",
            "src/libraries",
        ):
            (self.root / directory).mkdir(parents=True, exist_ok=True)
        (self.root / "src/backend/index.ts").write_text(
            "export { BackendFacade } from './BackendFacade.js';\n",
            encoding="utf-8",
        )
        (self.root / "src/backend/BackendFacade.ts").write_text(
            "export class BackendFacade {}\n",
            encoding="utf-8",
        )
        (self.root / "src/libraries/domain.ts").write_text(
            "export type Domain = { id: string };\n",
            encoding="utf-8",
        )

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def write(self, path, content):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def assert_rule(self, source, expected_rule):
        result = validate_import_direction(self.root)
        self.assertFalse(result.passed)
        self.assertIn(expected_rule, [v.rule_id for v in result.violations])

    def test_frontend_to_shared_libraries_is_allowed(self):
        self.write(
            "src/frontend/page.ts",
            "import { Domain } from '../libraries/domain.js';\nexport const value: Domain = { id: '1' };\n",
        )
        self.assertTrue(validate_import_direction(self.root).passed)

    def test_frontend_to_public_backend_barrel_is_allowed(self):
        self.write(
            "src/frontend/page.ts",
            "import { BackendFacade } from '../backend/index.js';\nexport const facade = BackendFacade;\n",
        )
        self.assertTrue(validate_import_direction(self.root).passed)

    def test_frontend_to_backend_internal_is_rejected(self):
        self.write(
            "src/frontend/page.ts",
            "import { BackendFacade } from '../backend/BackendFacade.js';\nexport const facade = BackendFacade;\n",
        )
        self.assert_rule(self.root, "22.1-forbidden-import-direction")

    def test_backend_to_frontend_is_rejected(self):
        self.write(
            "src/backend/service.ts",
            "import { Page } from '../frontend/pages/home/page.js';\nexport const value = Page;\n",
        )
        self.assert_rule(self.root, "22.1-forbidden-import-direction")

    def test_libraries_to_frontend_is_rejected(self):
        self.write(
            "src/libraries/domain.ts",
            "import { Page } from '../frontend/pages/home/page.js';\nexport const value = Page;\n",
        )
        self.assert_rule(self.root, "22.1-forbidden-import-direction")

    def test_libraries_to_backend_is_rejected(self):
        self.write(
            "src/libraries/domain.ts",
            "import { BackendFacade } from '../backend/index.js';\nexport const value = BackendFacade;\n",
        )
        self.assert_rule(self.root, "22.1-forbidden-import-direction")

    def test_backend_to_libraries_is_allowed(self):
        self.write(
            "src/backend/service.ts",
            "import { Domain } from '../libraries/domain.js';\nexport const value: Domain = { id: '1' };\n",
        )
        self.assertTrue(validate_import_direction(self.root).passed)

    def test_libraries_to_libraries_is_allowed(self):
        self.write(
            "src/libraries/consumer.ts",
            "import { Domain } from './domain.js';\nexport const value: Domain = { id: '1' };\n",
        )
        self.assertTrue(validate_import_direction(self.root).passed)


if __name__ == "__main__":
    unittest.main()
