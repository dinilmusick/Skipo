#!/usr/bin/env python3
"""
create_orchestration.py - Skipo Orchestrator Installer and Application-Specific Wrapper Generator.
Conforms to the Skipo Builder Package Composition Architecture:
- Discovers and installs canonical orchestrators directly from @kloks/orchestrations.
- Only generates a local application wrapper when explicitly requested (--wrapper).
- Never generates local orchestration trees duplicating Kloks functionality.
"""

from pathlib import Path
import argparse
import subprocess
import sys

HERE = Path(__file__).resolve().parent
SKIPO_ROOT = HERE.parent

def main():
    parser = argparse.ArgumentParser(description="Install orchestrator from @kloks/orchestrations or create an app wrapper")
    parser.add_argument("name", help="Orchestrator ID (e.g., orchestrator-a, orchestrator-b, audio-midi)")
    parser.add_argument("--wrapper", action="store_true", help="Generate an application-specific custom wrapper")
    parser.add_argument("--dry-run", action="store_true", help="Dry run without mutating source")
    parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")
    args = parser.parse_args()

    builder_script = HERE / "skipo_builder.py"
    cmd = ["python3", str(builder_script), "add", "orchestration", args.name]
    if args.dry_run:
        cmd.append("--dry-run")
    if args.json:
        cmd.append("--json")

    res = subprocess.run(cmd, cwd=str(SKIPO_ROOT))
    sys.exit(res.returncode)

if __name__ == "__main__":
    main()
