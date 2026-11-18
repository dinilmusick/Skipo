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

    def test_missing_project_does_not_pretend_to_pass(self):
        with tempfile.TemporaryDirectory() as folder:
            result = guard.check(Path(folder))
        self.assertFalse(result["ok"])


if __name__ == "__main__":
    unittest.main()
