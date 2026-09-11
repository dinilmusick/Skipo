# TASK: AUDIT_AND_HARDEN_BURST_OPERATIONS_PROTOCOL

$$\text{INVARIANT}: \text{ANTI\_BURST} \equiv \text{CircuitBreaker}_{4xx} \wedge \text{JitteredBackoff} \wedge \text{DebouncedMutations}_{\ge 1000\text{ms}} \wedge \text{DeduplicatedRequests} \wedge \text{VisibilityPause}$$
$$\text{PRIORITY}: \text{Self-DoS Elimination \& Invocation Throttling} \succ \text{New Features} \succ \text{Cosmetics}$$

---

## 0. PURPOSE & ACTIVATION CONTEXT

**Activate this prompt to instruct an AI coding agent to systematically audit, identify, and eliminate all potential "burst operation" functions across a repository.**

### What Is a "Burst Operation"?
A burst operation is any client or server routine that generates sudden, uncontrolled request cascades (10 to 150+ requests per second). On serverless hosts (like Vercel, AWS Lambda, or Supabase), burst operations rapidly burn compute quotas, trigger IP abuse blocklists, and cause self-inflicted Denial of Service (Self-DoS).

---

## 1. THE 6 HIGH-RISK BURST PATTERNS (AUDIT TARGETS)

### Pattern 1: Unclosed Stream Reconnection Cascades (`EventSource` / `WebSocket`)
- **Danger**: If `eventSource.onerror` does not call `eventSource.close()`, Chromium/Brave's native C++ engine automatically reconnects at wire speed (100+ req/s) when encountering a 401 or 403 error.
- **Remediation**:
  1. Always call `eventSource.close()` immediately inside `onerror`.
  2. Implement an instant circuit breaker on 401/403/429: halt all reconnection attempts permanently until the user logs in again.
  3. Apply jittered exponential backoff: $[5s, 15s, 30s, 60s, 120s] \pm 15\%$ with a hard ceiling of max 5 retries.
  4. Suspend timers while `document.hidden === true`.

### Pattern 2: Rapid Polling Loops (`setInterval` / Recursive `setTimeout`)
- **Danger**: `setInterval` with intervals $< 5000\text{ms}$ or recursive `setTimeout` calling API endpoints in background tabs.
- **Remediation**:
  1. Ban all client intervals $< 5000\text{ms}$ for network requests.
  2. Replace polling with persistent Server-Sent Events (SSE) or event-driven mutations.
  3. If polling is unavoidable, use minimum 15s–60s intervals and pause when `document.hidden` is true.

### Pattern 3: Unthrottled `useEffect` Dependency Loops
- **Danger**: A `useEffect` that triggers `fetch()`, updates component state, and includes that state (or an un-memoized object/function reference like `getAuthHeaders()`) in its dependency array. This triggers an infinite re-render loop firing 50+ network calls per second.
- **Remediation**:
  1. Never put unstable object literals or un-memoized functions in dependency arrays.
  2. Use `useRef` for stable callback and parameter references.
  3. Add an `AbortController` cleanup in the effect return handler to cancel obsolete requests.

### Pattern 4: Un-debounced High-Frequency User Interactions (Autosave / Keystrokes / Canvas Drag)
- **Danger**: Typing in an input, moving a slider, or dragging nodes on a canvas triggering individual `POST / PUT` network mutations per event.
- **Remediation**:
  1. Route all mutation saves through a debounced queue (e.g. `MutationQueue`, minimum $1000\text{ms}$ delay).
  2. Collapse consecutive patches for the same entity ID so only the final consolidated patch is dispatched to the server.

### Pattern 5: Simultaneous Unbatched / Un-deduplicated Network Floods
- **Danger**: A dashboard or workspace mounting 10 child components, each independently fetching `/api/categories`, `/api/user`, or `/api/workspaces` at the exact same millisecond.
- **Remediation**:
  1. Route GET calls through `safeFetch` or `RequestDeduplicator` to coalesce identical in-flight promises into a single network roundtrip.
  2. Prefer single composite/batch endpoints (e.g. `/api/workspace/bootstrap`) over 10 individual GET requests.

### Pattern 6: Immediate Retries in `catch` Blocks
- **Danger**: Code catching a network or 500 error and immediately re-calling the same function without delay or retry counters.
- **Remediation**:
  1. Route requests through `safeFetch` (which enforces a maximum of 3 retries with jittered exponential backoff).
  2. On 4xx status codes (401, 403, 404, 429), never retry.

---

## 2. SYSTEMATIC SCAN & AUDIT COMMANDS

Run these commands across the target codebase:

```bash
# 1. Find all EventSource instantiations (Check for .close() and circuit breakers)
grep -rn "new EventSource" src/ hooks/ components/

# 2. Find all setInterval calls (Check for network calls < 5000ms)
grep -rn "setInterval" src/ hooks/ components/

# 3. Find raw unthrottled fetch calls inside components
grep -rn "fetch(" src/ components/ hooks/

# 4. Run the Skipo Aspect 08 Architectural Validator
python3 checklists/08_api_security_governance.py .
```

---

## 3. REMEDIATION PROTOCOL

For every identified candidate:
1. **Client Real-Time Hooks**:
   - Replace with the canonical `useRealtimeApiSync.ts` (180 lines) pattern:
     - `eventSource.close()` inside `onerror`.
     - Permanent 4xx circuit breaker.
     - Exponential backoff with jitter $[5s \dots 120s]$.
     - Max 5 retries ceiling.
     - `document.hidden` / `visibilitychange` suspension.
2. **Component Fetch Calls**:
   - Replace raw `fetch` with `safeFetch` (or `safeRequestJson`) from `@/lib/safe-fetch`.
3. **High-Frequency Mutations**:
   - Wrap mutation dispatches in `MutationQueue` with $1000\text{ms}$ debounce.

---

## 4. MANDATORY VERIFICATION GATE

The agent MUST complete and report:
1. **Skipo Aspect 08 Validator**:
   ```bash
   python3 checklists/08_api_security_governance.py .
   ```
   *Requirement*: 0 errors, 100% compliance.
2. **Static Typecheck**:
   ```bash
   npx tsc --noEmit
   ```
   *Requirement*: Exit code 0.
3. **Production Build**:
   ```bash
   npm run build
   ```
   *Requirement*: Successful bundle compilation without warnings or route conflicts.
