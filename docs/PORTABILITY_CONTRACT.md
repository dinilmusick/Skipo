# Skipo cross-provider portability contract

## Universal application surface

A generated application has one source tree and one developer-facing build command:

`npm run build`

The application entry is a Web-standard handler:

`fetch(request: Request, env?: SkipoEnv, context?: unknown): Promise<Response>`

HTTP routes and the MCP endpoint are handled by the same Fetch application. Luth is the canonical authentication boundary for both interfaces. Applications add only the capabilities and services they need.

## Provider adapters

The universal application and route handlers must not import Node server code.

- **Local Node.js:** `dist/providers/node/server.js` adapts the Fetch handler to Node HTTP.
- **Cloudflare Workers:** `dist/providers/cloudflare/worker.js` adapts the same handler to the Workers Fetch runtime. Its dependency graph must not contain Node built-ins.
- **Vercel:** `api/[...path].js` handles HTTP API routes and `api/mcp.js` handles MCP. Both use the Vercel Edge runtime and the same Fetch application.
- **Google AI Studio / Cloud Run:** use the Node server artifact and the same application entry. Cloud Run supplies the Node process and HTTPS termination.

The adapters are generated build outputs, not separate application source trees.

## Optional capabilities

Generated backends start with the Luth auth facade and an empty capability registry. Storage, database, audio/MIDI, orchestration, and other service integrations are opt-in. In particular, generic applications must not import the broad Kloks service barrel or bundle browser audio/MIDI runtimes by default.

The Google Drive storage adapter is retained as an optional module. It is not imported by the universal backend. Its OAuth configuration is passed explicitly from the deployment environment; universal code must not read `process.env`.

## Dependency and artifact rules

The current published package baseline is GutTS 2.0.3, Krnl 1.0.24, Kloks 1.26.3, FrnlTS 0.5.23, and Floks 2.0.0. These are exact published release baselines, not guessed future versions.

- Generated manifests use these published package baselines.
- The root pnpm lockfile must match the root manifest.
- Generated npm applications must install from published package artifacts in a clean directory.
- Cloudflare and Vercel edge bundles must not contain Node-only modules.
- Node-specific imports are permitted only in the Node server adapter.
- HTTP and MCP authentication behavior must remain consistent through Luth.

## Verification evidence

A scaffold-generation pass is not provider-support evidence. Verify the generated artifacts, edge bundle dependency graph, Node startup and HTTP/MCP behavior, Cloudflare Wrangler dry-run, Vercel function outputs, template builds, authentication contracts, module fixtures, and lockfile consistency from a clean checkout.
