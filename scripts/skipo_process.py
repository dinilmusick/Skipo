"""Portable, explicit executables for Skipo's child-process boundaries.

On Windows pnpm/npm/yarn are commonly installed as .cmd shims. Python's
shutil.which('pnpm') and subprocess.run(['pnpm', ...]) may report unavailable
although pnpm.cmd actually runs from the same user environment.
"""
from __future__ import annotations

import os
import shutil

PACKAGE_MANAGER_SHIMS = frozenset({"pnpm", "npm", "yarn", "npx"})


def platform_command(args: list[str], *, windows: bool | None = None) -> list[str]:
    if not args:
        raise ValueError("An executable command is required")
    is_windows = (os.name == "nt") if windows is None else windows
    executable = args[0]
    if is_windows and executable.lower() in PACKAGE_MANAGER_SHIMS:
        for suffix in (".cmd", ".exe"):
            resolved = shutil.which(executable + suffix)
            if resolved:
                return [resolved, *args[1:]]
    return list(args)
