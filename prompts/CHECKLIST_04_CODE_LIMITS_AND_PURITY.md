# TASK CHECKLIST 04: CODE LIMITS, PURITY & DOCUMENTATION STANDARDS

$$\forall f \in \text{Files}: |\text{Lines}(f)| \le 200 \wedge \text{Components}(f) \le 1 \wedge \text{DocblockWithFlowchart}(f)$$

## 1. Prescriptive Purity Invariants (Blocking)

1. **Strict File Line Limit**:
   - Every file MUST NOT exceed 200 lines (150 lines for pure helper functions).
   - If a file exceeds 200 lines, decompose it into sub-components, extracted hooks, or domain logic modules.
2. **One Component Per File**:
   - Every `.tsx` file MUST export at most one React component. Auxiliary sub-components must be extracted into sibling files.
3. **Top-Level File Purity**:
   - `App.tsx` must contain only imports and top-level shell composition. Zero inline state machines, direct fetch queries, or data mutations.
4. **Docblocks & ASCII Flowcharts**:
   - Every exported class and function must include a JSDoc docblock describing parameters, return type, and an ASCII flowchart visualizing internal branching.
5. **Bold Unicode Section Demarcation**:
   - Files $>60$ lines must use bold border dividers:
     `// ══════════════════════════════════════════════════════════════════════════════════════════`
6. **Descriptive Long Naming**:
   - Cryptic abbreviations (`tmp`, `val`, `cb`, `fn`, `cnt`) are strictly forbidden. Use long, descriptive names.

---

## 2. Dynamic Execution Gate

### Google AI Studio (Python Code Execution):
```python
import subprocess
result = subprocess.run(["python3", "checklists/04_code_limits_purity.py", "."], capture_output=True, text=True)
print(result.stdout)
assert result.returncode == 0, "Code limits & purity validation failed!"
```

### Local CLI / Terminal:
```bash
python3 checklists/04_code_limits_purity.py .
```
