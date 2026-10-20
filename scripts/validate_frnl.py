#!/usr/bin/env python3
"""Run the canonical Frnl workspace validator against the current Skipo app."""

from pathlib import Path
import subprocess
import sys


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    result = subprocess.run(
        ["pnpm", "dlx", "--yes", "@ultrst-armada/frnlts-cli@0.1.0", "validate"],
        cwd=root,
        check=False,
    )
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
