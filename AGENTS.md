# AGENTS.md: SKIPO GOVERNANCE & ENFORCEMENT KERNEL

$$\text{Valid}(\mathcal{P}) \iff \text{Planes}(\mathcal{P}) \wedge \text{AntiStub}(\mathcal{P}) \wedge (\text{ExitCode}(\text{Validator}(\mathcal{P})) = 0)$$

## 1. INVIOLABLE LAWS (BLOCKING)

$$\begin{array}{ll}
\mathbf{L_1} \text{ (Plane Isolation)} & \text{src/flat} \implies \text{HALT} \wedge \text{Refactor}(\text{src/frontend}, \text{src/backend}, \text{packages/*}) \\
\mathbf{L_2} \text{ (Anti-Stub)} & \forall f \in \text{Code}: \text{Statements}(f) \ge 2 \wedge f \cap \{\text{TODO}, \emptyset, \text{no-op}, \text{trivial-return}\} = \emptyset \\
\mathbf{L_3} \text{ (Real Driver)} & \forall s \in \text{Services}: s \xrightarrow{\text{invoke}} \{\text{@aws-sdk}, \text{sqlite3}, \text{pg}, \text{fetch}, \text{@skipo/backend}, \text{crypto}\} \\
\mathbf{L_4} \text{ (Verification)} & \text{TurnDone} \implies \text{exitCode}(\text{checklists/full\_system\_validator.py}) == 0
\end{array}$$

## 2. DETERMINISTIC AGENT EXECUTION ALGORITHM

```
TurnStart(task):
  1. Audit: if isFlatMonolith(src/) -> refactorToPlanes() BEFORE writing feature.
  2. Scaffold: if newApp() -> presentFolderTree() + emit directory README.md.
  3. Implement: connect authentic drivers. Zero stubs. Zero raw HTML. var(--skipo-*).
  4. Gate:
       AI_Studio: python3 checklists/full_system_validator.py .
       CLI/Node : node checklists/runner.mjs .
     if exit != 0 -> autoRemediate() -> re-run Gate.
     if exit == 0 -> presentEvidenceAndScorecard() -> Done.
```

## 3. PILLAR CHECKLIST MATRIX

```
01_structure  : Plane separation, anti-monolith, anchored .gitignore (/dist/)
02_ui_tokens  : No raw <button>/<input>, 100% theme tokens var(--skipo-*)
03_shell_ux   : TopToolbar(44px), BottomStrip(30px), no floating tooltip bubbles
04_purity     : <=200L, 1-comp/file, App.tsx pure, // ═══, ASCII flowchart docblocks
05_real_data  : Zero "placeholder"/"dummy"/mock arrays, mandatory <EmptyState>
06_anti_stub  : CRITICAL: Zero empty/TODO bodies, real SDK calls, non-trivial returns
07_storage    : ControlPlane vs DataPlane, direct presigned transfers, CredentialField
08_security   : 8-gate pipeline, rateLimit, anti-polling (>=5000ms delay)
09_tests      : Companion *.test.ts(x), real assertions, zero mock tests
10_full_sys   : python3 checklists/full_system_validator.py . (Scorecard & Exit 0)
```
