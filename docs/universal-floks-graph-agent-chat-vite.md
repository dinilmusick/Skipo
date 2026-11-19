# Agent 08 — generated Skipo Vite / Floks universal UI wiring

Status: **review candidate, not live cross-application certification**. This branch restores the managed Floks AppShell mounting point and adds Luth/Kloks-scoped Agent Chat and graph hosts. It does not introduce a browser authorization service, an agent scheduler, or a competing graph engine.

## Binding an application

The generated `App` accepts `universalUi={{agentChat, graph}}`. Both bindings are optional: without them guest / non-Aiko applications render their regular tabs and settings, and the chat launcher has no invoker. A generated application may import:

- `createAuthenticatedAgentChatHttpHost` from `src/frontend/pages/main/agentChatHttpHost.ts`
- `createAuthenticatedFodGraphHttpRuntime` from `src/frontend/pages/main/fodGraphHttpHost.ts`
- `FodModule` from the **matching merged Floks** `@ultrst-armada/floks/canvas-ui/fod` package
- `luthFetch` from the application's canonical `src/libraries/client/luthAuthClient.ts`

The **owning app backend** (not a browser form, local cache, or raw Aiko client) must issue a current verified binding:

```ts
const agentChat = createAuthenticatedAgentChatHttpHost(
  {
    principalId: luthPrincipalId,
    workspaceId: selectedWorkspaceId,
    scopeKey: serverIssuedScopeRevision,
    targets: callerAuthorizedKloksDirectory.map(({id, kind, name, alias}) => ({id, kind, name, alias})),
    appAgentId: authorizedAppAgentId,
  },
  {
    request: luthFetch,
    invokePath: '/api/app/agent-invoke',
    cancelPath: '/api/app/agent-cancel',
  },
);
const graph = {
  principalId: luthPrincipalId,
  workspaceId: selectedWorkspaceId,
  scopeKey: serverIssuedScopeRevision,
  GraphComponent: FodModule,
  runtime: createAuthenticatedFodGraphHttpRuntime(luthFetch, {
    flows: '/api/app/fod-flows',
    authorizedNodes: '/api/app/fod-authorized',
    executeRemote: '/api/app/fod-invoke',
  }),
  nodeDefinitions: [],
};
return <App universalUi={{agentChat, graph}} />;
```

These paths are examples of **owning-app endpoint registrations** and are **not** already installed API routes. Implementations of those server routes belong to the owning app / Kloks host agent. Do not deploy this wiring until the routes exist and are independently verified. The browser transport only sends same-origin authenticated requests and rejects invalid response shapes or non-success status; it does not fabricate inference, execution, cancellation, or grants.

## Mandatory server-side contract

- Every directory refresh must call Kloks `createAikoAgentDirectory` with request-time Luth `resolveCaller`, `authorize` and optional display aliases. Each returned `id` is immutable and unique. Never use alias/name as an authority.
- The `scopeKey` must be non-secret and rotate on any principal, application, workspace, authenticated session epoch, grant, publication or deployment revision. On rotation replace the whole bound host. The current rendered graph or pending chat continuation must unmount.
- `onInvoke` and `onCancel` server routes must reauthenticate and reauthorize caller, source/target workspace, exact agent, continuation handle, resource limits, grant, and expiration on *every* request. A client-provided identity is not proof. Cancellation must target the same caller-owned invocation.
- `FodModule` receives a runtime whose `listAuthorizedNodeDefinitions` reports only verified operations for the current caller and workspace. Handles preserve `appId`, `targetWorkspaceId`, `operationId`, `operationVersion`, and typed port snapshots. Kloks dispatch must check permissions and versions again at execution. Navigation never calls `executeFlow`.
- A raw live frontend session operation must provide an explicit `authorizeActiveFrontendWindow` consent method; the HTTP adapter intentionally supplies none.
- Do not redirect denied, revoked, stale, or unknown operations to a default app agent. Do not copy private FOD workflow definitions into a registry.

## Dependency and test gate

Floks PR #55 is merged on source main, but the generated Skipo scaffold currently pins published Floks `2.0.8`. The matched published artifact must actually include `AppShell.agentChat`, `AgentChatDock`, `FodModule` and its `/canvas-ui/fod` export. A type cast in the compatibility shell does **not** supply missing published runtime behavior. Package release and lockfile reconciliation are separate prerequisites.

Run root Vitest `tests/universalFloksUiBinding.test.ts`; generated Vite typecheck, lint, tests and build; Floks exact-head UI and graph tests; then independently exercise **two** installed apps with distinct Luth users/workspaces, authorized directory responses, typed `needs_input` resume, cancellation, grant revocation, expired leases, and unavailable published versions. Until real deployed Kloks routes are exercised, label the result **UI contract fixture only**.

No changes were made to Skipo registry, Neon schema, Kloks transport, Aiko host or server-side authorization.
