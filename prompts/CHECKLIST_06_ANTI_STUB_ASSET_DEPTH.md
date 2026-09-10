# TASK CHECKLIST 06: ANTI-STUB & GENUINE IMPLEMENTATION INTEGRITY

$$\forall \text{Function } f \in \text{Codebase}: \text{Statements}(f) \ge 2 \wedge \text{Logic}(f) \ne \emptyset \wedge \text{ConnectsToRealDrivers}(f)$$

> [!CRITICAL]
> **ANTI-STUB LAW FOR AI CODERS**:
> AI coders notoriously emit superficial "stubs" (empty function bodies, TODO comments, hollow returns, and no-op event listeners). In Skipo and KrnlTS, **all code assets must perform genuine computational processing, validate inputs, mutate real state, or connect to authentic underlying services/libraries**. Stubs are strictly forbidden.

---

## 1. Inviolable Anti-Stub Invariants (Blocking)

1. **Zero Empty / TODO Function Bodies**:
   - ❌ **BANNED**: `function doOperation() {}`
   - ❌ **BANNED**: `function computeResult() { /* TODO: implement */ }`
   - ❌ **BANNED**: `throw new Error("Not implemented")` or `throw new Error("TODO")`
   - **MANDATORY**: Implement complete, robust operational logic, input parsing, error handling, and state mutation.
2. **Zero Trivial Dummy Returns**:
   - ❌ **BANNED**: Functions accepting arguments but immediately returning static hardcoded primitives (`return null;`, `return {};`, `return [];`, `return true;`, `return "";`) without processing.
   - **MANDATORY**: Inspect inputs, execute business algorithms, or query real databases/storage, and return computed results.
3. **Zero No-Op Event Handlers**:
   - ❌ **BANNED**: `onClick={() => {}}`, `onChange={() => {}}`, or empty event listener callbacks.
   - **MANDATORY**: Wire every interactive listener to real state transitions, store dispatches, or event emitters.
4. **Real Service & Library Connectivity**:
   - Backend services, repositories, and API clients MUST genuinely import and execute real drivers and SDKs:
     - `@aws-sdk`, `sqlite3`, `pg`, `fetch`, `@skipo/backend/storage`, `@skipo/backend/auth`, `crypto`, `fs`
   - Never simulate backend interactions with fake mock timeouts.
5. **API Route Handler Depth**:
   - Next.js serverless route handlers (`route.ts`) MUST:
     - Authenticate the session token or role
     - Parse request body/query (`request.json()`)
     - Execute the transaction in the database or storage layer
     - Return appropriate status codes (`400`, `401`, `403`, `500`) with sanitized error messages.
     - Never return hardcoded `{ success: true }` dummy objects on line 2.

---

## 2. Dynamic Execution Gate

### Google AI Studio (Python Code Execution):
```python
import subprocess
result = subprocess.run(["python3", "checklists/06_anti_stub_asset_depth.py", "."], capture_output=True, text=True)
print(result.stdout)
assert result.returncode == 0, "Anti-stub validation failed! Resolve all hollow stubs before proceeding."
```

### Local CLI / Terminal:
```bash
python3 checklists/06_anti_stub_asset_depth.py .
```

---

## 3. Agent Protocol
- If any function is flagged as a stub or dummy return, replace it with authentic business logic.
- Verify that every service asset actually calls underlying drivers or storage APIs.
