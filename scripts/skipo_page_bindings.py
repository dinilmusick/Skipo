"""Restore app-declared integration points without replacing surrounding application code."""
from pathlib import Path
import re


def repair_bindings(root, page, bindings, writes):
    for binding in bindings:
        if binding["page"] != page:
            continue
        name = binding["name"]
        rel = Path(binding["path"])
        if not re.fullmatch(r"[a-z][a-z0-9-]*", name) or rel.is_absolute() or ".." in rel.parts:
            raise ValueError("Invalid page binding")
        target = root / rel
        if target.resolve() != target or not rel.parts or rel.parts[0] != "src" or rel.suffix not in {".tsx", ".ts"}:
            raise ValueError(f"Invalid binding target: {rel}")
        current = writes[target] if target in writes else target.read_text()
        start = f"// skipo:begin {name}\n"
        end = f"// skipo:end {name}\n"
        if current.count(start) != 1 or current.count(end) != 1:
            raise ValueError(f"{rel}: cannot identify {name} integration point")
        before, rest = current.split(start)
        if end not in rest:
            raise ValueError(f"{rel}: invalid {name} integration point")
        _, after = rest.split(end)
        desired = before + start + binding["source"].rstrip("\n") + "\n" + end + after
        if current != desired:
            writes[target] = desired
