from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "scripts" / "scaffold_app_structure.py"
CONFIG = ROOT / "scaffolds" / "vite" / "skipo.config.json"


def test_canonical_vite_template_has_ordered_luth_endpoints():
    obj = json.loads(CONFIG.read_text(encoding="utf-8"))
    assert obj["version"] == 1
    assert obj["authentication"]["luthUrls"] == [
        "https://luth.blueprint-ninjastudios.workers.dev"
    ]


def test_generic_generator_creates_root_auth_config_without_env(tmp_path):
    target = tmp_path / "GeneratedApp"
    result = subprocess.run(
        [sys.executable, str(GENERATOR), str(target), "--name", "GeneratedApp"],
        cwd=ROOT, text=True, capture_output=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    generated = target / "skipo.config.json"
    assert generated.is_file()
    assert json.loads(generated.read_text(encoding="utf-8")) == json.loads(
        CONFIG.read_text(encoding="utf-8")
    )
    new_url = "https://secondary.example.test"
    obj = json.loads(generated.read_text(encoding="utf-8"))
    obj["authentication"]["luthUrls"].append(new_url)
    generated.write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8")
    rerun = subprocess.run(
        [sys.executable, str(GENERATOR), str(target), "--name", "GeneratedApp"],
        cwd=ROOT, text=True, capture_output=True,
    )
    assert rerun.returncode == 0, rerun.stdout + rerun.stderr
    assert json.loads(generated.read_text(encoding="utf-8")) == obj
