# TASK CHECKLIST 09: TEST COVERAGE INTEGRITY & ANTI-TEST-STUB

$$\forall \text{Module } m: \exists \text{Test}(m) \quad \wedge \quad \forall t \in \text{Tests}: \text{Assertions}(t) \ge 1 \wedge t \not\models \text{expect}(\text{true}).\text{toBe}(\text{true})$$

## 1. Prescriptive Testing Invariants (Blocking)

1. **Companion Test File Mandate**:
   - Every feature module, sub-app, entity functionality, and UI component MUST have a companion `*.test.ts(x)` unit test suite.
2. **Anti-Test-Stub Invariant**:
   - **BANNED**: Trivial mock assertions (e.g. `expect(true).toBe(true)`, `expect(1).toBe(1)`).
   - **BANNED**: Empty test blocks (`it("should work", () => {})`).
   - **BANNED**: Test files with zero assertion statements.
3. **Verifiable Behavioral Proving**:
   - Tests must exercise real component rendering, simulate user interaction events, verify state transitions, or validate output contracts against Zod schemas.

---

## 2. Dynamic Execution Gate

### Google AI Studio (Python Code Execution):
```python
import subprocess
result = subprocess.run(["python3", "checklists/09_test_coverage_integrity.py", "."], capture_output=True, text=True)
print(result.stdout)
assert result.returncode == 0, "Test coverage integrity validation failed!"
```

### Local CLI / Terminal:
```bash
python3 checklists/09_test_coverage_integrity.py .
```
