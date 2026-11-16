# Skipo Framework

Skipo is the application framework and governance engine for Skipo-based projects.

## Distribution model

The **Skipo GitHub repository remains private**. The public consumption boundary is npm.

The release pipeline produces two public packages:

- `skipo` — the self-contained framework CLI and engine.
- `create-skipo-app` — the zero-friction application initializer; it depends on the published `skipo` package.

The npm packages do not download or clone the private Skipo repository at runtime.

## Consumer workflow

Create a project:

```bash
npx create-skipo-app@latest MyApp
```

Or use the framework directly:

```bash
npx skipo inspect .
npx skipo check .
npx skipo fix .
npx skipo update .
npx skipo test .
```

The same npm-distributed engine can run in:

- a local developer environment;
- a Google AI Studio / local coding-agent environment;
- an ATAX GitHub Actions runner.

GitHub is therefore the **source/release system**, while npm is the **distribution system**.

## Release model

The private repository publishes from tags matching:

```text
skipo-v<version>
```

The root Skipo version and both npm package versions must match the release tag.

The GitHub workflow uses npm Trusted Publishing (OIDC), so normal releases do not require a long-lived npm token. npm requires a trusted-publisher relationship for each package and the workflow has `id-token: write`. npm currently requires Node 22.14+ and npm 11.5.1+ for trusted publishing; the release workflow uses Node 24.

Because the source repository is private, npm provenance attestations are not generated for these releases; this is an npm limitation for packages published from private repositories.

## One-time npm setup

After the first package exists on npm, configure the GitHub Actions trusted publisher for each package:

- Organization/user: `dinilmusick`
- Repository: `Skipo`
- Workflow filename: `publish-skipo-cli.yml`
- Allow `npm publish`

Each package has its own trusted-publisher configuration. npm documents this as the token-free recommended CI/CD publishing mechanism.
