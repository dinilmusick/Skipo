# Canonical Authentication Contract

Every generated Skipo application composes one authentication authority:

```
Floks Auth UI
    ↓
Skipo LuthAuthPage composition adapter
    ↓
Kloks LuthAuthClient (re-exported from GutTS)
    ↓
Luth
    ↓
Better Auth
```

Applications own application identity, branding, protected-route presentation, and application-specific profile/workspace data. Luth exclusively owns identity, credentials, Google OAuth, session creation, session validation, refresh, logout, and revocation.

## Canonical ownership

- **Luth / Better Auth:** user identities, credential verification and persistence, OAuth, sessions, token issuance, session validation and revocation.
- **GutTS:** shared Luth authentication contracts and client primitives.
- **Kloks:** public `@ultrst-armada/kloks/auth` client integration surface.
- **Floks:** public `@ultrst-armada/floks/auth` authentication UI.
- **Skipo:** thin composition adapter, app identity/branding, route protection integration and enforcement.
- **Generated application:** app-specific profile/workspace data only; it never becomes an identity or session authority.

## Required integration

The generated authentication surface MUST use:

- `AuthPage` from `@ultrst-armada/floks/auth` for UI.
- `createLuthAuthClient` from `@ultrst-armada/kloks/auth` for email sign-in, registration, Google sign-in, session hydration and logout/session operations.
- A stable `ecosystemId` and application-specific `applicationId`.
- Runtime-origin discovery and canonical application registration through the client.
- Luth session validation for every protected backend route. A user ID, application profile row, or client-supplied identity is never an authentication credential.

The Skipo adapter may translate Floks UI callbacks into Kloks client calls. It must not implement the underlying protocol, persist credentials, mint tokens, or create/validate sessions itself. Backend route guards must call Luth's session endpoint and reject requests unless Luth returns an authenticated user and a real session.

## Prohibited application behavior

Generated applications MUST NOT:

- Hash or verify passwords locally.
- Store passwords, password hashes, refresh tokens, or authentication credentials in an application database.
- Create, sign, refresh, or revoke application-local sessions or JWTs.
- Implement local login, registration, password-reset, or OAuth handlers.
- Import Better Auth directly or instantiate an authentication database adapter.
- Use the legacy `AuthServiceFacade` from `@ultrst-armada/kloks/backend` or `@ultrst-armada/kloks/backend/krnl-services`. That facade contains a legacy application-local password-login implementation and is not the canonical Luth client.
- Depend directly on `bcrypt` or `bcryptjs` for application authentication.
- Use Git-SHA dependencies or overrides for GutTS, Kloks, or Floks.

Authentication API routes should be absent. If a compatibility proxy is explicitly required, it may only forward requests to Luth and must not inspect credentials, query authentication tables, or issue sessions.

## Package contract

The root package and Next.js scaffold must use compatible published npm dependencies for `@dinilmusick/gutts`, `@ultrst-armada/kloks`, and `@ultrst-armada/floks`. Repository CI must install these packages from npm and resolve the exact public subpath exports used by generated source. Package availability and export resolution are executable checks, not documentation assumptions.

## Enforcement and completion gate

CI must inspect actual scaffold and generated source, manifests, imports and route files. Documentation markers alone are insufficient.

A generated application is compliant only when:

1. Its login surface composes Floks `AuthPage` with the Kloks Luth client.
2. Email registration/sign-in and Google sign-in delegate to Luth.
3. Session hydration and protected-route validation delegate to Luth.
4. It contains no app-local password, credential, identity, token or session authority.
5. It does not import the legacy Kloks `AuthServiceFacade`.
6. Its package exports resolve from the published npm packages.
7. Scaffold-generation tests, negative architecture tests, build, typecheck and CI pass.

Runtime verification in a disposable environment should exercise email registration/login, Google OAuth callback, session hydration after refresh, logout/revocation, expired and invalid sessions, application-origin registration, protected backend authorization, and incremental Google Drive authorization. A successful compile is not proof of authentication consolidation.
