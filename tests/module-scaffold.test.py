from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def test_canonical_app_scaffold_recognizes_modules_directory():
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / "DemoApp"
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "scaffold_app_structure.py"), str(target), "--name", "DemoApp"],
            cwd=ROOT, capture_output=True, text=True,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        readme = target / "src" / "modules" / "README.md"
        assert readme.is_file()
        assert "complete" in readme.read_text(encoding="utf-8").lower()
        assert (target / "src" / "frontend").is_dir()
        assert (target / "src" / "backend").is_dir()
        assert (target / "src" / "libraries").is_dir()

        # Fresh apps expose one Fetch application and one canonical build command.
        assert (target / "src" / "app.ts").is_file()
        assert "export async function fetch" in (target / "src" / "app.ts").read_text(encoding="utf-8")
        providers = __import__("json").loads((target / "skipo.providers.json").read_text(encoding="utf-8"))
        assert providers["application"] == {"entry": "src/app.ts", "protocol": "fetch"}
        assert set(providers["providers"]) == {"cloudflare", "vercel", "node"}
        package = __import__("json").loads((target / "package.json").read_text(encoding="utf-8"))
        assert package["scripts"]["build"] == "node scripts/skipo-build.mjs"
        assert "build:fullstack" not in package["scripts"]
        assert "build:api" not in package["scripts"]
        assert (target / "src/providers/cloudflare.ts").is_file()
        assert (target / "src/providers/vercel.ts").is_file()
        assert (target / "src/providers/node.ts").is_file()

        # The scaffold must not rewrite the canonical ecosystem dependency versions.
        dependencies = package["dependencies"]
        assert dependencies["@dinilmusick/gutts"] == "^2.0.2"
        assert dependencies["@ultrst-armada/krnl"] == "^1.0.11"
        assert dependencies["@ultrst-armada/frnlts"] == "^0.5.5"
        assert dependencies["@ultrst-armada/kloks"] == "^1.26.0"
        assert dependencies["@ultrst-armada/floks"] == "^1.13.18"
