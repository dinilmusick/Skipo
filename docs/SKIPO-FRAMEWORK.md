# Skipo Framework

Skipo is the application framework for generating, validating, evolving and managing Skipo-based projects.

## Local development

From a Skipo checkout:

\`\`\`bash
pnpm skipo create MyApp --framework vite
cd MyApp
pnpm --dir /path/to/Skipo skipo inspect .
pnpm --dir /path/to/Skipo skipo check .
pnpm --dir /path/to/Skipo skipo fix .
pnpm --dir /path/to/Skipo skipo update .
pnpm --dir /path/to/Skipo skipo test .
\`\`\`

The standalone initializer is intended to provide the familiar Next-style experience:

\`\`\`bash
npx create-skipo-app@latest MyApp
\`\`\`

The initializer fetches the canonical Skipo repository at the requested ref (default \`main\`) and materializes the selected scaffold, so the scaffold is not a stale copy embedded in the initializer.

## Remote development

A Skipo application can run the same operations on GitHub-hosted runners through the reusable workflow:

\`\`\`yaml
jobs:
  skipo:
    uses: dinilmusick/Skipo/.github/workflows/skipo-reusable.yml@main
    permissions:
      contents: write
      pull-requests: write
    with:
      operation: check
\`\`\`

Supported operations are \`inspect\`, \`check\`, \`fix\`, \`update\` and \`test\`.

## Agent contract

Agents should prefer Skipo semantic operations over inventing framework architecture:

- \`inspect\` discovers framework identity and scaffold.
- \`check\` validates canonical architecture.
- \`fix\` applies the existing remediation pipeline and revalidates.
- \`update\` advances framework metadata and revalidates.
- \`test\` runs project quality commands and then Skipo validation.

The same framework contract can therefore be used by a human developer, a local coding agent such as Google AI Studio, or an ATAX agent executing on GitHub.
