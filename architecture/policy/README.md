# Standalone Skipo architectural policy (v1)

This directory is an **application-policy contract**, not an agent/task runner or
an implementation provider. The standalone evaluator lives at
[`scripts/skipo_policy.py`](../../scripts/skipo_policy.py). It uses only Python's
standard library, has no dependency on Skipo's CLI, composer, maintenance engine,
ATAX, or downstream apps, and **never writes to the inspected repository**.

## Source of truth and ownership

- `v1.json` is a machine-readable **schema version 1**, policy version `1.0.0`.
  `owners` identifies canonical providers and the contracts they own; a rule's
  `category` and `check` express an executable invariant.
- Floks owns canonical authentication and workspace UI; Kloks owns reusable
  service implementations and provider SDK integration; Luth is the identity
  authority; FrnlTS/KrnlTS supply their respective frameworks; Skipo owns app
  construction, generated wiring, drift diagnosis and repair planning.
- Business-specific pages/tabs, service orchestrations, and callback adapters
  remain app-owned. A shared component/service must not be reimplemented in the
  application. This first policy protects the canonical auth/workspace entrypoint
  locations and checks selected known duplicate symbols. **It is not a general
  semantic code analyzer**; a future integration can add additional explicit rules.
- Generated assets are only evaluated when present. For an installed generated
  artifact, missing ownership metadata or a mismatched digest is `ambiguous`,
  not permission to overwrite it. A manifest that is checked must be
  `.skipo/generated-assets.json`, with
  `{"schema_version":1,"assets":{"src/libraries/skipo/auth.ts":{"owner":"skipo","sha256":"<64 lower-case hex>"}}}`.
  Other generated files may be added as policy rules when their canonical
  generator provides an equivalent manifest.

## Callable interface (stable v1 contract)

```python
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("skipo_policy", "scripts/skipo_policy.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
policy = module.load_policy("architecture/policy/v1.json")  # validates first
exceptions = module.load_exceptions("/path/to/exceptions.json", policy)  # optional
report = module.evaluate(Path("/path/to/app"), policy, exceptions=exceptions)
# report: JSON-serializable dict; state, diagnostics, policy_sha256, counts, etc.
```

`load_policy`, `validate_policy`, `load_exceptions`, `validate_exceptions`,
`evaluate`, and `PolicyError` are the public Python interfaces. Raise
`PolicyError` for an invalid definition, not a partial compliant report.
`as_of=datetime.date(YYYY, MM, DD)` is a reproducibility input; default is
**UTC today**. An integration must treat `PolicyError` as blocked.

```bash
python3 scripts/skipo_policy.py /path/to/app \
  --policy architecture/policy/v1.json \
  --exceptions /path/to/exceptions.json \
  --as-of 2026-11-17
python3 -m pytest -q --import-mode=importlib tests/test_skipo_policy_*.py
```

The CLI emits **one JSON report to stdout** and exits with `0` for `compliant`,
`2` for `repairable`, or `3` for `ambiguous` / `blocked`. Invalid policy,
exception input or root results in `blocked` with stable
`SKP-POL-POLICY-INVALID` or `SKP-POL-ROOT-INVALID` code.

### Rule shape

Each rule contains `id`, stable `code` (`SKP-POL-...`), `description`, `category`,
`severity` (`info`, `warning`, `error`, `critical`), `on_violation`
(`repairable`, `ambiguous`, `blocked`), declarative `check`, `evidence`
(kind/description), actionable `remediation`, and `verification` with
`independent: true`, a method, and required evidence. All fields are required;
unknown fields and unknown check kinds are rejected. The supported detection
kinds in schema v1 are:

| Kind | Required fields | Intent |
| --- | --- | --- |
| `require_path` | `path` | Canonical file must be present |
| `forbid_path` | `pattern` | Retired paths must be absent |
| `require_dependency` | `package` | Published runtime package must be declared |
| `forbid_dependency` | `package` | App must not own direct provider dependency |
| `forbid_import` | `module`, `paths` | Match static JS/TS imports/exports/require |
| `forbid_declaration` | `symbol`, `paths` | Detect exported local definitions of canonical components |
| `generated_asset` | `path`, `manifest`, `owner` | Validate ownership and SHA-256 of optional generated artifact |
| `extension_boundary` | `protected`, `allowed` | Reject unapproved files in canonical surfaces |

Globs use portable case-sensitive `fnmatch` semantics, not gitignore rules.
Only files under the inspected root are read; symlinks and special files are
blocked, dependency build directories are ignored. Computed imports, unreadable
source/manifests and missing generated provenance produce an `ambiguous` result
rather than a false compliance claim. JS/TS import detection is lexical, not a
full parser; advanced semantic verification belongs in a future integration.

## Diagnostics and independent verification

`diagnostics` is sorted by rule ID, relative path, line, code, and message.
Every finding contains `code`, `rule_id`, `category`, `severity`, `state`,
`path`, `line`, `message`, evidence with observed data, actionable remediation,
`verification` and optional exception details. `policy_sha256` fingerprints
canonical JSON to bind future attestations to the evaluated policy.

**State precedence:** `blocked` > `ambiguous` > `repairable` > `compliant`.
`compliant` means no detected violations or only *active audited exceptions*;
`repairable` means a known finite change can resolve a violation;
`ambiguous` means missing/uncertain evidence precludes safe automatic repair;
`blocked` means a critical constraint, unsafe file, invalid policy or expired
exception forbids approval. Severity is reported separately from state.

The evaluator does **not** certify that a fix is independently verified. Each
violation's `verification.status` is `pending` and its requirements specify
what a separate verifier must inspect on a **fresh repository snapshot**.
After remediation, an independent agent or CI job reruns the same policy and
records its own actor identity, input revision, policy SHA and evidence. An
active exception is explicit (`exception_active`) and never deletes the
underlying violation evidence. Skipo must not dispatch agents or schedule work.

## Narrow exceptions

Exceptions are supplied explicitly through a separate JSON document, never
inferred from comments, local flags, or arbitrary rule disabling. The document
must pin **both policy ID and exact policy version**:

```json
{
  "schema_version": 1,
  "policy_id": "ultrst-skipo-app",
  "policy_version": "1.0.0",
  "exceptions": [
    {
      "id": "migration-auth-waiver",
      "rule_id": "canonical-auth-page",
      "path": "src/frontend/pages/auth/page.tsx",
      "rationale": "Temporary transition while the canonical page is adopted",
      "approved_by": "architecture-reviewer",
      "ticket": "https://github.com/organization/repository/issues/123",
      "issued": "2026-11-17",
      "expires": "2026-12-01"
    }
  ]
}
```

Each exception applies to **one rule and one exact file path** (dependency
checks use `package.json`). No wildcards, parent traversal, unspecified owners,
unknown rules, duplicate scopes, critical violations, ambiguous/blocked checks,
or expiries beyond 90 days from issuance are allowed. Rationale, approver,
HTTPS ticket, issuance and expiry are mandatory. An expired exception adds a
`SKP-POL-EXCEPTION-EXPIRED` blocked diagnostic and no longer authorizes its
underlying violation. Invalid exception documents are rejected fail-closed.

## Integration boundary

Future Skipo CLI/capability/repair integration may import this evaluator,
consume its diagnostics and build a plan, and ask independent CI to verify.
It must **not** interpret `repairable` as permission for arbitrary deletion;
`ambiguous` and `blocked` always stop automatic repair. No current CLI,
registry, environment contract, maintenance engine or downstream app was
changed as part of this standalone component.
