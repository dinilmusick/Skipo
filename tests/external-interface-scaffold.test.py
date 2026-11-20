from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_vite_scaffold_mounts_both_external_protocols():
    framework = "vite"
    base = ROOT / "scaffolds" / framework
    external = base / "src/backend/external"
    for name in ("contract.ts", "registry.ts", "httpAdapter.ts", "mcpAdapter.ts", "backendExecutor.ts"):
        assert (external / name).is_file(), f"{framework}: {name}"
    factory = (base / "src/backend/externalInterfaces.ts").read_text(encoding="utf-8")
    backend = (base / "src/backend/AppBackend.ts").read_text(encoding="utf-8")
    drive_storage = (base / "src/backend/storage/googleDriveWorkspaceStorage.ts").read_text(encoding="utf-8")
    assert "process.env" not in backend
    assert "process.env" not in drive_storage
    assert "getGoogleDriveOAuthConfig(env" in drive_storage
    adapter = (base / "src/backend/adapters/httpsAdapter.ts").read_text(encoding="utf-8")
    assert "getLuthSession" in factory
    assert "CapabilityRegistry" in factory
    assert "createAppExternalInterfaces" in backend
    auth = (base / "src/backend/auth/luthSession.ts").read_text(encoding="utf-8")
    assert "export async function getLuthSession" in auth
    app = (base / "src/app.ts").read_text(encoding="utf-8")
    assert "externalInterfaces.mcp(request)" in app
    assert "externalInterfaces.http(request)" in app
    assert "universalFetch(request, env)" in adapter
    assert "/api/workspaces" in adapter
    assert "/api/storage/connections" in adapter
    assert "authenticateLuthRequest" in adapter
    worker = (base / "src/providers/cloudflare.ts").read_text(encoding="utf-8")
    vercel = (base / "src/providers/vercel.ts").read_text(encoding="utf-8")
    node = (base / "src/providers/node.ts").read_text(encoding="utf-8")
    assert "export async function fetch(" in app
    assert "externalInterfaces.mcp(request)" in app
    assert "externalInterfaces.http(request)" in app
    assert "proxyLuthAuthRequest(request)" in app
    assert "node:" not in app + adapter + worker
    assert "fetchHandler" in adapter + vercel + node + worker
    package = __import__("json").loads((base / "package.json").read_text(encoding="utf-8"))
    assert package["scripts"]["build"] == "node scripts/skipo-build.mjs"
    assert (base / "scripts/skipo-build.mjs").is_file()
    assert (base / "src/providers/cloudflare.ts").is_file()
    assert (base / "src/providers/vercel.ts").is_file()
    assert (base / "src/providers/node.ts").is_file()
    assert (base / "skipo.providers.json").is_file()
    assert not (base / "scripts/skipo-build.cjs").exists()
    assert not (base / "src/backend/adapters/universalEntry.ts").exists()
    bridge = (base / "src/backend/adapters/nodeBridge.ts").read_text(encoding="utf-8")
    # The required bridge is a verified alias of our one real Node Fetch
    # converter, NOT a second implementation or Node dependency in Workers.
    assert "dispatchNodeRequest as adaptNodeRequest" in bridge
    assert "from '../../providers/nodeRequestAdapter.js'" in bridge
    assert "createServer(" not in bridge
    assert "new Request(" not in bridge
    assert "node:" not in bridge
    assert "from '../backend/adapters/nodeBridge.js'" in vercel
    backend_source = (base / "src/backend/AppBackend.ts").read_text(encoding="utf-8")
    assert "@ultrst-armada/kloks/audio-midi" not in backend_source
    assert "AudioHardwareServiceFacade" not in backend_source
    assert "MidiServiceFacade" not in backend_source

def test_external_protocol_scaffold_is_protocol_neutral_and_opt_in():
    framework = "vite"
    base = ROOT / "scaffolds" / framework / "src/backend/external"
    registry = (base / "registry.ts").read_text(encoding="utf-8")
    http = (base / "httpAdapter.ts").read_text(encoding="utf-8")
    mcp = (base / "mcpAdapter.ts").read_text(encoding="utf-8")
    assert 'access ?? "authenticated"' in registry
    assert 'transport: "http"' in http
    assert 'transport: "mcp"' in mcp
    assert 'tools/list' in mcp
    assert '/api/capabilities' in http
