#!/usr/bin/env python3
"""Standalone, read-only Skipo architecture policy evaluator (Python stdlib only).

Public API: load_policy, load_exceptions, evaluate, PolicyError. No CLI imports.
"""
from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

DEFAULT_POLICY = Path(__file__).resolve().parents[1] / "architecture/policy/v1.json"
STATES = ("compliant", "repairable", "ambiguous", "blocked")
CATEGORIES = frozenset({"ownership", "structure", "extension", "generated", "implementation", "invariant"})
SEVERITIES = frozenset({"info", "warning", "error", "critical"})
CHECK_FIELDS = {
    "require_path": {"path"},
    "forbid_path": {"pattern"},
    "require_dependency": {"package"},
    "forbid_dependency": {"package"},
    "forbid_import": {"module", "paths"},
    "forbid_declaration": {"symbol", "paths"},
    "generated_asset": {"path", "manifest", "owner"},
    "extension_boundary": {"protected", "allowed"},
}
IMPORT_RE = re.compile(
    r"\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?[\"']([^\"']+)[\"']"
    r"|\b(?:import|require)\s*\(\s*[\"']([^\"']+)[\"']\s*\)"
)
DYNAMIC_RE = re.compile(r"\b(?:import|require)\s*\(\s*(?![\"'])[^)]+\)")
CODE_RE = re.compile(r"^SKP-POL-[A-Z0-9-]+$")
ID_RE = re.compile(r"^[a-z][a-z0-9-]*$")
SHA_RE = re.compile(r"^[a-f0-9]{64}$")
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")
PKG_RE = re.compile(r"^(?:@[a-z0-9-]+/)?(?:[a-z0-9._-]+|\*)(?:/\*)?$")
SYMBOL_RE = re.compile(r"^[A-Za-z_$][\w$]*$")


class PolicyError(ValueError):
    """Invalid or conflicting policy / exception definition; never evaluate partially."""


def _object_no_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise PolicyError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _read_json(path: Path) -> dict[str, Any]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_object_no_duplicates,
                         parse_constant=lambda v: (_ for _ in ()).throw(PolicyError(f"invalid JSON constant: {v}")))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise PolicyError(f"cannot read JSON {path}: {error}") from error
    if not isinstance(raw, dict):
        raise PolicyError("document must be a JSON object")
    return raw


def _fields(value: Any, allowed: set[str], required: set[str], where: str) -> None:
    if not isinstance(value, dict):
        raise PolicyError(f"{where}: expected object")
    if set(value) - allowed or required - set(value):
        raise PolicyError(f"{where}: missing {sorted(required - set(value))}; unexpected {sorted(set(value) - allowed)}")


def _string(value: Any, where: str, pattern: re.Pattern | None = None) -> str:
    if not isinstance(value, str) or not value.strip() or (pattern and not pattern.fullmatch(value)):
        raise PolicyError(f"{where}: invalid nonempty string")
    return value


def _path(value: Any, where: str, *, glob: bool = False) -> str:
    name = _string(value, where)
    parts = name.split("/")
    if (name.startswith("/") or "\\" in name or ":" in name or any(ord(c) < 32 for c in name)
            or any(p in ("", ".", "..") for p in parts)
            or (not glob and any(c in name for c in "*?[]"))):
        raise PolicyError(f"{where}: unsafe or noncanonical relative path")
    return name


def _paths(value: Any, where: str, *, glob: bool) -> list[str]:
    if not isinstance(value, list) or not value or len(value) != len(set(map(str, value))):
        raise PolicyError(f"{where}: expected nonempty unique array")
    return [_path(v, where, glob=glob) for v in value]


def _date(value: Any, where: str) -> dt.date:
    try:
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("ISO date required")
        return dt.date.fromisoformat(value)
    except ValueError as error:
        raise PolicyError(f"{where}: invalid date") from error


def _matches(path: str, pattern: str) -> bool:
    return fnmatch.fnmatchcase(path, pattern)


