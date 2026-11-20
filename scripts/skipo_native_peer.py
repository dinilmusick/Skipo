#!/usr/bin/env python3
"""Opt-in native UDP discovery for Skipo desktop targets only.

Never imports into the canonical Fetch entry or provider adapters.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

TEMPLATE = r'''import { createSocket } from 'node:dgram';
import { randomUUID } from 'node:crypto';

// Discovery is NOT authentication. A discovered peer is untrusted until a
// separate authenticated, explicitly authorized capability call succeeds.
const PATTERN = /^[a-z][a-z0-9-]{0,62}$/;
const BEACON_KIND = 'skipo.peer.v1';

export function parsePeerBeacon(packet, address, ownInstanceId, now = Date.now()) {
  if (!Buffer.isBuffer(packet) || packet.byteLength > 512) return null;
  let value;
  try { value = JSON.parse(packet.toString('utf8')); } catch { return null; }
  if (!value || value.kind !== BEACON_KIND ||
      !PATTERN.test(value.appId ?? '') ||
      typeof value.instanceId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(value.instanceId) ||
      value.instanceId === ownInstanceId ||
      typeof value.sentAt !== 'number' ||
      !Number.isSafeInteger(value.sentAt) ||
      Math.abs(now - value.sentAt) > 60000) return null;
  return { appId: value.appId, instanceId: value.instanceId,
    observedAddress: address, lastSeen: now, trusted: false };
}

export class NativeUdpBeacon {
  constructor({ appId, instanceId = randomUUID(), port = 47421,
    multicastGroup = '239.255.42.99', intervalMs = 5000,
    peerTtlMs = 20000, onPeer = () => {} } = {}) {
    if (typeof appId !== 'string' || !PATTERN.test(appId)) {
      throw new Error('Invalid native peer application ID');
    }
    if (!Number.isInteger(port) || port < 1024 || port > 65535 ||
        !Number.isInteger(intervalMs) || intervalMs < 1000 ||
        !Number.isInteger(peerTtlMs) || peerTtlMs <= intervalMs ||
        typeof onPeer !== 'function') {
      throw new Error('Invalid native peer discovery configuration');
    }
    this.appId = appId;
    this.instanceId = instanceId;
    this.port = port;
    this.multicastGroup = multicastGroup;
    this.intervalMs = intervalMs;
    this.peerTtlMs = peerTtlMs;
    this.onPeer = onPeer;
    this.peers = new Map();
    this.socket = undefined;
    this.timer = undefined;
  }

  async start() {
    if (this.socket) return;
    const socket = createSocket({ type: 'udp4', reuseAddr: true });
    try {
      await new Promise((resolve, reject) => {
        const fail = (error) => { socket.off('listening', ready); reject(error); };
        const ready = () => { socket.off('error', fail); resolve(); };
        socket.once('error', fail);
        socket.once('listening', ready);
        socket.bind(this.port, '0.0.0.0');
      });
      socket.addMembership(this.multicastGroup);
      socket.setMulticastTTL(1);
      socket.on('message', (message, info) => {
        const peer = parsePeerBeacon(message, info.address, this.instanceId);
        if (!peer) return;
        this.peers.set(peer.instanceId, peer);
        this.onPeer({ ...peer });
      });
      socket.on('error', () => { /* Discovery failure cannot grant trust. */ });
      this.socket = socket;
      this.timer = setInterval(() => this.announce(), this.intervalMs);
      this.timer.unref?.();
      this.announce();
    } catch (error) {
      socket.close();
      throw error;
    }
  }

  announce() {
    if (!this.socket) return;
    const payload = Buffer.from(JSON.stringify({
      kind: BEACON_KIND, appId: this.appId,
      instanceId: this.instanceId, sentAt: Date.now(),
    }));
    this.socket.send(payload, this.port, this.multicastGroup);
  }

  getPeers() {
    const now = Date.now();
    for (const [id, peer] of this.peers) {
      if (now - peer.lastSeen > this.peerTtlMs) this.peers.delete(id);
    }
    return Array.from(this.peers.values(), (peer) => ({ ...peer }));
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    const socket = this.socket;
    this.socket = undefined;
    this.peers.clear();
    if (socket) await new Promise((resolve) => socket.close(resolve));
  }
}
'''

def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="skipo native-peer",
        description="Install/check an opt-in desktop UDP discovery module, never a serverless dependency.",
    )
    parser.add_argument("action", choices=["add", "check"])
    parser.add_argument("--target", required=True,
                        choices=["desktop", "android", "ios", "cloudflare", "vercel", "browser"])
    parser.add_argument("--project", type=Path, default=Path.cwd())
    parser.add_argument("--plan", action="store_true")
    args = parser.parse_args(argv)

    root = args.project.resolve()
    path = root / "native" / "peer" / "nodeBeacon.mjs"
    report = {"operation": "native-peer", "action": args.action,
              "target": args.target, "project": str(root), "path": str(path),
              "applied": False, "ok": False}
    if args.target != "desktop":
        report["error"] = (
            "UDP discovery is forbidden in Cloudflare/Vercel/browser bundles."
            if args.target in {"cloudflare", "vercel", "browser"} else
            "Mobile requires a dedicated platform-native Bonjour/NSD adapter; "
            "Node UDP must not be generated for Android/iOS."
        )
        print(json.dumps(report))
        return 2
    if not (root / "package.json").is_file() or not (root / "src" / "app.ts").is_file():
        report["error"] = "Target must be an existing Skipo Fetch application."
        print(json.dumps(report))
        return 2

    if path.exists():
        if path.read_text(encoding="utf-8") != TEMPLATE:
            report["error"] = "Native module was modified; refusing to overwrite user code."
            print(json.dumps(report))
            return 1
        report.update(ok=True, status="unchanged")
    elif args.action == "check":
        report.update(error="Native peer discovery is not installed.")
        print(json.dumps(report))
        return 1
    elif args.plan:
        report.update(ok=True, status="planned")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive creation prevents clobbering user-owned modules.
        try:
            with path.open("x", encoding="utf-8") as handle:
                handle.write(TEMPLATE)
        except FileExistsError:
            report["error"] = "Another process created the native module."
            print(json.dumps(report))
            return 1
        report.update(ok=True, applied=True, status="installed")

    print(json.dumps(report))
    return 0


def main(argv: list[str] | None = None) -> int:
    return run(argv)


if __name__ == "__main__":
    raise SystemExit(main())
