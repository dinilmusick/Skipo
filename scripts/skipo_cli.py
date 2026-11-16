#!/usr/bin/env python3
"""Skipo framework CLI: create, inspect, check, fix, update and test Skipo applications."""
from __future__ import annotations
import argparse, json, shutil, subprocess, sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCAFFOLDS = ROOT / "scaffolds"
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]

def run(cmd: list[str], cwd: Path) -> int:
    return subprocess.run(cmd, cwd=str(cwd)).returncode

def manifest(root: Path) -> dict[str, Any]:
    p = root / ".skipo" / "project.json"
    if p.exists():
        try: return json.loads(p.read_text(encoding="utf-8"))
        except Exception: pass
    return {}

def is_project(root: Path) -> bool:
    return (root / ".skipo" / "project.json").exists()

def create_project(name: str, target: Path, framework: str, force: bool) -> int:
    source = SCAFFOLDS / framework
    if not source.is_dir():
        print(json.dumps({"ok": False, "error": f"Unknown scaffold: {framework}"})); return 2
    if target.exists() and any(target.iterdir()) and not force:
        print(json.dumps({"ok": False, "error": f"Target is not empty: {target}"})); return 2
    target.mkdir(parents=True, exist_ok=True)
    for item in source.iterdir():
        if item.name in {".git", ".skipo"}: continue
        dest = target / item.name
        if dest.exists() and force:
            shutil.rmtree(dest) if dest.is_dir() else dest.unlink()
        shutil.copytree(item, dest) if item.is_dir() else shutil.copy2(item, dest)
    for p in target.rglob("*"):
        if p.is_file() and p.suffix in {".json",".md",".ts",".tsx",".js",".mjs",".toml",".yml",".yaml"}:
            try: text = p.read_text(encoding="utf-8")
            except UnicodeDecodeError: continue
            p.write_text(text.replace("MyApp", name).replace("my-app", name.lower().replace(" ", "-")), encoding="utf-8")
    d = target / ".skipo"; d.mkdir(exist_ok=True)
    (d / "project.json").write_text(json.dumps({"framework":"skipo","scaffold":framework,"skipo_version":VERSION,"generated_by":"skipo"}, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"ok":True,"operation":"create","name":name,"framework":framework,"target":str(target),"skipo_version":VERSION}))
    return 0

def inspect_project(root: Path) -> int:
    data = manifest(root)
    print(json.dumps({"project":str(root),"skipo_project":bool(data),**data}, indent=2)); return 0

def check_project(root: Path) -> int:
    if not is_project(root):
        print(json.dumps({"ok":False,"error":"Not a recognized Skipo project."})); return 2
    result = subprocess.run([sys.executable,str(ROOT/"checklists/full_system_validator.py"),str(root),"--json"], cwd=str(ROOT), capture_output=True, text=True)
    try: payload = json.loads(result.stdout)
    except json.JSONDecodeError: payload={"overall_passed":result.returncode==0,"stdout":result.stdout,"stderr":result.stderr}
    payload["skipo_cli_version"]=VERSION
    print(json.dumps(payload, indent=2)); return result.returncode

def fix_project(root: Path) -> int:
    if not is_project(root): return 2
    result = run([sys.executable,str(ROOT/"assistant.py"),"mutate","all",str(root)], ROOT)
    return result if result else check_project(root)

def update_project(root: Path) -> int:
    if not is_project(root): return 2
    p=root/".skipo/project.json"; data=manifest(root); previous=data.get("skipo_version")
    data["skipo_version"]=VERSION; data["updated_by"]="skipo"
    p.write_text(json.dumps(data,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"ok":True,"operation":"update","from_version":previous,"to_version":VERSION},indent=2))
    return check_project(root)

def test_project(root: Path) -> int:
    if not is_project(root): return 2
    pkg=root/"package.json"
    if not pkg.exists(): return 2
    scripts=json.loads(pkg.read_text(encoding="utf-8")).get("scripts",{})
    runner = "pnpm" if (root / "pnpm-lock.yaml").exists() or "pnpm@" in pkg.read_text(encoding="utf-8") else ("yarn" if (root / "yarn.lock").exists() else "npm")
    commands=[]
    if "typecheck" in scripts: commands.append([runner,"run","typecheck"])
    elif "lint" in scripts: commands.append([runner,"run","lint"])
    if "build" in scripts: commands.append([runner,"run","build"])
    for cmd in commands:
        if run(cmd,root): return 1
    return check_project(root)

def main() -> int:
    parser=argparse.ArgumentParser(prog="skipo",description="Skipo project generator and architectural framework.")
    sub=parser.add_subparsers(dest="command",required=True)
    p=sub.add_parser("create"); p.add_argument("name"); p.add_argument("target",nargs="?",default=None); p.add_argument("--framework",choices=["nextjs","vite"],default="vite"); p.add_argument("--force",action="store_true")
    for cmd in ["inspect","check","fix","update","test"]:
        q=sub.add_parser(cmd); q.add_argument("target",nargs="?",default=".")
    a=parser.parse_args()
    if a.command=="create": return create_project(a.name,Path(a.target or a.name).resolve(),a.framework,a.force)
    return {"inspect":inspect_project,"check":check_project,"fix":fix_project,"update":update_project,"test":test_project}[a.command](Path(a.target).resolve())

if __name__=="__main__": raise SystemExit(main())
