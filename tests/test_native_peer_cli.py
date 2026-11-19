"""Native peer opt-in must never leak Node sockets into Fetch/serverless targets."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NATIVE = ROOT / "scripts" / "skipo_native_peer.py"
CLI = ROOT / "scripts" / "skipo_cli.py"


def fixture_project(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.ts").write_text(
        "export default { fetch: async () => new Response('ok') };\n"
    )
    (tmp_path / "package.json").write_text(
        json.dumps({"name": "peer-test-app", "type": "module"})
    )
    return tmp_path


def call(root, action="add", target="desktop", plan=False, via_cli=False):
    script = CLI if via_cli else NATIVE
    args = [sys.executable, str(script)]
    if via_cli:
        args.append("native-peer")
    args.extend([action, "--target", target, "--project", str(root)])
    if plan:
        args.append("--plan")
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    return result, json.loads(result.stdout)


def test_native_peer_is_opt_in_idempotent_and_fetch_unchanged(tmp_path):
    root = fixture_project(tmp_path)
    app_before = (root / "src" / "app.ts").read_bytes()
    planned, status = call(root, plan=True)
    assert planned.returncode == 0, planned.stderr
    assert status["status"] == "planned"
    assert not (root / "native").exists()

    added, status = call(root, via_cli=True)
    assert added.returncode == 0, added.stderr
    assert status["applied"] is True
    installed = root / "native" / "peer" / "nodeBeacon.mjs"
    assert installed.is_file()
    assert "node:dgram" in installed.read_text()
    assert "node:dgram" not in (root / "src" / "app.ts").read_text()
    assert (root / "src" / "app.ts").read_bytes() == app_before

    checked, status = call(root, action="check")
    assert checked.returncode == 0 and status["status"] == "unchanged"
    repeated, status = call(root)
    assert repeated.returncode == 0 and status["status"] == "unchanged"


def test_refuse_serverless_web_and_unimplemented_mobile(tmp_path):
    root = fixture_project(tmp_path)
    for target in ("cloudflare", "vercel", "browser", "android", "ios"):
        result, report = call(root, target=target)
        assert result.returncode == 2
        assert report["ok"] is False
    assert not (root / "native").exists()


def test_refuse_overwriting_custom_module(tmp_path):
    root = fixture_project(tmp_path)
    path = root / "native" / "peer" / "nodeBeacon.mjs"
    path.parent.mkdir(parents=True)
    path.write_text("custom module\n")
    result, report = call(root)
    assert result.returncode == 1
    assert "refusing to overwrite" in report["error"]
    assert path.read_text() == "custom module\n"


def test_node_parser_rejects_spoofed_and_stale_packets(tmp_path):
    root = fixture_project(tmp_path)
    installed, status = call(root)
    assert installed.returncode == 0, status
    module = root / "native" / "peer" / "nodeBeacon.mjs"
    source = """
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { NativeUdpBeacon, parsePeerBeacon } =
  await import(pathToFileURL(process.argv[1]).href);
const now = Date.now();
const instanceId = '11111111-1111-4111-8111-111111111111';
const own = '22222222-2222-4222-8222-222222222222';
const bytes = (value) => Buffer.from(JSON.stringify(value));
const packet = { kind:'skipo.peer.v1', appId:'aiko',
  instanceId, sentAt:now };
const peer = parsePeerBeacon(bytes(packet), '127.0.0.1', own, now);
assert.equal(peer.appId, 'aiko');
assert.equal(peer.trusted, false);
assert.equal(parsePeerBeacon(bytes(packet), '127.0.0.1', instanceId, now), null);
assert.equal(parsePeerBeacon(bytes({ ...packet, sentAt:now-70000 }),
  '127.0.0.1', own, now), null);
assert.equal(parsePeerBeacon(bytes({ ...packet, appId:'../bad' }),
  '127.0.0.1', own, now), null);
assert.equal(parsePeerBeacon(Buffer.alloc(513), '127.0.0.1', own, now), null);
assert.throws(() => new NativeUdpBeacon({ appId:'../bad' }));
assert.equal(new NativeUdpBeacon({ appId:'docustack' }).getPeers().length, 0);
"""
    result = subprocess.run(
        ["node", "--input-type=module", "-e", source, str(module)],
        cwd=ROOT, capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