def validate_policy(policy: Any) -> dict[str, Any]:
    _fields(policy, {"schema_version", "policy_id", "policy_version", "owners", "rules"},
            {"schema_version", "policy_id", "policy_version", "owners", "rules"}, "policy")
    if type(policy["schema_version"]) is not int or policy["schema_version"] != 1:
        raise PolicyError("unsupported policy schema_version (expected 1)")
    _string(policy["policy_id"], "policy_id", ID_RE)
    _string(policy["policy_version"], "policy_version", VERSION_RE)
    if not isinstance(policy["owners"], dict) or not policy["owners"]:
        raise PolicyError("owners must be a nonempty object")
    for capability, owner in policy["owners"].items():
        _string(capability, "owner capability", ID_RE)
        _fields(owner, {"provider", "package", "contract"}, {"provider", "package", "contract"}, "owner")
        _string(owner["provider"], "owner provider")
        _string(owner["package"], "owner package", PKG_RE)
        _string(owner["contract"], "owner contract")
    rules = policy["rules"]
    if not isinstance(rules, list) or not rules:
        raise PolicyError("rules must be a nonempty array")
    ids, codes, signatures, required_paths, forbidden_paths, required_deps, forbidden_deps = (set() for _ in range(7))
    generated_paths = set()
    for rule in rules:
        _fields(rule, {"id", "code", "category", "severity", "on_violation", "description", "check", "evidence", "remediation", "verification"},
                {"id", "code", "category", "severity", "on_violation", "description", "check", "evidence", "remediation", "verification"}, "rule")
        rid = _string(rule["id"], "rule.id", ID_RE)
        code = _string(rule["code"], "rule.code", CODE_RE)
        if rid in ids or code in codes:
            raise PolicyError(f"duplicate rule id or diagnostic code: {rid} / {code}")
        ids.add(rid)
        codes.add(code)
        if (not isinstance(rule["category"], str) or rule["category"] not in CATEGORIES
                or not isinstance(rule["severity"], str) or rule["severity"] not in SEVERITIES):
            raise PolicyError(f"{rid}: unsupported category or severity")
        if not isinstance(rule["on_violation"], str) or rule["on_violation"] not in ("repairable", "ambiguous", "blocked"):
            raise PolicyError(f"{rid}: invalid on_violation")
        _string(rule["description"], f"{rid}.description")
        _string(rule["remediation"], f"{rid}.remediation")
        _fields(rule["evidence"], {"kind", "description"}, {"kind", "description"}, f"{rid}.evidence")
        _string(rule["evidence"]["kind"], f"{rid}.evidence.kind")
        _string(rule["evidence"]["description"], f"{rid}.evidence.description")
        _fields(rule["verification"], {"method", "independent", "required_evidence"},
                {"method", "independent", "required_evidence"}, f"{rid}.verification")
        if rule["verification"]["independent"] is not True:
            raise PolicyError(f"{rid}: independent verification is mandatory")
        _string(rule["verification"]["method"], f"{rid}.verification.method")
        _string(rule["verification"]["required_evidence"], f"{rid}.verification.required_evidence")
        check = rule["check"]
        if not isinstance(check, dict) or not isinstance(check.get("kind"), str) or check["kind"] not in CHECK_FIELDS:
            raise PolicyError(f"{rid}: unsupported or missing check.kind")
        kind = check["kind"]
        _fields(check, {"kind"} | CHECK_FIELDS[kind], {"kind"} | CHECK_FIELDS[kind], f"{rid}.check")
        if kind in ("require_path", "generated_asset"):
            _path(check["path"], f"{rid}.path")
        if kind == "forbid_path":
            _path(check["pattern"], f"{rid}.pattern", glob=True)
        if kind in ("require_dependency", "forbid_dependency"):
            _string(check["package"], f"{rid}.package", PKG_RE)
            if "*" in check["package"]:
                raise PolicyError(f"{rid}: dependency names cannot be globs")
        if kind == "forbid_import":
            _string(check["module"], f"{rid}.module", PKG_RE)
            _paths(check["paths"], f"{rid}.paths", glob=True)
        if kind == "forbid_declaration":
            _string(check["symbol"], f"{rid}.symbol", SYMBOL_RE)
            _paths(check["paths"], f"{rid}.paths", glob=True)
        if kind == "generated_asset":
            _path(check["manifest"], f"{rid}.manifest")
            _string(check["owner"], f"{rid}.owner")
            generated_paths.add(check["path"])
        if kind == "extension_boundary":
            _paths(check["protected"], f"{rid}.protected", glob=True)
            _paths(check["allowed"], f"{rid}.allowed", glob=True)
            if not all(any(_matches(p, x) or _matches(x, p) for p in check["protected"])
                       for x in check["allowed"]):
                raise PolicyError(f"{rid}: allowed extensions outside protected scope")
        signature = json.dumps(check, sort_keys=True, separators=(",", ":"))
        if signature in signatures:
            raise PolicyError(f"duplicate detection rule: {rid}")
        signatures.add(signature)
        if kind == "require_path": required_paths.add(check["path"])
        if kind == "forbid_path": forbidden_paths.add(check["pattern"])
        if kind == "require_dependency": required_deps.add(check["package"])
        if kind == "forbid_dependency": forbidden_deps.add(check["package"])
    if required_deps & forbidden_deps:
        raise PolicyError(f"conflicting dependency rules: {sorted(required_deps & forbidden_deps)}")
    for required in required_paths | generated_paths:
        if any(_matches(required, bad) for bad in forbidden_paths):
            raise PolicyError(f"path simultaneously required/generated and forbidden: {required}")
    return policy


