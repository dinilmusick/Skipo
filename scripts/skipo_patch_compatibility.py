"""Conservative compatibility for explicitly published same-series patch upgrades.

Canonical capability dependencies are minimum provider API baselines. We accept
only exact semver patch increments in the same major and minor series. Range
widening, pre-releases, downgrades, and new minor/major versions still require
the canonical migration/release process.
"""
import re

_VERSION = re.compile(r"^(\^)?(\d+)\.(\d+)\.(\d+)$")

def compatible_patch_version(actual: str | None, required: str | None) -> bool:
    if not isinstance(actual, str) or not isinstance(required, str):
        return False
    if actual == required:
        return bool(_VERSION.fullmatch(actual))
    a, r = _VERSION.fullmatch(actual), _VERSION.fullmatch(required)
    if not a or not r:
        return False
    a_range, r_range = a.group(1), r.group(1)
    # A broad caret spec is never allowed to replace a pinned canonical API.
    if a_range and not r_range:
        return False
    a_major, a_minor, a_patch = map(int, a.groups()[1:])
    r_major, r_minor, r_patch = map(int, r.groups()[1:])
    return ((a_major, a_minor) == (r_major, r_minor)
            and a_patch >= r_patch)
