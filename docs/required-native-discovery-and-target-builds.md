# Skipo native packaging — required discovery and target matrix

The user-approved native contract supersedes the earlier opt-in packaging policy.

## Native discovery invariant

Every native Skipo package MUST include platform discovery. There is no
`--no-discovery` option. A legacy `--discovery` argument is accepted but has
no effect because discovery is required for native shells.

| Target | Required integration | Boot behavior | Permission |
| --- | --- | --- | --- |
| Windows desktop x64/arm64 | Node UDP multicast discovery | Electron main process starts beacon | Local firewall/network policy |
| macOS Intel x64 / Apple Silicon arm64 / universal | Node UDP multicast discovery | Electron main process starts beacon | OS firewall/network policy |
| Linux x64/arm64 | Node UDP multicast discovery | Electron main process starts beacon | Local network restrictions |
| Android | Capacitor plugin using Android NsdManager | Native JS bridge starts discovery | Android 17+ local-network permission may be required; user denial stops discovery |
| iOS | Capacitor plugin using NetServiceBrowser / Bonjour | Native JS bridge starts discovery | NSLocalNetworkUsageDescription + NSBonjourServices, system privacy denial stops discovery |

Discovery is **mandatory in the application build**, not a mechanism to bypass
operating-system permission prompts. Peers are always marked `trusted: false`;
the service does not expose secrets, capabilities, a local HTTP server, or
authorize any invocation. In particular, Android and iOS browse
`_skipo._tcp.` records, while desktop currently uses UDP
`skipo.peer.v1` beacons. A shared interoperable discovery bridge and
authenticated peer invocation remain separately required to obtain working
cross-platform calls.

## Packaging

Run the canonical Skipo build first. The packaging command never rewrites
`src/app.ts` or any Cloudflare or Vercel adapter.

```sh
skipo package plan --target desktop --project . --bundle-id com.example.app --app-name MyApp --backend static
skipo package prepare --target desktop --project . --bundle-id com.example.app --app-name MyApp --backend static
skipo package build --target desktop --platform linux --arch x64 --project . --bundle-id com.example.app --app-name MyApp --backend static
```

Use `--platform windows|macos|linux` with the desktop build; use
`--arch x64|arm64` (or `universal` for macOS). Native binary builds
require the matching host operating system; no unverified cross-compilation
claims. Windows produces an unsigned NSIS executable, macOS an unsigned
DMG, Linux an AppImage, on platforms supported by the build toolchain.
The resulting artifacts are stored under `dist/native/releases/desktop`.

For Android and iOS, use `--target android` or `--target ios` without a
desktop `--platform` option. The Android SDK and a compatible JDK must be
available. iOS needs Xcode on macOS. Android builds generate a debug APK;
iOS builds generate an **unsigned simulator application archive**, not an
App Store IPA. Codesigning, notarization, provisioning and store publication
are separate gated steps.

Native SDK compilation is not the same as a production-ready application.
Skipo's current remote backend mode deliberately refuses to package
until the canonical native Luth OAuth redirect and authenticated API bridge
pass end-to-end verification. This also applies to ordinary interactive
Skipo applications and Hubrys compositions. A static wrapper may be built,
but must never be represented as a fully working app with backend functionality.

## Platform bridge

Native Android/iOS shells contain a local `@ultrst/skipo-discovery`
Capacitor plugin and JS bootstrap, exclusively in `dist/native`.
The plugin has Android Java + Gradle manifest sources, iOS Swift + Swift Package
Manager sources, and a post-`cap add` script applying Bonjour privacy keys
to `Info.plist`. Capacitor's existing native toolchain discovers plugins
through the generated local npm dependency. This must be validated in native
builds; merely emitting a Java or Swift file is insufficient.

Native listening may be unavailable when Wi-Fi is disabled, permission is
denied, or the app moves into the background. No silent fallback to broad LAN
access is permitted. Documented OS privacy restrictions take precedence over
mandatory packaging inclusion.

## Verification required before release

1. Run Python packaging regressions and JavaScript syntax validation at the
   exact source commit.
2. Build a real generated Skipo application and package its targets, verifying
   that the cloud and Vercel output bytes have not changed.
3. Execute **host-native** Electron builds for Windows, macOS Intel/ARM64 and
   Linux, including artifact checksums.
4. Verify Android NsdManager and Capacitor registration with Gradle
   `assembleDebug`, and iOS Bonjour/Capacitor plugin with Xcode.
5. Verify permission-denied paths, Luth native OAuth, multiple workspaces,
   authenticated capability calling and peer spoof rejection.
6. Sign only with explicitly configured authorized credentials; verify
   signatures and notarization independently. Do not claim a signed release
   from unsigned artifacts.

Hubrys remains a single application with a single ingress HTTP entrypoint.
The native discovery subsystem does not create per-embedded-app HTTP servers.