def load_policy(path: str | Path = DEFAULT_POLICY) -> dict[str, Any]:
    return validate_policy(_read_json(Path(path)))


def validate_exceptions(payload: Any, policy: dict[str, Any]) -> list[dict[str, Any]]:
    validate_policy(policy)
    _fields(payload, {"schema_version", "policy_id", "policy_version", "exceptions"},
            {"schema_version", "policy_id", "policy_version", "exceptions"}, "exception document")
    if type(payload["schema_version"]) is not int or payload["schema_version"] != 1 or payload["policy_id"] != policy["policy_id"] or payload["policy_version"] != policy["policy_version"]:
        raise PolicyError("exception document schema/policy mismatch")
    entries = payload["exceptions"]
    if not isinstance(entries, list):
        raise PolicyError("exceptions must be an array")
    rules = {r["id"]: r for r in policy["rules"]}
    seen_ids, seen_scopes = set(), set()
    for entry in entries:
        _fields(entry, {"id", "rule_id", "path", "rationale", "approved_by", "ticket", "issued", "expires"},
                {"id", "rule_id", "path", "rationale", "approved_by", "ticket", "issued", "expires"}, "exception")
        key = _string(entry["id"], "exception.id", ID_RE)
        rid = _string(entry["rule_id"], "exception.rule_id", ID_RE)
        path = _path(entry["path"], "exception.path")
        if rid not in rules or key in seen_ids or (rid, path) in seen_scopes:
            raise PolicyError("exception references unknown rule, duplicates id, or overlaps same target")
        seen_ids.add(key)
        seen_scopes.add((rid, path))
        check = rules[rid]["check"]
        kind = check["kind"]
        if rules[rid]["severity"] == "critical" or rules[rid]["on_violation"] != "repairable":
            raise PolicyError(f"exception {key}: cannot override critical / nonrepairable rule")
        target = (check.get("path") if kind in ("require_path", "generated_asset") else
                  "package.json" if kind.endswith("dependency") else None)
        if target is not None and path != target:
            raise PolicyError(f"exception {key}: outside rule target")
        if kind == "forbid_path" and not _matches(path, check["pattern"]):
            raise PolicyError(f"exception {key}: outside forbidden path")
        if kind in ("forbid_import", "forbid_declaration") and not any(_matches(path, p) for p in check["paths"]):
            raise PolicyError(f"exception {key}: outside scan paths")
        if kind == "extension_boundary" and not any(_matches(path, p) for p in check["protected"]):
            raise PolicyError(f"exception {key}: outside protected paths")
        if len(_string(entry["rationale"], "exception.rationale")) < 20:
            raise PolicyError("exception rationale must have at least 20 characters")
        _string(entry["approved_by"], "exception.approved_by")
        if not re.fullmatch(r"https://[^\s]+", _string(entry["ticket"], "exception.ticket")):
            raise PolicyError("exception ticket must be an HTTPS evidence link")
        issued = _date(entry["issued"], "exception.issued")
        expires = _date(entry["expires"], "exception.expires")
        if expires < issued or expires > issued + dt.timedelta(days=90):
            raise PolicyError("exception lifetime must be between 0 and 90 days")
    return entries


