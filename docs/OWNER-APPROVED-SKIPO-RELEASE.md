# Skipo owner-approved npm release request
When a new Skipo CLI patch is fully verified and merged, a repository owner
(GitHub user 155351357) may open an issue with exact title
`[skipo-npm-release] publish` and body containing **only** the 40-character
lowercase SHA of the current verified Skipo `main` commit.

The issue controller compares the SHA to its own checked-out commit and to
a second authoritative current-main API read immediately before dispatch.
Package versions in root and `packages/skipo` must agree, the CLI package must
be `@ultrst-armada/skipo`, and the prior 1.3.0 release is rejected.

The controller never publishes directly. It dispatches the existing
`publish-skipo-cli.yml` trusted workflow with `publish=true`, `ref=main`,
and the version from the verified checkout, not untrusted issue content.
A dispatched run is **not proof of publication**: inspect exact-source CI,
OIDC npm provenance and real downloadable consumer artifact. Any head change
requires a new owner-authored issue, no silent retry.
