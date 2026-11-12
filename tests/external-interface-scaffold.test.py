from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_vite_and_nextjs_scaffolds_mount_both_external_protocols():
    for framework in ("vite", "nextjs"):
        base = ROOT / "scaffolds" / framework
        external = base / "src/backend/external"
        for name in ("contract.ts", "registry.ts", "httpAdapter.ts", "mcpAdapter.ts", "backendExecutor.ts"):
            assert (external / name).is_file(), f"{framework}: {name}"
        factory = (base / "src/backend/externalInterfaces.ts").read_text(encoding="utf-8")
        backend = (base / "src/backend/AppBackend.ts").read_text(encoding="utf-8")
        adapter = (base / "src/backend/adapters/httpsAdapter.ts").read_text(encoding="utf-8")
        assert "getLuthSession" in factory
        assert "CapabilityRegistry" in factory
        assert "createAppExternalInterfaces" in backend
        auth = (base / "src/backend/auth/luthSession.ts").read_text(encoding="utf-8")
        assert "export async function getLuthSession" in auth
        assert "externalInterfaces.mcp(request)" in adapter
        assert "externalInterfaces.http(request)" in adapter
        app = (base / "src/app.ts").read_text(encoding="utf-8")
        assert "export async function fetch(" in app
        assert "request: Request" in app
        assert "Promise<Response>" in app
        assert "externalInterfaces.mcp(request)" in app
        assert "externalInterfaces.http(request)" in app
        assert "node:" not in app + adapter
        package = __import__("json").loads((base / "package.json").read_text(encoding="utf-8"))
        assert package["scripts"]["build"] == "node scripts/skipo-build.mjs"
        for dependency in ("lucide-react", "@xyflow/react", "d3-force", "zustand"):
            assert dependency in package["dependencies"], f"{framework}: missing Floks peer {dependency}"
        workspace_config = (base / "pnpm-workspace.yaml").read_text(encoding="utf-8")
        assert "allowBuilds:" in workspace_config
        assert "  esbuild: true" in workspace_config
        assert "  msgpackr-extract: true" in workspace_config
        if framework == "nextjs":
            assert '  "@tailwindcss/oxide": true' in workspace_config
        for generated in ("scripts/skipo-build.mjs", "src/providers/cloudflare.ts", "src/providers/vercel.ts", "src/providers/node.ts", "skipo.providers.json"):
            assert (base / generated).is_file(), f"{framework}: {generated}"
        providers = __import__("json").loads((base / "skipo.providers.json").read_text(encoding="utf-8"))
        assert providers["providers"]["vercel"]["output"] == "api/[...path].js"
        assert providers["providers"]["vercel"]["additionalOutputs"] == ["api/mcp.js"]
        vercel = __import__("json").loads((base / "vercel.json").read_text(encoding="utf-8"))
        assert {"/api/:path*": "/api/[...path]", "/mcp": "/api/mcp"} == {rule["source"]: rule["destination"] for rule in vercel["rewrites"]}
        universal_backend_source = (base / "src/backend/UniversalBackend.ts").read_text(encoding="utf-8")
        assert "@ultrst-armada/kloks/services" not in universal_backend_source
        assert "ServiceAFacade" not in universal_backend_source
        assert "ServiceBFacade" not in universal_backend_source
        backend_source = (base / "src/backend/AppBackend.ts").read_text(encoding="utf-8")
        assert "@ultrst-armada/kloks/audio-midi" not in backend_source
        assert "AudioHardwareServiceFacade" not in backend_source
        assert "MidiServiceFacade" not in backend_source

def test_external_protocol_scaffolds_are_protocol_neutral_and_opt_in():
    for framework in ("vite", "nextjs"):
        base = ROOT / "scaffolds" / framework / "src/backend/external"
        registry = (base / "registry.ts").read_text(encoding="utf-8")
        http = (base / "httpAdapter.ts").read_text(encoding="utf-8")
        mcp = (base / "mcpAdapter.ts").read_text(encoding="utf-8")
        assert 'access ?? "authenticated"' in registry
        assert 'transport: "http"' in http
        assert 'transport: "mcp"' in mcp
        assert 'tools/list' in mcp
        assert '/api/capabilities' in http
        assert '"/api/mcp"' in mcp