def load_exceptions(path: str | Path, policy: dict[str, Any]) -> list[dict[str, Any]]:
    return validate_exceptions(_read_json(Path(path)), policy)


def _finding(rule: dict[str, Any], state: str, path: str, evidence: dict[str, Any],
             message: str, line: int | None = None, exception: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "code": rule["code"], "rule_id": rule["id"], "category": rule["category"],
        "severity": rule["severity"], "state": state, "path": path, "line": line,
        "message": message, "evidence": evidence, "remediation": rule["remediation"],
        "verification": {**rule["verification"], "status": ("exception_active" if exception is not None else
                                                            "not_required" if state == "compliant" else "pending")},
        "exception": (None if exception is None else {"id": exception["id"],
                      "rationale": exception["rationale"], "expires": exception["expires"], "ticket": exception["ticket"]}),
    }


def _meta(code: str, state: str, message: str, path: str = "") -> dict[str, Any]:
    return {"code": code, "rule_id": None, "category": "policy", "severity": "critical",
            "state": state, "path": path, "line": None, "message": message,
            "evidence": {"kind": "policy_validation", "path": path},
            "remediation": "Resolve the unsafe or invalid input; rerun the evaluator.",
            "verification": {"method": "independent_rescan", "independent": True,
                             "required_evidence": "Fresh successful policy evaluation", "status": "pending"},
            "exception": None}


def _inventory(root: Path) -> tuple[list[str], list[str]]:
    """Do not follow symlinks or silently skip unreadable directories."""
    files, unsafe = [], []
    skipped = {".git", "node_modules", ".venv", "dist", "build"}

    def traversal_error(error: OSError) -> None:
        raise PolicyError(f"cannot fully enumerate repository: {error}") from error

    for directory, dirs, names in os.walk(root, topdown=True, followlinks=False, onerror=traversal_error):
        rel_dir = Path(directory).relative_to(root)
        descend = []
        for name in sorted(dirs):
            path = Path(directory) / name
            if name in skipped:
                continue
            if path.is_symlink():
                unsafe.append((rel_dir / name).as_posix())
            else:
                descend.append(name)
        dirs[:] = descend
        for name in sorted(names):
            path = Path(directory) / name
            rel = (rel_dir / name).as_posix()
            if path.is_symlink() or not path.is_file():
                unsafe.append(rel)
            else:
                files.append(rel)
    return sorted(files), sorted(unsafe)


def _scan_source(root: Path, path: str) -> str:
    return (root / path).read_text(encoding="utf-8")


def _package(root: Path) -> dict[str, Any]:
    pkg = _read_json(root / "package.json")
    for field in ("dependencies", "devDependencies", "optionalDependencies"):
        if field in pkg and (not isinstance(pkg[field], dict) or any(not isinstance(v, str) for v in pkg[field].values())):
            raise PolicyError(f"invalid {field} in package.json")
    return pkg


