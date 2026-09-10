---
name: api-guidelines
description: Directives for full headless REST API parity, external endpoint triggering, real-time observable UI state synchronization, and automated test suite verification.
---

# API DEVELOPMENT & REAL-TIME SYNC (DENSE)

$$\forall f \in \text{UIFeatures}, \exists \text{Api}(f) \quad \wedge \quad \text{ApiMutation}(m) \implies \text{PublishEvent}(m) \wedge \text{UpdateClientState}(m)$$

## 1. 5 INVIOLABLE API LAWS

$$\begin{array}{ll}
\mathbf{L_1} \text{ (100% Parity)} & \text{UI\_Capabilities} \equiv \text{API\_Capabilities} \quad (\text{zero UI-only features}) \\
\mathbf{L_2} \text{ (Realtime Sync)} & \text{Mutation}(x) \implies \text{publishRealtimeEvent}(x) \wedge \text{SSEStream}(/api/events) \\
\mathbf{L_3} \text{ (8-Gate Pipeline)}& \forall r \in \text{Routes}: r = \text{createSecureRoute}(\text{Gate}_0 \dots \text{Gate}_7) \\
\mathbf{L_4} \text{ (Multi-Tier Rate)} & \text{CHEAP: 120/m} \mid \text{MUTATION: 60/m} \mid \text{EXPENSIVE: 20/m} \mid \text{AUTH: 25/15m} \\
\mathbf{L_5} \text{ (Governance)} & \text{PageLimit} \le 100 \wedge \text{NoStackLeak} \wedge \text{IPBlockSpike}
\end{array}$$

## 2. REAL-TIME EVENT BUS ARCHITECTURE

```
External API Call (POST /api/documents)
           │
           ▼
    Route Handler -> publishRealtimeEvent({ action, workspaceId, payload })
           │
           ├──────────────────────────┐
           ▼                          ▼
  SSE Stream (/api/events)    Rolling Ring Buffer (200 events)
           │
           ▼
  Client Hook: useRealtimeApiSync({ workspaceId, onDocumentEvent, onToast })
  State updated in-place without page reload
```

## 3. CANONICAL IMPLEMENTATION PATTERN

```typescript
// app/api/documents/route.ts
export const POST = createSecureRoute({
  rateLimitTier: 'NORMAL_MUTATION',
  requiredRoles: ['USER'],
  schema: CreateDocSchema,
  handler: async ({ user, payload }) => {
    const doc = await docService.create(user.id, payload);
    publishRealtimeEvent({ action: 'DOCUMENT_CREATED', workspaceId: payload.workspaceId, payload: doc });
    return NextResponse.json({ success: true, doc }, { status: 201 });
  }
});
```

## 4. CHECKLIST GATE
`python3 checklists/08_api_security_governance.py .`
