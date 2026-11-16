#!/usr/bin/env python3
"""Canonical, fail-closed Skipo environment contract and migration engine."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "architecture" / "environment" / "contract.json"
ENV_NAME = re.compile(r"^[A-Z][A-Z0-9_]*$")
ENV_ASSIGN = re.compile(r"^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$")
KEY_ASSIGN = re.compile(r"""^\s*["']?([A-Z][A-Z0-9_]*)["']?\s*[:=]\s*(.*?)(?:,\s*)?$""")
REF_PATTERNS = (
    re.compile(r"""\bprocess\.env\.([A-Z][A-Z0-9_]*)"""),
    re.compile(r"""\bimport\.meta\.env\.([A-Z][A-Z0-9_]*)"""),
    re.compile(r"""\bos\.environ(?:\.get)?\(\s*['"]([A-Z][A-Z0-9_]*)['"]"""),
    re.compile(r"""\bos\.environ\s*\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]"""),
    re.compile(r"""\bos\.getenv\(\s*['"]([A-Z][A-Z0-9_]*)['"]"""),
    re.compile(r"""\bgetenv\(\s*['"]([A-Z][A-Z0-9_]*)['"]"""),
    re.compile(r"""\$\{\{\s*(?:secrets|vars|env)\.([A-Z][A-Z0-9_]*)\s*\}\}"""),
)