def _evaluate_rule(rule: dict[str, Any], root: Path, files: list[str]) -> list[dict[str, Any]]:
    check, state = rule["check"], rule["on_violation"]
    kind = check["kind"]
    output = []

    def record(path: str, evidence: dict[str, Any], message: str, line: int | None = None,
               override: str | None = None) -> None:
        output.append(_finding(rule, override or state, path, evidence, message, line))

    if kind == "require_path":
        p = check["path"]
        if p not in files:
            record(p, {"kind": "missing_path", "expected": p}, "Required canonical asset is missing")
    elif kind == "forbid_path":
        for p in files:
            if _matches(p, check["pattern"]):
                record(p, {"kind": "forbidden_path", "pattern": check["pattern"]}, "Forbidden architectural path is present")
    elif kind in ("require_dependency", "forbid_dependency"):
        try:
            pkg = _package(root)
            dependencies = {name: version for section in ("dependencies", "devDependencies", "optionalDependencies")
                            for name, version in pkg.get(section, {}).items()}
            found = dependencies.get(check["package"])
            violation = (found is None if kind == "require_dependency" else found is not None)
            if violation:
                record("package.json", {"kind": "dependency", "package": check["package"],
                        "observed_version": found}, "Canonical dependency requirement violated")
        except PolicyError as error:
            record("package.json", {"kind": "unreadable_manifest", "detail": str(error)},
                   "Cannot prove dependency boundary", override="ambiguous")
    elif kind in ("forbid_import", "forbid_declaration"):
        for p in files:
            if not any(_matches(p, pattern) for pattern in check["paths"]):
                continue
            try:
                content = _scan_source(root, p)
            except (OSError, UnicodeError) as error:
                record(p, {"kind": "unreadable_source", "detail": type(error).__name__},
                       "Cannot inspect source", override="ambiguous")
                continue
            if kind == "forbid_import":
                for match in IMPORT_RE.finditer(content):
                    module = match.group(1) or match.group(2)
                    if _matches(module, check["module"]):
                        record(p, {"kind": "source_import", "module": module, "match": match.group(0)},
                               "Provider SDK imported outside canonical owner", content.count("\n", 0, match.start()) + 1)
                for match in DYNAMIC_RE.finditer(content):
                    inner = match.group(0).split("(", 1)[1].lstrip()
                    if inner.startswith(("\"", "'")):
                        continue
                    record(p, {"kind": "computed_import", "match": match.group(0)},
                           "Computed import cannot be statically proven safe", content.count("\n", 0, match.start()) + 1,
                           override="ambiguous")
            else:
                declaration = re.compile(r"\bexport\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+" + re.escape(check["symbol"]) + r"\b")
                for match in declaration.finditer(content):
                    record(p, {"kind": "local_declaration", "symbol": check["symbol"], "match": match.group(0)},
                           "Canonical capability redeclared locally", content.count("\n", 0, match.start()) + 1)
    elif kind == "generated_asset":
        p, manifest = check["path"], check["manifest"]
        if p not in files:
            return output  # optional capability: no generated artifact to audit
        try:
            data = _read_json(root / manifest)
            _fields(data, {"schema_version", "assets"}, {"schema_version", "assets"}, "generated manifest")
            if type(data["schema_version"]) is not int or data["schema_version"] != 1 or not isinstance(data["assets"], dict):
                raise PolicyError("unsupported generated asset manifest schema")
            entry = data["assets"].get(p)
            _fields(entry, {"owner", "sha256"}, {"owner", "sha256"}, "generated asset entry")
            _string(entry["sha256"], "sha256", SHA_RE)
            if entry["owner"] != check["owner"]:
                raise PolicyError("generated asset owner mismatch")
            actual = hashlib.sha256((root / p).read_bytes()).hexdigest()
            if actual != entry["sha256"]:
                record(p, {"kind": "generated_hash_mismatch", "expected_sha256": entry["sha256"],
                           "actual_sha256": actual, "owner": entry["owner"]}, "Generated asset changed outside canonical generation")
        except (PolicyError, OSError, UnicodeError) as error:
            record(p, {"kind": "unverifiable_generated_asset", "manifest": manifest, "detail": str(error)},
                   "Generated asset provenance is not verifiable", override="ambiguous")
    elif kind == "extension_boundary":
        for p in files:
            if any(_matches(p, pattern) for pattern in check["protected"]) and not any(
                    _matches(p, pattern) for pattern in check["allowed"]):
                record(p, {"kind": "unapproved_extension", "protected": check["protected"]},
                       "Custom extension placed inside canonical protected surface")
    return output


