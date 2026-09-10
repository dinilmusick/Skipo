# TASK CHECKLIST 10: FULL-SYSTEM ARCHITECTURAL AUDIT & GATE PROTOCOL

$$\text{TaskCompletionGate}(\mathcal{P}) = \begin{cases}
\text{APPROVED} & \text{if } \forall i \in \{1 \dots 9\}: \text{Errors}(\text{Aspect}_i) = 0 \wedge \text{SystemScore} \ge 90\% \\
\text{BLOCKED} & \text{otherwise}
\end{cases}$$

## 1. Master Pipeline Protocol

Before submitting any code change, feature completion, or refactor to the user, you **MUST execute the full-system validation pipeline**.
This orchestrates all 9 architectural pillars:
1. `Aspect 01: Structure & Governance` (Scaffold, planes, gitignore)
2. `Aspect 02: UI Primitives & Themes` (Zero-custom UI, 100% theme tokens)
3. `Aspect 03: Layout Shell Invariants` (TopToolbar, BottomStrip, anti-nested tabs)
4. `Aspect 04: Code Limits & Purity` (Line limits, one component/file, flowcharts)
5. `Aspect 05: Real Data & Anti-Mock` (Zero placeholder tokens, authentic empty states)
6. `Aspect 06: Anti-Stub & Asset Depth` (**CRITICAL**: Zero stubs, non-trivial returns, real SDKs)
7. `Aspect 07: Backend Storage Decoupling` (Control Plane vs Data Plane, presigned transfers)
8. `Aspect 08: API Security & Governance` (8-gate request lifecycle, anti-polling)
9. `Aspect 09: Test Coverage Integrity` (Companion tests, anti-test-stub)

---

## 2. Dynamic Execution Gate

### Google AI Studio (Python Code Execution):
```python
import subprocess
result = subprocess.run(["python3", "checklists/full_system_validator.py", "."], capture_output=True, text=True)
print(result.stdout)
assert result.returncode == 0, "Full-system architectural audit failed! Auto-remediate violations."
```

### Local CLI / Terminal:
```bash
# Pure Python execution
python3 checklists/full_system_validator.py .

# Node.js ESM bridge execution
node checklists/runner.mjs .
```

---

## 3. Mandatory Compliance Scorecard
You must include the executive compliance scorecard emitted by the validator in your final response to the user as verifiable proof of compliance.
