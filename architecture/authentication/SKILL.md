# Canonical Authentication Contract

Skipo applications consume one ecosystem authentication system. Applications MUST NOT implement their own password hashing, session issuance, credential tables, or Google identity flow.

## Canonical ownership

```
FLOKS
  auth UI
     |
KLOKS
  canonical auth client/service contract
     |
SRKL
  Better Auth server + Neon control-plane persistence
     |
Neon
  Better Auth user/account/session tables
  + existing ULTRST application metadata
```

## Required capabilities

- Email/password sign-up and sign-in.
- Live email-format validation in reusable auth UI.
- Secure Better Auth sessions and logout.
- Google sign-in through the canonical Google OAuth provider.
- Google sign-in must not require a second manual email-verification link.
- Google Drive authorization is separate from Google identity and MUST be requested incrementally only when a user selects Google Drive as a workspace storage provider.
- Existing `ultrst-users` application metadata remains authoritative for application/workspace data and is synchronized from Better Auth users.
- Existing legacy password hashes are accepted during migration; newly created/changed passwords use the canonical Better Auth password hashing configuration.
- Account linking is centralized.
- Auth state is never stored in application-local `localStorage` tokens when Better Auth session cookies are available.

## Application integration

Backend:
- consume `@ultrst-armada/kloks/backend` auth services;
- configure `SRKL_AUTH_BASE_URL`;
- never query `ultrst-users.password_hash` for authentication;
- never mint application-specific session tokens.

Frontend:
- consume the FLOKS reusable auth UI;
- provide the canonical auth service/client callback;
- use credentials/cookies when calling the canonical auth server;
- do not implement Google OAuth directly.

## Completion gate

A Skipo app is auth-compliant only when:
1. no app-local password verification remains on an authentication path;
2. no app-local session token is minted;
3. email/password routes resolve to canonical Better Auth;
4. Google sign-in resolves to canonical Better Auth;
5. Google Drive authorization is incremental and provider-specific;
6. CI validates the auth integration and the app still passes the canonical Skipo architecture validator.


## Security and release verification

- A stored plaintext password MUST never be accepted as a password hash. Legacy hashed credentials may be supported only through an explicit migration path with tests; do not silently lock out existing users.
- Session verification MUST use a canonical Better Auth session cookie or another explicitly supported server-to-server credential. A user ID alone is not an authentication credential.
- Server-side HTTP clients MUST explicitly propagate the required cookie/session credential; `credentials: "include"` alone does not create a shared cookie jar between independent server requests.
- Production configuration MUST define the canonical auth base URL, allowed origins, OAuth callback URLs, and required secrets without committing secret values.
- CI must execute unit tests, type checks, package builds, and architecture checks. Source-marker checks are supplementary and do not replace runtime integration tests.
- Before declaring rollout complete, exercise registration, sign-in, session retrieval, role/authorization enforcement, sign-out, expired/invalid sessions, and incremental Google Drive authorization against a disposable test environment.
- Preserve reproducible dependency installation. Use the repository's committed lockfile and its matching package manager/CI install command where a lockfile exists.
