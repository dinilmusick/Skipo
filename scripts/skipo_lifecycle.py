"""Read-only architecture and independent verification for the distributed Skipo CLI.

ATAX owns agent coordination; this module only inspects application snapshots.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from skipo_environment_contract import diagnose as diagnose_environment
from skipo_environment_contract import verify as verify_environment
from skipo_policy import evaluate, load_policy
from skipo_dependency_migrations import verify_dependency_migrations

ENGINE = Path(__file__).resolve().parents[1]
STAGES = ("inspect", "diagnose", "plan", "update", "repair", "sync", "verify")


def assess(root: Path) -> dict[str, Any]:
    """Fail closed when a required analyzer or its evidence is unavailable."""
    root = Path(root).resolve()
    result: dict[str, Any] = {"lifecycle": list(STAGES), "root": str(root)}
    try:
        result["policy"] = evaluate(root, load_policy())
    except Exception as exc:
        result["policy"] = {"state": "blocked", "diagnostics": [
            {"code": "SKP-POL-EXECUTION-FAILED", "message": str(exc)}]}
    try:
        proc = subprocess.run(
            ["node", str(ENGINE / "scripts" / "skipo_semantic_analyzer.cjs"),
             "--root", str(root), "--json"],
            capture_output=True, text=True, timeout=180, check=False,
        )
        output = json.loads(proc.stdout)
        if not isinstance(output, dict) or output.get("status") not in (
            "compliant", "violations", "ambiguous", "blocked"
        ):
            raise ValueError("Semantic analyzer returned invalid evidence")
        if proc.returncode and output["status"] == "compliant":
            raise ValueError("Semantic analyzer exited nonzero despite compliant report")
        result["semantic"] = output
    except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
        result["semantic"] = {"status": "blocked", "findings": [
            {"code": "SKP-SEM-EXECUTION-FAILED", "message": str(exc)}]}
    try:
        result["environment"] = diagnose_environment(root)
    except Exception as exc:
        result["environment"] = {"ok": False, "errors": [str(exc)]}
    result["blocked"] = (
        result["policy"].get("state") in ("ambiguous", "blocked") or
        result["semantic"].get("status") in ("ambiguous", "blocked", "violations")
    )
    result["compliant"] = (
        result["policy"].get("state") == "compliant" and
        result["semantic"].get("status") == "compliant" and
        result["environment"].get("ok") is True
    )
    return result


def independent_verify(root: Path, version: str) -> dict[str, Any]:
    """Recompute every outcome from disk; no caller-provided success assertions."""
    from skipo_maintenance import verify as verify_maintenance
    from skipo_capabilities import verify as verify_capabilities
    layers = assess(root)
    try:
        maintenance = verify_maintenance(root, version)
        capabilities = verify_capabilities(root)
        environment = verify_environment(root)
        dependency = verify_dependency_migrations(root, version)
    except Exception as exc:
        return {"ok": False, "architecture": layers,
                "errors": ["Independent verification raised: " + str(exc)]}
    return {
        "ok": bool(layers["compliant"] and maintenance.get("ok") and
                   capabilities.get("ok") and environment.get("ok") and
                   dependency.get("ok")),
        "architecture": layers,
        "maintenance": maintenance,
        "capabilities": capabilities,
        "environment": environment,
        "dependency_migrations": dependency,
        "unverified_integrations": ["live Luth OAuth", "Google Drive OAuth",
                                     "Backblaze B2", "persistent database"],
    }
