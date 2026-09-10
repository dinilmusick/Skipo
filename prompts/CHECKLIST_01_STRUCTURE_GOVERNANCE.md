# TASK CHECKLIST 01: PROJECT ARCHITECTURE & STRUCTURAL GOVERNANCE

$$\text{StructureGate}(\mathcal{P}) = \begin{cases} 
\text{PASS} & \text{if } \text{DecoupledPlanes}(\mathcal{P}) \wedge \text{AnchoredGitignore}(\mathcal{P}) \wedge \text{DirectoryDocs}(\mathcal{P}) \\
\text{BLOCK} & \text{otherwise}
\end{cases}$$

## 1. Prescriptive Structural Invariants (Blocking)

1. **Anti-Monolith Mandate**:
   - Monolithic flat `src/` directories are strictly prohibited.
   - Code must be decoupled into distinct planes: `src/frontend` and `src/backend` (or `packages/*` monorepo structure, or `entities/*` for KrnlTS).
   - If you encounter a monolithic `src/`, you **MUST refactor the folder layout before implementing feature code**.
2. **Anchored Output Law**:
   - Build outputs in `.gitignore` must be anchored with leading slashes: `"/dist/"`, `"/.next/"`, `"/out/"` (not `"dist/"`).
3. **Directory Markdown Explanations**:
   - Every top-level concept directory must contain a `README.md` or `SKILL.md` explaining its architectural role.

---

## 2. Dynamic Execution Gate

Run the dynamic validator script for this aspect:

### Google AI Studio (Python Code Execution):
```python
import subprocess
result = subprocess.run(["python3", "checklists/01_structure_governance.py", "."], capture_output=True, text=True)
print(result.stdout)
assert result.returncode == 0, "Structural governance validation failed!"
```

### Local CLI / Terminal:
```bash
python3 checklists/01_structure_governance.py .
```

---

## 3. Agent Protocol
- If exit code != 0, inspect the reported file paths and restructure the directory hierarchy immediately.
- Never proceed to writing application features while structural violations exist.
