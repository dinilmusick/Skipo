# Canonical Authentication Contract

Skipo applications consume one ecosystem authentication system. Applications MUST NOT implement their own password hashing, session issuance, credential tables, registration flow, or Google identity flow.

## Canonical ownership

```
Luth
  Better Auth identity, credentials, OAuth and sessions
    |
GutTS
  Shared auth contracts and Luth client primitives
    |
Kloks
  Public backend/client integration surface
    |
Floks
  Integrated auth UI + client + session lifecycle
    |
Skipo
  Mandatory canonical scaffold + generated-app enforcement
    |
Every application
  Application profile/workspace data only; no local identity authority
```

## Required capabilities

- Email/password registration and sign-in through Luth.
- Google sign-in through Luth's configured Better Auth provider.
- Secure session hydration, logout and revocation through Luth.
- Application origin registration through the canonical client.
- Google Drive authorization is separate from Google identity and is requested incrementally only when selected as a workspace storage provider.
- Application profile/workspace records may be stored in the application's system database, but credentials and sessions remain owned by Luth.
- Legacy password hashes may be migrated only inside Luth through an explicit, tested migration path.

## Application integration

Frontend:
- Import the integrated `LuthAuthPage` from `@ultrst-armada/floks/auth`.
- Configure only `ecosystemId` and the stable `applicationId`; presentation remains app-specific.
- Do not supply arbitrary login/register/Google callbacks from application code.
- Do not implement local session hydration or credential storage.
- Use the canonical Kloks/GutTS Luth client for authenticated API calls.

Backend:
- Import `DEFAULT_LUTH_URL` and canonical auth contracts from `@ultrst-armada/kloks/auth`.
- Validate the incoming Luth session with Luth; a user ID alone is never an authentication credential.
- Compatibility routes may proxy requests to Luth but must never verify passwords, create credentials, or mint application sessions.
- Never query an application profile table's password field for authentication.

Configuration:
- `SYSTEM_DATABASE_URL` is the only application configuration environment variable.
- Luth's canonical service URL is supplied by the published Kloks auth integration; do not introduce `LUTH_AUTH_URL`, `SRKL_AUTH_BASE_URL`, or per-app auth URL variables.
- Never commit secrets or hard-code deployment origins. The canonical client discovers the runtime origin and registers it idempotently.

## Completion gate

A generated Skipo app is compliant only when:
1. Its login page uses integrated Floks Luth UI.
2. Its auth routes proxy to Luth or are absent.
3. It has no app-local password hashing/verification, registration, credential persistence, token minting or session issuance.
4. It has no bcrypt dependency for authentication.
5. Backend authorization validates a real Luth session.
6. The generated application passes source-governance tests and lifecycle integration tests.

Marker checks against this document are supplementary. CI must inspect actual scaffold and generated source, package dependencies, imports and behavior.

## Runtime verification

Exercise email registration/login, Google OAuth callback, session hydration after refresh, logout/revocation, expired and invalid sessions, application origin registration, backend authorization, and incremental Google Drive authorization. Use a disposable environment. A successful compile is not proof of authentication consolidation.
