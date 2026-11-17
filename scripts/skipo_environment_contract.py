#!/usr/bin/env python3
"""Standalone, deterministic, fail-closed Skipo application environment governance."""
from __future__ import annotations

import json
import os
import re
import tempfile
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "architecture/environment/contract.json"
NAME = re.compile(r"^[A-Z][A-Z0-9_]*$")
ENV_FILE = re.compile(r"^\.env(?:[.-].*)?$", re.I)
ENV_ASSIGN = re.compile(r"^(\s*(?:export\s+)?)([A-Z][A-Z0-9_]*)(\s*=)(.*)$")
SHELL_ASSIGN = re.compile(r"^(\s*(?:export|env)\s+)([A-Z][A-Z0-9_]*)(\s*=)(.*)$")
KEY_ASSIGN = re.compile(r'''^(\s*["']?)([A-Z][A-Z0-9_]*)(["']?\s*[:=])(.*)$''')
REFS = (
    re.compile(r"\b(?:process\.env|import\.meta\.env)(?:\?\.|\.)([A-Z][A-Z0-9_]*)\b"),
    re.compile(r'''\b(?:process\.env|import\.meta\.env)(?:\?\.)?\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]'''),
    re.compile(r'''\bos\.environ(?:\.get)?\(\s*['"]([A-Z][A-Z0-9_]*)['"]'''),
    re.compile(r'''\bos\.environ\s*\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]'''),
    re.compile(r'''\b(?:os\.)?getenv\(\s*['"]([A-Z][A-Z0-9_]*)['"]'''),
    re.compile(r'''\$\{\{\s*(?:secrets|vars|env)\.([A-Z][A-Z0-9_]*)\s*\}\}'''),
)
def _code_at(line: str, offset: int) -> bool:
    """Conservatively ignore references embedded in quoted text or inline comments."""
    quote = None
    escaped = False
    i = 0
    while i < offset:
        ch = line[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
        elif ch in ("'", '"', "`"):
            quote = ch
        elif ch == "/" and i + 1 < len(line) and line[i + 1] in ("/", "*"):
            return False
        i += 1
    return quote is None


DOCUMENTS = {".md", ".mdx", ".txt"}
SHELL = {".sh", ".bash", ".zsh"}


def load_contract() -> dict[str, Any]:
    data = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    if data.get("schema_version") != 2:
        raise ValueError("Unsupported Skipo environment contract schema")
    canonical = data.get("canonical", {})
    required, optional = canonical.get("required"), canonical.get("optional")
    if not isinstance(required, list) or not isinstance(optional, list):
        raise ValueError("Canonical required and optional names must be lists")
    if set(required) != {"SYSTEM_DATABASE_URL", "APP_URL"} or set(optional) != {"SYSTEM_DATABASE_URL_2", "SYSTEM_DATABASE_URL_3"}:
        raise ValueError("Skipo application contract must contain exactly its four canonical names")
    all_names = required + optional
    groups = [data.get(k, {}) for k in ("deprecated_aliases", "runtime_platform", "internal_tooling")]
    if any(not isinstance(group, dict) for group in groups):
        raise ValueError("Environment classifications must be mappings")
    declared = set(all_names)
    for group in groups:
        for key in group:
            if not isinstance(key, str) or not NAME.fullmatch(key) or key in declared:
                raise ValueError(f"Invalid or conflicting environment classification: {key}")
            declared.add(key)
    for alias, spec in data["deprecated_aliases"].items():
        if not isinstance(spec, dict) or spec.get("target") not in all_names or not spec.get("reason"):
            raise ValueError(f"Invalid deprecated alias: {alias}")
    for category in ("runtime_platform", "internal_tooling"):
        if any(not isinstance(reason, str) or not reason.strip() for reason in data[category].values()):
            raise ValueError(f"Missing ownership rationale in {category}")
    locations = data.get("tooling_locations", [])
    if not isinstance(locations, list) or any(not isinstance(loc, str) or not loc.endswith("/") or ".." in loc for loc in locations):
        raise ValueError("Invalid tooling location registry")
    return data


def classify(name: str, contract: dict[str, Any] | None = None) -> str:
    contract = contract if contract is not None else load_contract()
    if name in contract["canonical"]["required"] or name in contract["canonical"]["optional"]:
        return "canonical"
    if name in contract["deprecated_aliases"]:
        return "known_deprecated_alias"
    if name in contract["runtime_platform"]:
        return "runtime_platform"
    if name in contract["internal_tooling"]:
        return "internal_tooling"
    return "undeclared_framework_configuration"


def _classification(name: str, rel: str, occurrence: str, contract: dict[str, Any]) -> str:
    category = classify(name, contract)
    # A user-managed .env declaration is always application configuration.
    # Platform process state and internal tooling inputs cannot be added here.
    if occurrence == "declaration" and ENV_FILE.fullmatch(Path(rel).name) and category in {"runtime_platform", "internal_tooling"}:
        return "undeclared_framework_configuration"
    if category == "internal_tooling" and not any(rel.startswith(loc) for loc in contract["tooling_locations"]):
        return "undeclared_framework_configuration"
    return category


def _relevant(rel: Path, contract: dict[str, Any]) -> bool:
    if any(part in contract["scan"]["ignored_directories"] for part in rel.parts[:-1]):
        return False
    if rel.as_posix() == "architecture/environment/contract.json":
        return False
    if ENV_FILE.fullmatch(rel.name):
        return True
    if rel.suffix.lower() not in contract["scan"]["extensions"]:
        return False
    if rel.suffix.lower() in DOCUMENTS:
        return any(p in {"docs", "documentation", ".github"} for p in rel.parts[:-1]) or rel.name.lower() in {"readme.md", "agents.md"}
    return True


def iter_configuration_files(root: Path):
    contract = load_contract()
    for folder, directories, filenames in os.walk(root, followlinks=False):
        directories[:] = sorted(d for d in directories if d not in contract["scan"]["ignored_directories"])
        for filename in sorted(filenames):
            path = Path(folder) / filename
            if _relevant(path.relative_to(root), contract):
                yield path


def _candidate_names(path: Path, source: str):
    """Yield (name, 1-based line, kind, value). Only recognized source syntax counts."""
    suffix = path.suffix.lower()
    is_env = bool(ENV_FILE.fullmatch(path.name))
    is_doc = suffix in DOCUMENTS
    is_yaml, is_toml, is_json = suffix in {".yaml", ".yml"}, suffix == ".toml", suffix in {".json", ".jsonc"}
    is_test_source = "tests" in path.parts and "fixtures" not in path.parts
    fenced, yaml_indent, toml_section, json_depth = False, None, False, None
    for line_no, line in enumerate(source.splitlines(), 1):
        stripped = line.strip()
        indent = len(line) - len(line.lstrip())
        if is_doc and stripped.startswith("```"):
            fenced = not fenced
            continue
        if not stripped or stripped.startswith(("#", "//", "*")):
            continue
        match = None
        if is_env or (is_doc and fenced):
            match = ENV_ASSIGN.match(line)
        elif suffix in SHELL:
            match = SHELL_ASSIGN.match(line)
        elif is_yaml:
            if re.match(r"^\s*(?:env|environment|vars)\s*:", line):
                yaml_indent = indent
            elif yaml_indent is not None:
                if indent <= yaml_indent:
                    yaml_indent = None
                else:
                    match = KEY_ASSIGN.match(line)
        elif is_toml:
            section = re.match(r"^\s*\[([^\]]+)\]", line)
            if section:
                key = section.group(1).strip().lower()
                toml_section = key in {"env", "environment", "vars"} or key.startswith(("env.", "environment.", "vars."))
            elif toml_section:
                match = KEY_ASSIGN.match(line)
        elif is_json:
            if json_depth is None:
                start = re.search(r'''["'](?:env|environment|vars)["']\s*:\s*\{''', line)
                if start:
                    json_depth = line.count("{") - line.count("}")
            else:
                match = KEY_ASSIGN.match(line)
                json_depth += line.count("{") - line.count("}")
            if json_depth is not None and json_depth <= 0:
                json_depth = None
        if match:
            yield match.group(2), line_no, "declaration", match.group(4).strip()
        if not is_test_source and (not is_doc or fenced):
            # Python generators contain literal TS code; `process.env` inside
            # a generated template is not a Python runtime environment read.
            # Scan the generated output itself when validating an application.
            patterns = REFS[2:] if suffix == ".py" else REFS
            for pattern in patterns:
                for ref in pattern.finditer(line):
                    if _code_at(line, ref.start()):
                        yield ref.group(1), line_no, "reference", None


def _scan(root: Path) -> tuple[list[dict[str, Any]], dict[str, str], int]:
    contract = load_contract()
    findings: list[dict[str, Any]] = []
    content: dict[str, str] = {}
    declared: set[str] = set()
    alias_declarations: set[str] = set()
    scanned = 0
    for path in iter_configuration_files(root):
        rel = path.relative_to(root).as_posix()
        scanned += 1
        if path.is_symlink():
            findings.append(dict(variable="<symlink>", classification="unsafe_path", path=rel, line=None,
                                 occurrence="file", target=None, reason="Configuration symlinks are not followed or repaired"))
            continue
        try:
            source = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as error:
            findings.append(dict(variable="<unreadable>", classification="unsafe_path", path=rel, line=None,
                                 occurrence="file", target=None, reason=type(error).__name__))
            continue
        content[rel] = source
        seen: dict[str, int] = {}
        for name, line, occurrence, _value in _candidate_names(path, source):
            category = _classification(name, rel, occurrence, contract)
            if occurrence == "declaration":
                declared.add(name)
                if category == "known_deprecated_alias":
                    alias_declarations.add(name)
                if ENV_FILE.fullmatch(path.name):
                    if name in seen:
                        findings.append(dict(variable=name, classification="duplicate_declaration", path=rel,
                                             line=line, occurrence=occurrence, target=None,
                                             reason=f"Duplicate declaration; first at line {seen[name]}"))
                    else:
                        seen[name] = line
            if category in {"canonical", "runtime_platform", "internal_tooling"}:
                continue
            spec = contract["deprecated_aliases"].get(name, {})
            findings.append(dict(variable=name, classification=category, path=rel, line=line,
                                 occurrence=occurrence, target=spec.get("target"),
                                 reason=spec.get("reason", "No application-owned exception exists")))
    for name in contract["canonical"]["required"]:
        if name not in declared:
            findings.append(dict(variable=name, classification="missing_required", path=".env.example",
                                 line=None, occurrence="required_declaration", target=None,
                                 reason="Required application variable not declared in the scanned configuration"))
    findings.sort(key=lambda x: (x["path"], x["line"] or 0, x["variable"], x["classification"], x["occurrence"]))
    # Preserve distinct syntax observations, but avoid duplicate matches of one expression.
    unique = {(f["path"], f["line"], f["variable"], f["classification"], f["occurrence"]): f for f in findings}
    return list(unique.values()), content, scanned


def diagnose(root: Path) -> dict[str, Any]:
    findings, _content, scanned = _scan(Path(root).resolve())
    return {"ok": not findings, "operation": "diagnose", "files_scanned": scanned, "findings": findings}


def _replace_recognized(source: str, path: Path, mapping: dict[str, str]) -> str:
    occurrences: dict[int, set[tuple[str, str]]] = defaultdict(set)
    for name, line, kind, _value in _candidate_names(path, source):
        if name in mapping:
            occurrences[line].add((name, kind))
    result = []
    for line_no, raw in enumerate(source.splitlines(keepends=True), 1):
        active = occurrences.get(line_no, set())
        line = raw
        declarations = {name for name, kind in active if kind == "declaration"}
        if declarations:
            pattern = ENV_ASSIGN if ENV_FILE.fullmatch(path.name) or path.suffix.lower() in DOCUMENTS else (
                SHELL_ASSIGN if path.suffix.lower() in SHELL else KEY_ASSIGN)
            match = pattern.match(line)
            if not match or match.group(2) not in declarations:
                raise ValueError(f"Unsafe or unsupported environment declaration at {path}:{line_no}")
            line = line[:match.start(2)] + mapping[match.group(2)] + line[match.end(2):]
        patterns = REFS[2:] if path.suffix.lower() == ".py" else REFS
        for pattern in patterns:
            line = pattern.sub(lambda m: m.group(0)[:m.start(1)-m.start(0)] + mapping.get(m.group(1), m.group(1)) + m.group(0)[m.end(1)-m.start(0):]
                               if (m.group(1), "reference") in active and _code_at(line, m.start()) else m.group(0), line)
        result.append(line)
    rewritten = "".join(result)
    if any(name in {x[0] for x in _candidate_names(path, rewritten)} for name in mapping):
        raise ValueError(f"Replacement left unmigrated environment aliases in {path}")
    return rewritten


def plan(root: Path) -> dict[str, Any]:
    root = Path(root).resolve()
    findings, contents, _scanned = _scan(root)
    contract = load_contract()
    blocked = [f for f in findings if f["classification"] in {
        "undeclared_framework_configuration", "unsafe_path", "duplicate_declaration"}]
    conflicts = []
    actions = []
    by_path: dict[str, set[str]] = defaultdict(set)
    for f in findings:
        if f["classification"] == "known_deprecated_alias":
            by_path[f["path"]].add(f["variable"])
    for rel, aliases in sorted(by_path.items()):
        path = root / rel
        source = contents.get(rel)
        if source is None:
            conflicts.append({"path": rel, "reason": "Source unavailable for safe planning"})
            continue
        declarations = [(name, value) for name, _line, kind, value in _candidate_names(path, source) if kind == "declaration"]
        declared_names = {name for name, _value in declarations}
        mapping = {alias: contract["deprecated_aliases"][alias]["target"] for alias in aliases}
        for alias, target in sorted(mapping.items()):
            vals = [value for name, value in declarations if name == alias]
            if target in declared_names or len(vals) > 1:
                conflicts.append({"path": rel, "variable": alias, "target": target,
                                  "reason": "Ambiguous or duplicate alias/target declarations; no value is guessed"})
                continue
            # Reject alias occurrences that cannot be replaced by the approved syntax parser.
            try:
                rewritten = _replace_recognized(source, path, {alias: target})
                if rewritten == source:
                    raise ValueError("No recognized syntactic replacement")
            except ValueError as error:
                conflicts.append({"path": rel, "variable": alias, "target": target, "reason": str(error)})
                continue
            actions.append({"action": "rename-variable", "path": rel, "from": alias, "to": target})
    for f in findings:
        if f["classification"] != "missing_required":
            continue
        target = f["variable"]
        migratable = any(a["to"] == target and any(n == a["from"] for n, _line, kind, _value in
                         _candidate_names(root / a["path"], contents[a["path"]]) if kind == "declaration")
                         for a in actions)
        if not migratable:
            blocked.append(f)
    return {"ok": not blocked and not conflicts, "operation": "plan", "actions": actions,
            "conflicts": conflicts, "blocked_findings": blocked, "findings": findings}


def _write_atomic(path: Path, data: bytes):
    descriptor, temp = tempfile.mkstemp(prefix=".skipo-env-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temp, path.stat().st_mode & 0o777)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def repair(root: Path, apply: bool = True) -> dict[str, Any]:
    root = Path(root).resolve()
    planned = plan(root)
    if not planned["ok"]:
        return {"ok": False, "operation": "repair", "applied": False, "actions": [],
                "conflicts": planned["conflicts"], "blocked_findings": planned["blocked_findings"]}
    actions = planned["actions"]
    if not apply:
        return {"ok": True, "operation": "repair", "applied": False, "actions": actions, "conflicts": []}
    mapped: dict[str, dict[str, str]] = defaultdict(dict)
    for action in actions:
        mapped[action["path"]][action["from"]] = action["to"]
    originals: dict[Path, bytes] = {}
    changes: dict[Path, bytes] = {}
    try:
        for rel, aliases in sorted(mapped.items()):
            path = root / rel
            if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root):
                raise ValueError(f"Unsafe repair path: {rel}")
            raw = path.read_bytes()
            updated = _replace_recognized(raw.decode("utf-8"), path, aliases).encode("utf-8")
            originals[path] = raw
            if raw != updated:
                changes[path] = updated
        # Before the first write, ensure every preflight source remains unchanged.
        for path, raw in originals.items():
            if path.is_symlink() or path.read_bytes() != raw:
                raise ValueError(f"Stale or unsafe repair plan: {path.relative_to(root)}")
        for path, updated in changes.items():
            _write_atomic(path, updated)
        verification = verify(root)
        if not verification["ok"]:
            raise ValueError("Post-repair environment verification failed")
    except (OSError, ValueError, UnicodeError) as error:
        rollback_errors = []
        for path, original in reversed(list(originals.items())):
            try:
                if not path.is_symlink() and path.read_bytes() != original:
                    _write_atomic(path, original)
            except OSError as rollback_error:
                rollback_errors.append({"path": str(path.relative_to(root)), "error": str(rollback_error)})
        return {"ok": False, "operation": "repair", "applied": False, "actions": actions,
                "conflicts": [{"reason": str(error)}], "blocked_findings": [],
                "rollback": {"ok": not rollback_errors, "errors": rollback_errors}}
    return {"ok": True, "operation": "repair", "applied": bool(changes), "actions": actions,
            "conflicts": [], "verification": verification}


def verify(root: Path) -> dict[str, Any]:
    diagnostic = diagnose(root)
    return {"ok": diagnostic["ok"], "operation": "verify", "files_scanned": diagnostic["files_scanned"],
            "findings": diagnostic["findings"],
            "errors": [f"{f['classification']}: {f['variable']} at {f['path']}:{f['line']}" for f in diagnostic["findings"]]}


def synchronize(root: Path) -> dict[str, Any]:
    return repair(root, apply=True)