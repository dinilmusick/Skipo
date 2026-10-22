#!/usr/bin/env python3
"""Skipo local KLOKS/FLOKS development-session manager."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / ".skipo" / "ecosystem.json"
LIB_ROOT = ROOT / ".skipo" / "libraries"
LIBS = {
    "kloks": {"repo": "dinilmusick/Kloks", "package": "@ultrst-armada/kloks", "path": LIB_ROOT / "kloks"},
    "floks": {"repo": "dinilmusick/Floks", "package": "@ultrst-armada/floks", "path": LIB_ROOT / "floks"},
}


def run(args: list[str], cwd: Path = ROOT, check: bool = True) -> str:
    p = subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=False)
    if check and p.returncode:
        raise RuntimeError(p.stderr.strip() or p.stdout.strip() or "command failed")
    return p.stdout.strip()


def app_repo() -> str:
    remote = run(["git", "config", "--get", "remote.origin.url"])
    m = re.search(r"github\.com[:/]([^/]+/[^/.]+)(?:\.git)?$", remote)
    if not m:
        raise RuntimeError("Skipo app must have a GitHub origin.")
    return m.group(1)


def load_state() -> dict[str, Any]:
    return json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}


def save_state(state: dict[str, Any]) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def package_data() -> tuple[Path, dict[str, Any]]:
    path = ROOT / "package.json"
    return path, json.loads(path.read_text(encoding="utf-8"))


def init_state() -> dict[str, Any]:
    _, pkg = package_data()
    deps = pkg.setdefault("dependencies", {})
    dev_deps = pkg.setdefault("devDependencies", {})
    state = {
        "schemaVersion": 1,
        "appRepository": app_repo(),
        "appBranch": run(["git", "branch", "--show-current"]),
        "librariesRoot": str(LIB_ROOT.relative_to(ROOT)),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "libraries": {
            k: {
                "repository": v["repo"],
                "package": v["package"],
                "originalSpec": deps.get(v["package"]),
                "originalDevSpec": dev_deps.get(v["package"]),
                "localSpec": f"file:{LIB_ROOT.relative_to(ROOT) / k}",
            }
            for k, v in LIBS.items()
        },
    }
    save_state(state)
    return state


def hydrate_repo(key: str, state: dict[str, Any]) -> None:
    spec = LIBS[key]
    path = spec["path"]

    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        run(["git", "clone", f"https://github.com/{spec['repo']}.git", str(path)])
    else:
        if run(["git", "status", "--porcelain"], cwd=path, check=False):
            raise RuntimeError(f"Refusing to hydrate dirty {key} workspace; commit or clean it first.")
        run(["git", "fetch", "origin"], cwd=path)
        run(["git", "checkout", "main"], cwd=path)
        run(["git", "pull", "--ff-only", "origin", "main"], cwd=path)

    session = state.setdefault(
        "sessionId", datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    )
    slug = re.sub(r"[^a-z0-9-]+", "-", state["appRepository"].lower()).strip("-")
    branch = f"skipo/{slug}/{session}"
    existing = run(
        ["git", "rev-parse", "--verify", f"refs/heads/{branch}"],
        cwd=path,
        check=False,
    )
    if existing:
        run(["git", "checkout", branch], cwd=path)
    else:
        run(["git", "checkout", "-b", branch, "origin/main"], cwd=path)
    state["libraries"][key]["branch"] = branch


def set_local_dependencies(state: dict[str, Any]) -> None:
    path, pkg = package_data()
    deps = pkg.setdefault("dependencies", {})
    dev_deps = pkg.setdefault("devDependencies", {})
    for key, spec in LIBS.items():
        package_name = spec["package"]
        deps[package_name] = state["libraries"][key]["localSpec"]
        dev_deps.pop(package_name, None)
    path.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")
    run(["pnpm", "install", "--no-frozen-lockfile"])


def hydrate(target: str) -> dict[str, Any]:
    state = load_state() or init_state()
    for key in LIBS:
        if target in ("all", key):
            hydrate_repo(key, state)
    set_local_dependencies(state)
    save_state(state)
    return status()


def status() -> dict[str, Any]:
    state = load_state()
    result = {
        "initialized": bool(state),
        "appRepository": state.get("appRepository"),
        "appBranch": run(["git", "branch", "--show-current"], check=False),
        "appDirty": bool(run(["git", "status", "--porcelain"], check=False)),
        "libraries": {},
    }
    for key, spec in LIBS.items():
        if spec["path"].exists():
            result["libraries"][key] = {
                "path": str(spec["path"].relative_to(ROOT)),
                "branch": run(["git", "branch", "--show-current"], cwd=spec["path"], check=False),
                "dirty": bool(run(["git", "status", "--porcelain"], cwd=spec["path"], check=False)),
            }
        else:
            result["libraries"][key] = {
                "path": str(spec["path"].relative_to(ROOT)),
                "hydrated": False,
            }
    return result


def push_app(state: dict[str, Any]) -> str | None:
    if not run(["git", "status", "--porcelain"], check=False):
        return None
    branch = run(["git", "branch", "--show-current"])
    if branch in ("", "main", "master"):
        raise RuntimeError("Refusing to push app session changes from main/master.")
    run(["git", "add", "-A"])
    run(["git", "commit", "-m", "chore: persist downstream ecosystem development session"])
    run(["git", "push", "-u", "origin", branch])
    return run(["git", "rev-parse", "HEAD"])


def create_pr(key: str, state: dict[str, Any]) -> dict[str, Any] | None:
    spec, path = LIBS[key], LIBS[key]["path"]
    if not path.exists() or not run(["git", "status", "--porcelain"], cwd=path, check=False):
        return None
    if not state.get("appCommit"):
        raise RuntimeError("Cannot create library provenance PR before the originating app commit is recorded.")

    run(["git", "add", "-A"], cwd=path)
    run(["git", "commit", "-m", f"feat: downstream update from {state['appRepository']}"], cwd=path)
    branch = state["libraries"][key]["branch"]
    run(["git", "push", "-u", "origin", branch], cwd=path)

    marker = {
        "schemaVersion": 1,
        "appRepository": state["appRepository"],
        "appBranch": state["appBranch"],
        "appCommit": state["appCommit"],
        "sessionId": state["sessionId"],
        "targetLibrary": key.upper(),
        "targetPackage": spec["package"],
        "targetRepository": spec["repo"],
        "libraryBranch": branch,
    }
    body = (
        "## Skipo downstream library update\n\n"
        "Produced by an actively validated Skipo application session.\n\n"
        "<!-- skipo-ecosystem-promotion:v1\n"
        + json.dumps(marker, separators=(",", ":"))
        + "\n-->\n\n"
        "Krusbl uses this marker to identify the originating application, "
        "validate the library change, publish the package, and reconcile the app.\n"
    )
    pr = run(
        [
            "gh",
            "pr",
            "create",
            "--repo",
            spec["repo"],
            "--base",
            "main",
            "--head",
            branch,
            "--title",
            f"feat: downstream update from {state['appRepository']}",
            "--body",
            body,
        ],
        cwd=path,
    )
    return {"library": key, "branch": branch, "pr": pr}


def end_session() -> dict[str, Any]:
    state = load_state()
    if not state:
        raise RuntimeError("No ecosystem session exists; hydrate KLOKS/FLOKS first.")
    state["appBranch"] = run(["git", "branch", "--show-current"])
    state["appCommit"] = push_app(state) or run(["git", "rev-parse", "HEAD"])
    save_state(state)
    prs = [x for k in LIBS if (x := create_pr(k, state))]
    return {"appCommit": state["appCommit"], "prs": prs}


def cleanup() -> dict[str, Any]:
    state = load_state()
    if not state:
        return {"removed": []}
    if run(["git", "status", "--porcelain"], check=False):
        raise RuntimeError("Refusing ecosystem cleanup while the application workspace is dirty.")
    for key, spec in LIBS.items():
        if spec["path"].exists() and run(["git", "status", "--porcelain"], cwd=spec["path"], check=False):
            raise RuntimeError(f"Refusing cleanup of dirty {key} workspace; commit or clean it first.")

    path, pkg = package_data()
    deps = pkg.setdefault("dependencies", {})
    dev_deps = pkg.setdefault("devDependencies", {})
    for key, spec in LIBS.items():
        package_name = spec["package"]
        original = state["libraries"][key].get("originalSpec")
        original_dev = state["libraries"][key].get("originalDevSpec")
        if original is not None:
            deps[package_name] = original
        else:
            deps.pop(package_name, None)
        if original_dev is not None:
            dev_deps[package_name] = original_dev
        else:
            dev_deps.pop(package_name, None)

    path.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")
    run(["pnpm", "install", "--no-frozen-lockfile"])

    removed = []
    for spec in LIBS.values():
        if spec["path"].exists():
            shutil.rmtree(spec["path"])
            removed.append(str(spec["path"].relative_to(ROOT)))
    STATE.unlink(missing_ok=True)
    return {"removed": removed}


def main() -> None:
    p = argparse.ArgumentParser(description="Skipo KLOKS/FLOKS local development cycle")
    s = p.add_subparsers(dest="command", required=True)
    s.add_parser("init")
    h = s.add_parser("hydrate")
    h.add_argument("target", choices=["kloks", "floks", "all"], nargs="?", default="all")
    s.add_parser("status")
    s.add_parser("end-session")
    s.add_parser("cleanup")
    a = p.parse_args()

    if a.command == "init":
        result = init_state()
    elif a.command == "hydrate":
        result = hydrate(a.target)
    elif a.command == "status":
        result = status()
    elif a.command == "end-session":
        result = end_session()
    else:
        result = cleanup()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
