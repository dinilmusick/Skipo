# Skipo seven-PR architectural reconciliation

Status: **draft; not independently certified**. Branch `reconcile/architecture-lifecycle-20261117` starts from main `912cf785`. No release or downstream edits are authorized.

## Independent PR review

| Source PR | Capability | Accepted | Integration conflicts and corrective actions |
| --- | --- | --- | --- |
| #126 | Environment governance | Four-variable application contract, alias diagnosis, adversarial tests | Distinguish CI-only selectors in exact workflow paths; replace corrupted test artifact; journal environment alias repairs |
| #127 | Transactional repair | Preflight inventory, hashes, journal, rollback, injected failures | Canonical registry generated ownership was ambiguous; repair had cascading capability discovery and idempotency regression |
| #128 | Semantic analysis | TypeScript AST import graph, indirect boundaries, ambiguity reporting | Wire analyzer into distributed CLI and ensure TypeScript runtime ships in npm artifact |
| #129 | Governance policies | Declarative versioned policy and fail-closed evaluation | Separate framework-source policy validation from generated application policy evaluation |
| #130 | Conformance certification | Independent evidence, adversarial fixtures and explicit unverified integrations | Preserve stable verify diagnostic contract and separate fixture evidence from live providers |
| #131 | Functional capability wiring | Kloks-backed workspace and storage routes, Floks UI | Remove obsolete KRNL/DEPM adapter references; avoid incompatible facade registration; generate canonical Luth auth page |
| #132 | Dependency migrations | Versioned provider contracts, integrity and rollback checks | Preserve provider migration ledger during framework migration writes; reject missing edges and inconsistent installed versions |

The reconciliation does not merge original branch histories. Source PRs remain open until independently verified reconciliation is merged.

## One authoritative lifecycle

`inspect → diagnose → plan → update → repair → sync → verify`

- `inspect`: read-only inventory and architecture observations.
- `diagnose`: capability, environment, semantic and policy findings.
- `plan`: preflight-only, explicit actions; no application mutations.
- `update`: registered dependency/framework migrations; established projects use a sealed transaction.
- `repair`: reversible journal, exact input hashes, ownership checks, fresh independent postconditions.
- `sync`: canonical provider capability composition, not a local SDK replacement.
- `verify`: recomputed canonical state, environment, policy, semantic and migration integrity.
- `policy`, `semantic`, `certify`: additional directly reachable CLI verification entrypoints.

## Certification boundaries

CI must independently test generated Next.js and Vite apps, dirty/legacy recovery, repeated updates and repairs, unknown-file preservation, and packed npm execution. A fixture-only pass cannot establish live Luth OAuth, Google Drive OAuth, Backblaze B2 or database availability. Such integrations remain **unverified** without real credentials and provider evidence.

An empty legacy project can acquire metadata without becoming a compliant application. Its certification must fail with diagnostics rather than claim success.

## Merge conditions

Do not merge this draft until all required checks are green, clean-room CLI and app tests pass, all unresolved violations are addressed and evidence is attached. Do not close #126–#132 before that merge. Do not publish a package or change downstream apps as part of this PR.
