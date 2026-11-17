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


def _framework_root(root: Path) -> bool:
    """The framework repo must not be evaluated as a generated application."""
    package = root / "package.json"
    if root != ENGINE.resolve() or not package.is_file():
        return False
    try:
        return json.loads(package.read_text(encoding="utf-8")).get("name") == "skipo"
    except (ValueError, OSError):
        return False


def assess(root: Path) -> dict[str, Any]:
    """Fail closed when a required analyzer or its evidence is unavailable."""
    root = Path(root).resolve()
    result: dict[str, Any] = {"lifecycle": list(STAGES), "root": str(root)}
    if _framework_root(root):
        # Application-only path and SDK rules do not apply to Skipo's source.
        # Validate the actual policy file/schema; do not pretend to have
        # semantically analyzed an application at the framework root.
        from skipo_policy import validate_policy
        try:
            validate_policy(load_policy())
            result["policy"] = {"state": "compliant", "scope": "framework-policy-schema"}
        except Exception as exc:
            result["policy"] = {"state": "blocked", "scope": "framework-policy-schema",
                                "errors": [str(exc)]}
        result["semantic"] = {"status": "not-applicable", "scope": "application-only"}
        try:
            result["environment"] = diagnose_environment(root)
        except Exception as exc:
            result["environment"] = {"ok": False, "errors": [str(exc)]}
        result["scope"] = "framework"
        result["blocked"] = result["policy"]["state"] != "compliant"
        result["compliant"] = (not result["blocked"] and result["environment"].get("ok") is True)
        return result
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
        result["semantic"].get("status") in ("ambiguous", "blocked")
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
    if _framework_root(Path(root).resolve()):
        try:
            maintenance = verify_maintenance(root, version)
            environment = verify_environment(root)
            return {"ok": bool(layers["compliant"] and maintenance.get("ok") and environment.get("ok")),
                    "architecture": layers, "maintenance": maintenance,
                    "environment": environment,
                    "scope": "framework-contract-only",
                    "unverified_integrations": ["live Luth OAuth", "Google Drive OAuth",
                                                "Backblaze B2", "persistent database"]}
        except Exception as exc:
            return {"ok": False, "architecture": layers,
                    "errors": ["Framework verification raised: " + str(exc)]}
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


def transaction_verify(root: Path, version: str) -> dict[str, Any]:
    """A repair must pass fresh independent checks before its journal is discarded.

    Full application certification (lockfile, build, live integrations) is a
    separate mandatory promotion gate, never inferred from a repair receipt.
    """
    from skipo_capabilities import verify as verify_capabilities
    layers = assess(root)
    try:
        capabilities = verify_capabilities(root)
        environment = verify_environment(root)
        dependency = verify_dependency_migrations(root, version)
    except Exception as exc:
        return {"ok": False, "architecture": layers, "errors": [str(exc)]}
    return {"ok": bool(layers["compliant"] and capabilities.get("ok") and
                       environment.get("ok") and dependency.get("ok")),
            "architecture": layers, "capabilities": capabilities,
            "environment": environment, "dependency_migrations": dependency,
            "live_integrations": "unverified"}
