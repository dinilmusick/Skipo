"""Cross-OS subprocess and macOS system-root alias contracts for the packaged Skipo CLI."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from skipo_process import platform_command
from skipo_cli import _is_trusted_macos_root_alias


class PortableCliProcessTests(unittest.TestCase):
    def test_windows_prefers_installed_pnpm_cmd_shim(self):
        with patch("skipo_process.shutil.which", side_effect=lambda path: "C:\\tools\\pnpm.cmd" if path == "pnpm.cmd" else None):
            self.assertEqual(platform_command(["pnpm", "run", "test"], windows=True),
                             ["C:\\tools\\pnpm.cmd", "run", "test"])

    def test_windows_missing_shim_does_not_fake_installed_executable(self):
        with patch("skipo_process.shutil.which", return_value=None):
            self.assertEqual(platform_command(["pnpm", "--version"], windows=True),
                             ["pnpm", "--version"])

    def test_unrelated_executables_and_non_windows_stay_unchanged(self):
        self.assertEqual(platform_command(["git", "status"], windows=True), ["git", "status"])
        self.assertEqual(platform_command(["pnpm", "install"], windows=False), ["pnpm", "install"])

    def test_empty_process_command_fails_closed(self):
        with self.assertRaises(ValueError):
            platform_command([])

    def test_only_actual_stock_macos_aliases_are_trusted(self):
        self.assertFalse(_is_trusted_macos_root_alias(ROOT))
        self.assertFalse(_is_trusted_macos_root_alias(Path("/var/untrusted")))
        if sys.platform == "darwin" and Path("/var").is_symlink():
            self.assertTrue(_is_trusted_macos_root_alias(Path("/var")))
        else:
            self.assertFalse(_is_trusted_macos_root_alias(Path("/var")))


if __name__ == "__main__":
    unittest.main()
