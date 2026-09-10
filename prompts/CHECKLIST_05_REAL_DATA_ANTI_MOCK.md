# TASK CHECKLIST 05: REAL DATA & ANTI-PLACEHOLDER INVARIANT (ZERO-MOCK)

$$\text{Tokens}(\text{Codebase}) \cap \{\text{"placeholder"}, \text{"lorem ipsum"}, \text{"mock"}, \text{"dummy"}, \text{"sample item"}\} = \emptyset$$

## 1. Prescriptive Real Data Invariants (Blocking)

1. **Absolute Ban on Placeholder Data**:
   - The AI agent is strictly forbidden from injecting fake computational outputs, synthetic charts, or mock arrays.
   - Prohibited string literals: `"placeholder"`, `"lorem ipsum"`, `"mock data"`, `"dummy"`, `"test user"`, `"sample item"`.
2. **Ban on Static Dummy Arrays Simulating Tables**:
   - Never write `const items = [{ id: 1, name: "Item 1" }]` to simulate backend records.
3. **Mandatory Authentic Empty States**:
   - When real data is absent or unconfigured, render an explicit `@skipo/ui` `<EmptyState>` with a configuration/retry action, or an informative `<CopyableErrorAlert>`.
   - Never synthesize fake listings or data to simulate a populated view.

---

## 2. Dynamic Execution Gate

### Google AI Studio (Python Code Execution):
```python
import subprocess
result = subprocess.run(["python3", "checklists/05_real_data_anti_mock.py", "."], capture_output=True, text=True)
print(result.stdout)
assert result.returncode == 0, "Real data anti-mock validation failed!"
```

### Local CLI / Terminal:
```bash
python3 checklists/05_real_data_anti_mock.py .
```
