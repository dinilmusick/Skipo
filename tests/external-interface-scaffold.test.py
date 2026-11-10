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
        assert "externalInterfaces.mcp(request)" in adapter
        assert "externalInterfaces.http(request)" in adapter

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
