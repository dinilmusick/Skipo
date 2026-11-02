# Deployment Target Contract

Skipo owns the application-level declaration of supported deployment targets. This contract is metadata only: it does not execute builds or depend on the WebContainer runtime.

## Providers

- vercel: Vercel project build target.
- cloudflare: Cloudflare Workers or Pages build target.

## Contract rules

- Every target declares its provider and build command.
- Paths are relative to the application root unless explicitly stated.
- Provider configuration remains in the provider's native configuration file.
- Secrets are never stored in this manifest.
- A missing provider configuration is reported as not configured, not silently treated as compatible.
- Static preflight checks are distinct from provider-native build verification.
- Runtime execution is intentionally deferred until the canonical Kloks WebContainer integration is merged.

Schema: schemas/deployment-target.schema.json.

## Validation stages

1. Static configuration and manifest inspection.
2. Provider CLI build (vercel build / wrangler deploy --dry-run) in the canonical isolated execution environment.
3. Runtime smoke tests against the generated provider artifacts.
4. Optional preview deployment and remote verification.

Only stage 1 is enabled by the preparation work. Stages 2–4 must be connected after WebContainer integration; do not add a second execution provider.
