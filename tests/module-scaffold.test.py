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
        app_source = (target / "src" / "app.ts").read_text(encoding="utf-8")
        assert "export async function fetch" in app_source
        assert './backend/DemoAppBackend.js' in app_source
        assert "externalInterfaces.mcp(request)" in app_source
        assert "externalInterfaces.http(request)" in app_source
        generated_backend = (target / "src" / "backend" / "DemoAppBackend.ts").read_text(encoding="utf-8")
        assert "audio-midi" not in generated_backend
        assert "AudioHardwareServiceFacade" not in generated_backend
        assert "MidiServiceFacade" not in generated_backend
        providers = __import__("json").loads((target / "skipo.providers.json").read_text(encoding="utf-8"))
        assert providers["application"] == {"entry": "src/app.ts", "protocol": "fetch"}
        assert set(providers["providers"]) == {"cloudflare", "vercel", "node"}
        package = __import__("json").loads((target / "package.json").read_text(encoding="utf-8"))
        assert package["scripts"]["build"] == "node scripts/skipo-build.mjs"
        assert "esbuild" in package.get("pnpm", {}).get("onlyBuiltDependencies", [])
        assert "build:fullstack" not in package["scripts"]
        assert "build:api" not in package["scripts"]
        assert (target / "src/providers/cloudflare.ts").is_file()
        assert (target / "src/providers/vercel.ts").is_file()
        assert (target / "src/providers/node.ts").is_file()
        assert 'from "../app.js"' in (target / "src/providers/cloudflare.ts").read_text(encoding="utf-8")
        assert 'from "../app.js"' in (target / "src/providers/vercel.ts").read_text(encoding="utf-8")
        cloudflare = (target / "src/providers/cloudflare.ts").read_text(encoding="utf-8")
        vercel = (target / "src/providers/vercel.ts").read_text(encoding="utf-8")
        node = (target / "src/providers/node.ts").read_text(encoding="utf-8")
        assert "node:" not in cloudflare
        assert "node:" not in vercel
        assert "node:http" in node
        assert 'main = "dist/providers/cloudflare/worker.js"' in (target / "wrangler.toml").read_text(encoding="utf-8")
        assert '"buildCommand": "npm run build"' in (target / "vercel.json").read_text(encoding="utf-8")
        vercel_config = __import__("json").loads((target / "vercel.json").read_text(encoding="utf-8"))
        assert {"/api/:path*": "/api/[...path]", "/mcp": "/api/mcp"} == {rule["source"]: rule["destination"] for rule in vercel_config["rewrites"]}
        assert providers["providers"]["vercel"]["output"] == "api/[...path].js"
        assert providers["providers"]["vercel"]["additionalOutputs"] == ["api/mcp.js"]
        assert not (target / "config/build/manifests/fullstack.json").exists()
        assert not (target / "config/build/manifests/api.json").exists()

        # The scaffold must not rewrite the canonical ecosystem dependency versions.
        dependencies = package["dependencies"]
        assert dependencies["@dinilmusick/gutts"] == "^2.0.3"
        assert dependencies["@ultrst-armada/krnl"] == "^1.0.23"
        assert dependencies["@ultrst-armada/frnlts"] == "^0.5.23"
        assert dependencies["@ultrst-armada/kloks"] == "^1.26.3"
        assert dependencies["@ultrst-armada/floks"] == "^1.14.2"



def test_multi_target_generation_uses_the_scaffold_fetch_entry_and_one_build():
    import json

    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / "FreshGeneratedApp"
        scaffold = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "scaffold_app_structure.py"), str(target), "--name", "FreshGeneratedApp"],
            cwd=ROOT, capture_output=True, text=True,
        )
        assert scaffold.returncode == 0, scaffold.stdout + scaffold.stderr

        generated = subprocess.run(
            [sys.executable, str(ROOT / "assistant.py"), "generate", "multi-target", str(target), "--name", "FreshGeneratedApp"],
            cwd=ROOT, capture_output=True, text=True,
        )
        assert generated.returncode == 0, generated.stdout + generated.stderr

        app = (target / "src/app.ts").read_text(encoding="utf-8")
        assert "export async function fetch" in app
        adapter = (target / "src/backend/adapters/httpsAdapter.ts").read_text(encoding="utf-8")
        assert "export { fetch as fetchHandler" in adapter
        assert not (target / "src/backend/adapters/universalEntry.ts").exists()
        assert not (target / "src/backend/adapters/nodeBridge.ts").exists()

        package = json.loads((target / "package.json").read_text(encoding="utf-8"))
        assert package["scripts"]["build"] == "node scripts/skipo-build.mjs"
        assert "build:fullstack" not in package["scripts"]
        assert "build:api" not in package["scripts"]

        manifest = json.loads((target / "skipo.providers.json").read_text(encoding="utf-8"))
        assert manifest["application"]["entry"] == "src/app.ts"
        assert set(manifest["providers"]) == {"cloudflare", "vercel", "node"}
