# TASK CHECKLIST 08: API SECURITY, RESOURCE GOVERNANCE & ANTI-POLLING

$$\text{RequestLifecycle} \models \text{Gate}_0 \dots \text{Gate}_7 \quad \wedge \quad \text{PollingInterval} \ge 5000\text{ms}$$

## 1. Prescriptive Security Invariants (Blocking)

1. **8-Gate Request Lifecycle**:
   - Every protected API route must enforce the canonical 8 gates:
     - Gate 0: IP Blocklist verification
     - Gate 1: Request schema & method validation
     - Gate 2: Session authentication
     - Gate 3: Role-based authorization
     - Gate 4: Sliding-window rate limiting
     - Gate 5: In-flight concurrency limits & timeouts
     - Gate 6: Application logic execution
     - Gate 7: Security headers & ring-buffer telemetry
2. **Anti-Polling Invariant**:
   - **BANNED**: Aggressive client polling loops (`setInterval` with delays $< 5000\text{ms}$ making network calls).
   - **MANDATORY**: Use Server-Sent Events (SSE), WebSockets, or exponential backoff ($5\text{s} \to 60\text{s}$).
3. **Error Sanitization Invariant**:
   - Never leak raw `error.stack` or internal system traces to the client in HTTP responses.

---

## 2. Dynamic Execution Gate

### Google AI Studio (Python Code Execution):
```python
import subprocess
result = subprocess.run(["python3", "checklists/08_api_security_governance.py", "."], capture_output=True, text=True)
print(result.stdout)
assert result.returncode == 0, "API security & governance validation failed!"
```

### Local CLI / Terminal:
```bash
python3 checklists/08_api_security_governance.py .
```
