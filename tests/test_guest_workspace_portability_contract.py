from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "architecture/guest-mode/EPHEMERAL-WORKSPACE-PORTABILITY.md"


def test_guest_workspace_contract_covers_existing_workspacefs_surface():
    contract = CONTRACT.read_text(encoding="utf-8")
    storage = (ROOT / "backend/workspace-storage/SKILL.md").read_text(encoding="utf-8")

    for operation in ("stat", "readFile", "writeFile", "deleteFile", "listDir", "createDir"):
        assert f"{operation}(" in storage
        assert operation in contract

    assert "EphemeralWorkspaceProvider" in contract
    assert "must not create that persistent" in contract
    assert "No persistent provider adapter may be constructed" in contract


def test_guest_workspace_contract_requires_fetch_canonical_boundary():
    contract = CONTRACT.read_text(encoding="utf-8")
    multi_target = (ROOT / "architecture/multi-target-build-spec/SKILL.md").read_text(encoding="utf-8")

    assert "src/app.ts" in contract
    assert "Cloudflare, Vercel, and Node" in contract
    assert "Canonical application entry:" in multi_target
    assert "Provider-specific files are generated adapters" in multi_target
    assert "provider-specific business logic" in contract


def test_guest_portability_matrix_does_not_assume_serverless_affinity():
    contract = CONTRACT.read_text(encoding="utf-8")

    assert "Node long-running server" in contract
    assert "Cloudflare Workers" in contract
    assert "Vercel Edge / Functions" in contract
    assert "Not supported by the current wrapper alone" in contract
    assert "compile-only test is insufficient" in contract
    assert "Missing capabilities fail closed" in contract


def test_guest_workspace_contract_requires_finite_quotas_and_authoritative_expiry():
    contract = CONTRACT.read_text(encoding="utf-8")

    for dimension in (
        "Workspace bytes", "File count", "Single file size", "Lease lifetime",
        "Idle lifetime", "Concurrent leases", "Concurrent requests",
        "Request rate", "Runtime resources", "Cleanup work",
    ):
        assert dimension in contract

    assert "finite, validated" in contract
    assert "server-side lease expiry reaper is authoritative" in contract
    assert "not an untracked in-process timer" in contract


def test_guest_workspace_contract_preserves_luth_identity_boundary():
    contract = CONTRACT.read_text(encoding="utf-8")
    auth = (ROOT / "architecture/authentication/SKILL.md").read_text(encoding="utf-8")

    assert "Luth application is explicitly excluded" in contract
    assert "never passed to Luth session validation" in contract
    assert "Guest-to-authenticated transition" in contract
    assert "Luth exclusively owns identity" in auth


def test_guest_workspace_contract_requires_isolation_cleanup_and_restart_tests():
    contract = CONTRACT.read_text(encoding="utf-8")

    for requirement in (
        "Two leases are isolated",
        "No persistent provider adapter",
        "forged, expired, revoked",
        "idle reaper cleanup",
        "Partial cleanup failure",
        "Process/worker restart behavior",
        "actual Cloudflare, Vercel, and Node runtime adapters",
    ):
        assert requirement in contract


def test_current_scaffold_provider_adapters_remain_thin_fetch_wrappers():
    for scaffold in ("vite", "nextjs"):
        root = ROOT / "scaffolds" / scaffold
        app = (root / "src/app.ts").read_text(encoding="utf-8")
        cloudflare = (root / "src/providers/cloudflare.ts").read_text(encoding="utf-8")
        vercel = (root / "src/providers/vercel.ts").read_text(encoding="utf-8")

        assert "export async function fetch(" in app
        assert "fetchHandler" in cloudflare
        assert "fetchHandler" in vercel
