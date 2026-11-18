"""Regression tests for categorized check and warned, timed Skipo cleanup."""
import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import skipo_guardrails as guard


class GuardrailTests(unittest.TestCase):
    def project(self, root):
        (root / "package.json").write_text('{"name":"test-app","scripts":{}}', encoding="utf-8")

    def test_readonly_check_groups_syntax_errors_and_leaves_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.project(root)
            file = root / "invalid.py"
            before = b"def broken(:\n  return 1\n"
            file.write_bytes(before)
            with patch.object(guard, "_architecture", return_value=[]):
                result = guard.check(root)
            self.assertFalse(result["ok"])
            syntax = next(s for s in result["sections"] if s["category"] == "syntax")
            self.assertEqual(syntax["status"], "fail")
            self.assertEqual(syntax["findings"][0]["code"], "PYTHON_SYNTAX")
            self.assertEqual(syntax["findings"][0]["path"], "invalid.py")
            self.assertEqual(file.read_bytes(), before)
            self.assertEqual(result["summary"]["errors"], 1)

    def test_check_rejects_mutating_lint_script(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "package.json").write_text(json.dumps(
                {"name":"test","scripts":{"lint":"eslint . --fix"}}), encoding="utf-8")
            with patch.object(guard, "_architecture", return_value=[]):
                result = guard.check(root)
            lint = next(s for s in result["sections"] if s["category"] == "lint")
            self.assertEqual(lint["status"], "blocked")
            self.assertEqual(lint["findings"][0]["code"], "SKIPO_MUTATING_LINTER")

    def test_compiler_findings_keep_file_line_and_code(self):
        items = guard._parse_tool_findings(
            "types", "src/example.ts(7,12): error TS2322: Type is incompatible")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["code"], "TS2322")
        self.assertEqual(items[0]["path"], "src/example.ts")
        self.assertEqual(items[0]["line"], 7)

    def test_noninteractive_check_preserves_legacy_validator_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.project(root)
            sections = [guard._section("constraints", [], details={
                "profile": "application", "aspects": [{"aspect_id": "aspect_01", "passed": True}],
                "overall_passed": True, "total_errors": 0, "total_warnings": 0})]
            with patch.object(guard, "_architecture", return_value=sections):
                result = guard.check(root)
            self.assertEqual(result["profile"], "application")
            self.assertEqual(result["aspects"][0]["aspect_id"], "aspect_01")
            self.assertIn("overall_passed", result)
            self.assertFalse(result["overall_passed"])  # missing lint/typecheck is not a full pass

    def test_timeout_chooses_aggressive_clean(self):
        self.assertEqual(guard._decision(0), "clean")
        self.assertEqual(guard._decision(0, "cancel"), "cancel")

    def test_agent_can_cancel_with_stdin(self):
        with patch.object(guard.sys, "stdin", io.StringIO("fix\n")):
            with patch.object(guard.select, "select", return_value=([guard.sys.stdin], [], [])):
                self.assertEqual(guard._decision(10), "cancel")

    def preview(self, plan_id="same"):
        return {"ok": True, "operation": "clean", "root": "/dummy",
                "plan_id": plan_id, "actions": [{
                    "action": "retire", "path": "src/frontend/rogue.ts",
                    "existing_bytes_at_risk": 20}],
                "summary": {"total": 1, "retire": 1},
                "ownership": {"managed": "owned", "custom_frontend": "tabs", "custom_backend": "services"},
                "applied": False}

    def test_cancel_never_mutates(self):
        with patch.object(guard, "clean_preview", return_value=self.preview()):
            with patch.object(guard, "_decision", return_value="cancel"):
                with patch("skipo_canonical_shell.reconcile_shell") as rewrite:
                    result = guard.clean(Path("/dummy"), timeout=0)
        self.assertTrue(result["ok"])
        self.assertEqual(result["decision"], "cancelled")
        self.assertFalse(result["applied"])
        rewrite.assert_not_called()

    def test_stale_plan_aborts_without_mutating(self):
        with patch.object(guard, "clean_preview", side_effect=[self.preview(), self.preview("changed")]):
            with patch("skipo_canonical_shell.reconcile_shell") as rewrite:
                result = guard.clean(Path("/dummy"), approve=True)
        self.assertFalse(result["ok"])
        self.assertEqual(result["decision"], "stale")
        rewrite.assert_not_called()

    def test_timeout_clean_runs_existing_transactional_shell_reconciler(self):
        with patch.object(guard, "clean_preview", return_value=self.preview()):
            with patch("skipo_canonical_shell.reconcile_shell", return_value={
                "ok": True, "applied": True,
                "verification": {"ok": True, "idempotent": True}}) as rewrite:
                result = guard.clean(Path("/dummy"), timeout=0)
        self.assertTrue(result["ok"])
        self.assertTrue(result["applied"])
        self.assertEqual(result["decision"], "applied")
        rewrite.assert_called_once_with(Path("/dummy"), apply=True)

    def test_preflight_prints_every_retirement(self):
        report = self.preview()
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            guard.print_clean_preview(report)
        self.assertIn("src/frontend/rogue.ts", stdout.getvalue())
        self.assertIn("20", stdout.getvalue())

    def test_full_check_exposes_all_real_validator_aspects(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "src/frontend/components").mkdir(parents=True)
            (root / "src/backend").mkdir(parents=True)
            (root / "src/frontend/index.ts").write_text("export const a = 1;\n")
            (root / "src/backend/index.ts").write_text("export const b = 2;\n")
            (root / "package-lock.json").write_text('{"name":"test-app","lockfileVersion":3,"packages":{}}')
            (root / "sanity.js").write_text("export const ok = true;\n")
            (root / "package.json").write_text(json.dumps({"name":"test-app","scripts":{
                "lint":"node --check sanity.js", "typecheck":"node --check sanity.js"}}))
            (root / ".env.example").write_text("SYSTEM_DATABASE_URL=postgresql://localhost/db\nAPP_URL=http://localhost:3000\n")
            (root / ".skipo").mkdir()
            (root / ".skipo/project.json").write_text('{"framework":"skipo","skipo_version":"1.3.0"}')
            (root / ".skipo/capabilities.json").write_text('{"schemaVersion":1,"installed":{},"generated":[]}')
            (root / ".skipo/dependencies.json").write_text("{}")
            (root / ".skipo/migration-state.json").write_text(
                '{"schemaVersion":1,"applied":["1.1.0-capability-composition"],"pending":[]}')
            report = guard.check(root)
            self.assertEqual(report["profile"], "application", report)
            self.assertEqual(len(report["aspects"]), 26,
                             "Never omit any canonical checklist runner")
            self.assertEqual(len({a["aspect_id"] for a in report["aspects"]}), 26)

    def test_missing_project_does_not_pretend_to_pass(self):
        with tempfile.TemporaryDirectory() as folder:
            result = guard.check(Path(folder))
        self.assertFalse(result["ok"])


    def test_check_does_not_execute_arbitrary_lint_package_script(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            marker = root / "unwanted.txt"
            (root / "package.json").write_text(json.dumps({"name": "test", "scripts": {
                "lint": "node -e \"require('fs').writeFileSync('unwanted.txt', 'bad')\""
            }}), encoding="utf-8")
            with patch.object(guard, "_architecture", return_value=[]):
                result = guard.check(root)
            lint = next(s for s in result["sections"] if s["category"] == "lint")
            self.assertEqual(lint["status"], "not-run")
            self.assertFalse(marker.exists(), "Read-only check must never run npm scripts")

    def test_check_does_not_execute_arbitrary_typecheck_package_script(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "package.json").write_text(json.dumps({"name": "test", "scripts": {
                "typecheck": "node -e \"require('fs').writeFileSync('unwanted.txt', 'bad')\""
            }}), encoding="utf-8")
            (root / "tsconfig.json").write_text("{}", encoding="utf-8")
            with patch.object(guard, "_architecture", return_value=[]):
                result = guard.check(root)
            types = next(s for s in result["sections"] if s["category"] == "types")
            self.assertEqual(types["status"], "blocked")
            self.assertFalse((root / "unwanted.txt").exists())

    def test_lint_uses_only_fixed_nonfixing_local_eslint_command(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "package.json").write_text(json.dumps({"scripts": {
                "lint": "eslint ."
            }}), encoding="utf-8")
            eslint = root / "node_modules" / ".bin" / "eslint"
            eslint.parent.mkdir(parents=True)
            eslint.write_text("#!/bin/sh\\nexit 0\\n", encoding="utf-8")
            self.assertEqual(guard._safe_lint_command(root),
                             [str(eslint), ".", "--no-fix"])
            (root / "package.json").write_text(json.dumps({"scripts": {
                "lint": "eslint . --fix"
            }}), encoding="utf-8")
            self.assertEqual(guard._safe_lint_command(root), [])


if __name__ == "__main__":
    unittest.main()
