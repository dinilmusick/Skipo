# Canonical Agent Chat adapter for generated Skipo Vite apps

Status: integration contract; **not** multi-app or production certification.

## Dependency order

1. Merge and release Floks chat PRs in order: #48 (AppShell and dock), #51 (scope isolation), #53 (revocation, typed clarification and cancellation).
2. Reconcile Kloks caller-authorized directory (already merged #96) and immediate-caller/authorized execution work (#94 and its dependencies). Do not conflate directory discovery with invocation authority.
3. Update generated Vite scaffold's pinned `@ultrst-armada/floks` and `@ultrst-armada/kloks` versions, regenerate `pnpm-lock.yaml` with frozen-install reproducibility and rebuild downstream app.
4. Then reconcile Skipo #164, #167 and this follow-up PR #206 in order; run exact-head CI and independently test a generated Vite consumer.

The currently pinned Floks 2.0.7 does **not** provide `AppShell.agentChat`. No source-only test is a substitute for a packed-library Vite build.

## Trusted host responsibilities

The app backend owns all authority. Resolve the current Luth session and selected workspace **server-side**, then use Kloks `createAikoAgentDirectory` with its `resolveCaller`, `listAgents`, `authorize` and optional display-alias adapter. Returned `AikoDirectoryEntry` provides immutable `id`, `kind`, display `name` and `alias`; map only permitted entries to Floks `AgentChatTarget`. Never derive authority from a chosen label, an `@mention`, browser-supplied `userId` or a client-side cache.

Expose a server-supplied, non-secret `scopeKey` that changes on any principal, application, workspace, authenticated session epoch or grant/revocation revision change. The Vite `ScopedAgentChatHost` also requires `principalId` and `workspaceId`; these must match the Luth principal and selected workspace before the binding reaches Floks. The managed shell drops the old workspace immediately on principal change.

The host supplies these bindings from its authenticated runtime:

- `targets`: current caller-authorized Kloks directory projection; immutable IDs, unique entries, correct `kind`.
- `appAgentId`: an authorized application-agent ID, or omitted to require an explicit `@agent` selection.
- `onInvoke(request, {signal}?)`: POST only to the app's authenticated server endpoint. Server re-verifies Luth, resolves immutable target, authorizes caller/workspace, checks invocation budgets and invokes the Kloks BackendFacade; it must not accept browser-supplied caller identity or arbitrary remote URLs.
- `onCancel({targetId,targetKind,invocationId?})`: an optional authenticated cancellation endpoint. Route cancellation to the same caller-owned operation; do not treat a client-only AbortSignal as proof that a remote agent stopped.
- `resumeInvocationId` and `parameters`: server-owned continuation and typed values. The server must bind each resume to original user, app, workspace, target, call/trace, grant and expiry, and validate field values against its own schema. An alias is never a continuation identifier.

**Important gap:** Kloks #94 `ImmediateCallerRouter` exposes `call`, `callIdempotent` and `callChild`, returning `{callId, traceId, replyTo, result}` with `result.status: completed | needs_input`. It does not by itself expose a durable `resumeInvocationId` or an external cancel endpoint. Do not fabricate continuation authority from `callId` or implement a second agent scheduler in Skipo. The owning Kloks runtime must supply the missing server-side continuation/cancel adapter before claiming live authenticated resumption/cancellation.

## Exact verification matrix

- Rebuilt packed Floks + Kloks consumer: frozen install, typecheck, lint, Vitest, build, generated Vite app and browser UI.
- Dock opens and closes via button, Escape and keyboard; app agent and @selected endpoint/workflow calls use stable IDs.
- Missing target, duplicate IDs, stale grant, revoked capability, invalid session, wrong app and cross-workspace target fail closed.
- Revoke selected target or pending clarification: never redirect to the default app agent.
- Typed `needs_input` preserves target ID/kind and continuation; backend validates values and denies forged/replayed input.
- Cancellation aborts the in-flight request and reaches an authenticated host cancellation adapter; late responses never enter a new scope's transcript.
- Two separate generated Vite applications with independent Luth principals/workspaces: invoke only authorized targets, deny forged identities, cross-tenant discovery, cross-app cycles and stale revisions.
- Explicitly disabled Aiko app: no Aiko runtime imports or AI-agent bundles, no invoker, useful no-agents state.
- Validate Cloudflare/Vercel real deployment/bundle limits only after the cross-repo release stack is reconciled.

No merge, package release, production deployment or multi-app certification is implied by this document.
