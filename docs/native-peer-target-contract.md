# Native peer discovery: opt-in target contract

Skipo's canonical application remains a single Fetch handler in `src/app.ts`.
Cloudflare Workers, Vercel functions and browser builds must never import native
peer discovery. A generated native module must not alter the application entry,
existing Luth session authority, database-backed discovery, or HTTP capability
invocation.

## First implemented slice: Node/Electron desktop

```sh
skipo native-peer add --target desktop --project ./my-skipo-app --plan
skipo native-peer add --target desktop --project ./my-skipo-app
skipo native-peer check --target desktop --project ./my-skipo-app
```

The command only installs `native/peer/nodeBeacon.mjs` into an existing Skipo
application. Existing files are never overwritten. Repeated installation is a
no-op. The file is never imported by the canonical Fetch app or any deployment
adapter. Native desktop packaging must explicitly include and start it from a
Node runtime (such as Electron's main process); installing the file does not
automatically start a network listener.

Example from a desktop-only bootstrap:

```js
import { NativeUdpBeacon } from './native/peer/nodeBeacon.mjs';
const beacon = new NativeUdpBeacon({
  appId: 'docustack',
  onPeer: (peer) => console.info('Untrusted LAN peer discovered:', peer.appId),
});
await beacon.start();
// Later, during shutdown:
await beacon.stop();
```

Beacons contain only an application ID, ephemeral instance ID, protocol kind,
and short-lived timestamp. Discovery records are explicitly marked
`trusted: false`. **Never infer identity, capability authorization, or an
approved deployment URL from a UDP beacon.** Discovery should be followed by
a separate authenticated and authorized connection using existing Luth and
capability-scoped policy. Apply rate limiting, peer expiry, and explicit user
consent before exposing any local callable endpoint. Multicast visibility is
LAN-scoped via TTL=1 but still subject to network policy.

## Target compatibility matrix

| Target | Native beacon | Application communication |
|---|---|---|
| Cloudflare Workers | Forbidden | Fetch/HTTPS and platform-supported interfaces |
| Vercel Edge/Node functions | Forbidden as a discovery service | Fetch/HTTPS; never rely on persistent LAN listeners |
| Browser | Forbidden | Fetch/HTTPS, WebSockets, browser-permitted transports |
| Desktop (Node/Electron) | Opt-in, implemented | Local discovery metadata; authenticated invocation separate |
| Android | Not implemented; Node adapter refused | Use platform NSD/mDNS, local-network permissions |
| iOS | Not implemented; Node adapter refused | Use Bonjour, local-network permissions, relevant entitlements |

Android and iOS must have distinct native bridges and permission gates. Native
beacon support does not imply background discovery works under mobile lifecycle
restrictions. UDP broadcasts/multicast are not always the best mobile choice:
prefer DNS Service Discovery and Bonjour where available.

## Required next integration

1. Add Android NSD and iOS Bonjour transport implementations behind a shared
   platform-neutral peer discovery interface, with permission tests.
2. Add explicit desktop/mobile packaging hooks; do **not** wire native imports
   into `src/app.ts`.
3. Connect discovery candidates to Skipo's authorized capability resolver,
   selecting local peers only after independent authentication/pairing. Missing
   local capability can fall back to the canonical verified remote registry;
   local authorization failure must never trigger a remote downgrade.
4. Run separate Cloudflare, Vercel, desktop and mobile build/behavior checks.
   Reject any Worker/Edge bundle containing `node:dgram` or a native SDK.

This first slice implements discovery for desktop only. It does not claim mobile
runtime support, authenticated peer invocation, or live-network certification.