def evaluate(root: str | Path, policy: dict[str, Any], *,
             exceptions: list[dict[str, Any]] | None = None,
             as_of: dt.date | None = None) -> dict[str, Any]:
    """Deterministically inspect a snapshot; never mutate files or claim verification."""
    validate_policy(policy)
    active_date = as_of if as_of is not None else dt.datetime.now(dt.timezone.utc).date()
    if not isinstance(active_date, dt.date):
        raise PolicyError("as_of must be a date")
    exception_entries = validate_exceptions({"schema_version": 1, "policy_id": policy["policy_id"],
                                             "policy_version": policy["policy_version"],
                                             "exceptions": exceptions if exceptions is not None else []}, policy)
    root = Path(root)
    if not root.is_dir() or root.is_symlink():
        raise PolicyError("root must be an existing nonsymlink directory")
    files, symlinks = _inventory(root)
    diagnostics = [_meta("SKP-POL-UNSAFE-PATH", "blocked", "Symlink prevents complete policy inspection", p)
                   for p in symlinks]
    for exception in exception_entries:
        if _date(exception["expires"], "expires") < active_date:
            diagnostics.append(_meta("SKP-POL-EXCEPTION-EXPIRED", "blocked",
                                     f"Exception {exception['id']} expired on {exception['expires']}", exception["path"]))
    for rule in sorted(policy["rules"], key=lambda r: r["id"]):
        for finding in _evaluate_rule(rule, root, files):
            matching = [e for e in exception_entries if e["rule_id"] == rule["id"]
                        and e["path"] == finding["path"] and _date(e["issued"], "issued") <= active_date
                        <= _date(e["expires"], "expires")]
            if matching and finding["state"] == "repairable":
                finding = _finding(rule, "compliant", finding["path"], finding["evidence"],
                                   "Scoped, approved exception (underlying violation retained)",
                                   finding["line"], matching[0])
            diagnostics.append(finding)
    rank = {state: index for index, state in enumerate(STATES)}
    diagnostics.sort(key=lambda d: (d["rule_id"] or "", d["path"], d["line"] or 0, d["code"], d["message"]))
    state = max((d["state"] for d in diagnostics), key=rank.get, default="compliant")
    digest = hashlib.sha256(json.dumps(policy, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {"schema_version": 1, "policy_id": policy["policy_id"], "policy_version": policy["policy_version"],
            "policy_sha256": digest, "state": state, "as_of": active_date.isoformat(),
            "rules_evaluated": len(policy["rules"]), "diagnostics": diagnostics,
            "counts": {name: sum(d["state"] == name for d in diagnostics) for name in STATES}}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only deterministic Skipo architecture-policy evaluator")
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--exceptions", type=Path, default=None)
    parser.add_argument("--as-of", default=None, help="UTC ISO date; fixture/reproducibility override")
    args = parser.parse_args(argv)
    try:
        policy = load_policy(args.policy)
        exceptions = load_exceptions(args.exceptions, policy) if args.exceptions else []
        result = evaluate(args.root, policy, exceptions=exceptions,
                          as_of=_date(args.as_of, "as_of") if args.as_of else None)
    except (PolicyError, OSError, ValueError) as error:
        code = "SKP-POL-ROOT-INVALID" if str(error).startswith("root must") else "SKP-POL-POLICY-INVALID"
        result = {"schema_version": 1, "state": "blocked", "diagnostics": [
            _meta(code, "blocked", str(error))]}
    print(json.dumps(result, sort_keys=True, indent=2))
    return 0 if result["state"] == "compliant" else 2 if result["state"] == "repairable" else 3


if __name__ == "__main__":
    sys.exit(main())
