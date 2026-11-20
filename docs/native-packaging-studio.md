# Skipo Packaging Studio — platform packaging contract

**Scope:** this first slice is a **deterministic native-project preparer**, not a completed store-distribution service. It lives in Skipo because Skipo already owns generated adapter wiring and canonical application builds. A Skipo-based visual Packaging Studio can later drive the same command contracts. Do not create a competing application generator.

## Ownership

- Skipo: canonical Fetch app, target plan, generated native wrappers, platform verification.
- Kloks and GutTS: portable services and typed execution contracts.
- Luth: authentication, native callback and OAuth authority.
- Hubrys: embed and launch several Skipo apps behind one entry point; **no UDP mesh or per-subapp ports**.
- Desktop/Android/iOS hosts: opt-in networking adapters, native signing, OS permissions.

## Required command flow

Run the existing Skipo `npm run build` first, producing `dist/client/index.html`. The planner reads `skipo.providers.json` and `src/app.ts` but never mutates either. A sample **static-shell** preview:

```sh
skipo package plan --target desktop --project ./MyApp \
  --bundle-id com.example.myapp --app-name "My App" --backend static

skipo package prepare --target desktop --project ./MyApp \
  --bundle-id com.example.myapp --app-name "My App" --backend static
```

The desktop output is `dist/native/desktop`: isolated web assets, a sandboxed Electron main process with a private `skipo://` asset scheme, and a pinned Electron package. It rejects app-relative `/api/*` requests rather than pretending the native backend exists.

Android/iOS use the same CLI with `--target android` or `--target ios`. These produce `dist/native/{android,ios}` with pinned Capacitor core/CLI/platform dependencies, `capacitor.config.json`, scripts for adding/syncing/opening the native project, and the copied web bundle. These are **not** APKs, IPAs, or ready-to-ship applications.

```sh
# Only after the opt-in desktop peer module from PR #214 is installed
skipo package prepare --target desktop --project ./MyApp \
  --bundle-id com.example.myapp --app-name "My App" \
  --backend static --discovery
```

The desktop flag copies the reviewed `native/peer/nodeBeacon.mjs` and opts into runtime discovery. Peer advertisements are never sufficient evidence for authorization. No discovery is enabled by default.

For Android with discovery requested, the command **fails** until a platform-native Network Service Discovery adapter exists and passes permission tests. iOS with discovery requested similarly fails until a Bonjour adapter is implemented and verified. The Node UDP module must never be used as a mobile or serverless substitute.

## Backend and authentication release gate

Ordinary Skipo applications have backends and Luth authentication. A React web bundle alone cannot provide their APIs or securely translate browser-relative requests into a native app. The current command **plans but refuses to prepare** a `--backend remote --api-origin https://... ` package until a canonical native API routing and OAuth callback bridge is verified. This intentionally prevents silent broken mobile releases or ad-hoc fetch interception.

Next implementation must:
1. Define a first-class runtime-neutral API origin/invocation adapter in Skipo/GutTS without rewriting arbitrary `fetch` usage.
2. Build and test native desktop session transport, Android verified App Links and iOS Universal Links in coordination with Luth.
3. Add actual Android Network Service Discovery and iOS Bonjour bridges with permission-denial and lifecycle tests.
4. Add a Skipo-based packaging UI that calls plan/prepare/build/verify, records exact source and dependency SHAs, and displays blockers instead of fake successes. Native SDK builds and signing must run on authorized machines.

## Invariants and verification

- Source changes: none. Only `dist/native/{target}` is generated; plan is read-only.
- Generated assets are byte-for-byte deterministic. Repeated preparation is a no-op, changed output fails closed, and symlinks in web assets or outputs are rejected.
- Cloudflare and Vercel keep their existing `src/app.ts`, provider adapters, and built artifacts. No `node:dgram` may enter these bundles.
- The packaging result reports `nativeBinaryBuilt:false`, `signed:false`, and `releaseReady:false`. Packaging readiness requires separate native SDK execution and auth tests.
- No credentials, secrets or signing key bytes are copied or recorded by the coordinator.
- An embedded Hubrys complex uses in-process capability registration instead of UDP. It has one external entry point regardless of its number of component Skipo apps.

Official upstream platform packaging references:
- https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging
- https://capacitorjs.com/docs/getting-started
- https://capacitorjs.com/docs/android
- https://capacitorjs.com/docs/ios
