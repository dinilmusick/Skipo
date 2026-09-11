# TASK: ENFORCE_USAGE_THROTTLING_AND_ANTI_POLLING_PROTOCOL

$$\text{INVARIANT}: \text{APP\_THROTTLING} \equiv \text{CircuitBreaker}_{4xx} \wedge \text{BackoffJitter}_{\ge 5s \dots 120s} \wedge \text{EventSourceClose}_{\text{native}} \wedge \text{VisibilityPause} \wedge \text{RateLimit}_{\text{multi-tier}}$$
$$\text{PRIORITY}: \text{Resource Throttling \& Self-DoS Prevention} \succ \text{New Feature Logic} \succ \text{UI Layout}$$

---

## 0. PURPOSE & ACTIVATION CONTEXT

**Activate this prompt whenever an application experiences excessive cloud/serverless invocation spikes, high-frequency request loops, or whenever verifying that an application's real-time sync and API endpoints strictly protect server resources.**

### The Serverless Cost & Self-DoS Incident (Context)
On serverless platforms (such as Vercel or AWS Lambda), an unauthenticated client receiving HTTP 401 or 403 can trigger an uncontrolled request cascade (150+ req/s) if:
1. `eventSource.onerror` does not immediately call `eventSource.close()`, causing Chromium/Brave's native WHATWG network engine to reconnect at wire speed.
2. The client lacks a circuit breaker to recognize that retrying a 401 (Unauthorized) or 403 (Banned/Forbidden) is futile and only triggers IP abuse blocks.
3. Legacy short polling (`setInterval < 5000ms`) runs in parallel with real-time streams.
4. Background browser tabs continue hammering endpoints when `document.hidden` is true.

When this prompt is invoked, the coding agent MUST audit, enforce, and verify all 6 client-side and 4 server-side throttling invariants across the entire repository.

---

## 1. THE 6 CLIENT-SIDE STREAM & POLLING INVARIANTS (ENFORCE IN ALL HOOKS)

1. **Immediate Native Teardown (`eventSource.close()`)**:
   - Whenever an `EventSource` errors, `eventSource.close()` MUST be called immediately inside `eventSource.onerror` before scheduling any backoff logic.
   - Never leave an errored `EventSource` open; doing so causes Chromium and WebKit browsers to hammer the endpoint in a tight C++ loop.
2. **Permanent 4xx Circuit Breaker**:
   - If an endpoint or reconnection probe returns HTTP 401, 403, or 429, the client MUST trip a persistent circuit breaker (`circuitBrokenRef.current = true`) and **halt all reconnection attempts**.
   - No retry timer may fire while circuit broken. The client only wakes up upon explicit user re-login or fresh authentication token.
3. **Conservative Jittered Exponential Backoff**:
   - For network glitches or 5xx server drops, retries MUST use exponential backoff:
     $$\text{Delays} \in [5000\text{ms}, 15000\text{ms}, 30000\text{ms}, 60000\text{ms}, 120000\text{ms}] \times (0.85 + 0.3 \times \text{random}())$$
   - Randomized jitter ($\pm 15\%$) is mandatory to eliminate the thundering herd problem on serverless cold starts.
4. **Hard Maximum Retry Ceiling (Max 5 Attempts)**:
   - After 5 consecutive failed reconnection attempts, retries MUST stop completely and transition the client into an idle/disconnected state.
5. **Page Visibility Awareness (`document.hidden`)**:
   - When the user switches away from the tab (`document.hidden === true`), all reconnection and polling timers MUST be paused immediately.
   - Listen to `document.addEventListener('visibilitychange')`. When `document.visibilityState === 'visible'`, reset retry counters, perform a single catch-up sync (`since=lastTimestamp`), and re-establish the connection.
6. **Zero Aggressive Polling Loops**:
   - Strict ban on `setInterval` with intervals $< 5000\text{ms}$ that trigger network requests (`fetch`, `axios`, or API queries).
   - Real-time updates must rely on persistent SSE streams or event-driven mutations, never short-polling.

---

## 2. THE 4 SERVER-SIDE USAGE THROTTLING INVARIANTS

1. **Gate 0 Abuse Anomaly Detection & 15-Minute IP Blocklist**:
   - Trigger a 15-minute temporary IP ban (`isIpBlocked`) if an IP generates:
     - $> 25$ failed authentication attempts (401) within 5 minutes.
     - Rapid rate spike anomalies exceeding baseline thresholds.
   - Return HTTP 403 Forbidden with `Retry-After: 900`.
2. **Gate 4 Multi-Tier Sliding Window Rate Limiting**:
   - `CHEAP_READ`: 120 req/min (or 300 req/min for SSE stream initiation).
   - `NORMAL_MUTATION`: 60 req/min.
   - `EXPENSIVE_OPERATION`: 20 req/min.
   - `AUTHENTICATION`: 25 req / 15 min.
   - Scale limits dynamically using Progressive Trust multipliers ($T_0: 0.25\times \dots T_4: 10.0\times$).
3. **Gate 5 Concurrency Limits & Execution Timeouts**:
   - Enforce bounded concurrent execution slots per IP/account.
   - Hard execution timeout budget (e.g. 8000ms default; 60000ms max for SSE streams) aborting runaway operations.
4. **Periodic 30-Second SSE Heartbeat**:
   - Real-time streams must emit `: heartbeat <timestamp>\n\n` every 30 seconds to prevent edge proxy timeouts while keeping idle payload size under 25 bytes.

---

## 3. AUDIT & REMEDIATION WORKFLOW

1. **Scan Client Hooks for Unclosed EventSources**:
   ```bash
   grep -rn "new EventSource" src/ hooks/ components/
   ```
   Ensure every occurrence has an `onerror` handler calling `.close()` and setting a circuit breaker.
2. **Scan for Aggressive Polling Loops**:
   ```bash
   python3 checklists/08_api_security_governance.py .
   ```
3. **Remediate with Canonical Hook**:
   Replace flawed hooks with the canonical `useRealtimeApiSync.ts` implementation (180 lines, Law C compliant).
4. **Validate Route Governance**:
   Ensure 100% of API endpoints enforce Gate 0 (abuse detection) and Gate 4 (sliding window rate limiting).

---

## 4. VERIFICATION GATE

The agent must run:
```bash
python3 checklists/08_api_security_governance.py .
```
Expected result: **PASSED | Score: 100.0% | Errors: 0**.
