# AGENTS.md: SKIPO GOVERNANCE & ENFORCEMENT KERNEL

$$\text{Valid}(\mathcal{P}) \iff \text{Planes}(\mathcal{P}) \wedge \text{AntiStub}(\mathcal{P}) \wedge \text{DeterministicTooling}(\mathcal{P}) \wedge (\text{ExitCode}(\text{Validator}(\mathcal{P})) = 0)$$

## 1. INVIOLABLE LAWS (BLOCKING)

$$\begin{array}{ll}
\mathbf{L_1} \text{ (Plane Isolation)} & \text{src/flat} \implies \text{HALT} \wedge \text{Mutate}(\text{src/frontend}, \text{src/backend}, \text{packages/*}) \\
\mathbf{L_2} \text{ (Anti-Stub)} & \forall f \in \text{Code}: \text{Statements}(f) \ge 2 \wedge f \cap \{\text{TODO}, \emptyset, \text{no-op}, \text{trivial-return}\} = \emptyset \\
\mathbf{L_3} \text{ (Real Driver)} & \forall s \in \text{Services}: s \xrightarrow{\text{invoke}} \{\text{@aws-sdk}, \text{sqlite3}, \text{pg}, \text{fetch}, \text{@skipo/backend}, \text{crypto}\} \\
\mathbf{L_4} \text{ (Verification)} & \text{TurnDone} \implies \text{exitCode}(\text{checklists/full\_system\_validator.py}) == 0 \\
\mathbf{L_5} \text{ (Deterministic Tooling)} & \forall a \in \text{NewArtifacts}: a \in \text{Generators}(\text{generators/}) \vee a \in \text{Mutators}(\text{mutators/})
\end{array}$$

## 2. DETERMINISTIC AGENT EXECUTION ALGORITHM

```
TurnStart(task):
  1. Route & Advise:
       python3 assistant.py advise "<task description>"
       -> Inspect suggested commands and open linked architectural skill files.

  2. Mutate (if refactoring / migrating existing codebase):
       Flat monoliths    -> python3 assistant.py mutate planes <dir>
       Hardcoded colors  -> python3 assistant.py mutate tokens <dir>
       Missing banners   -> python3 assistant.py mutate sections <dir>
       Files > 200 lines -> python3 assistant.py mutate split <file>
       Full auto-remedy  -> python3 assistant.py mutate all <dir>

  3. Generate (if scaffolding new assets / features / apps):
       Scaffold complete multi-file directory suites (zero manual boilerplate):
       Component suite   -> python3 assistant.py generate component <path> --name <Name>
       Quad-Unit Entity  -> python3 assistant.py generate entity <path> --name <Name>
       Layout Shell      -> python3 assistant.py generate shell <path>
       Node Graph Suite  -> python3 assistant.py generate nodegraph <path> --name <Name>
       Service Driver    -> python3 assistant.py generate driver <path> --name <Name>
       8-Gate Route      -> python3 assistant.py generate route <path> --name <Name>
       Full Sub-App Tree -> python3 assistant.py generate subapp <path> --name <Name>

  4. Specialize & Implement:
       Inject bespoke business logic into the deterministic slots.
       Zero stubs. Zero raw HTML (<button>/<input>). 100% var(--skipo-*). <=200L.

  5. Gate (Mandatory Exit 0):
       python3 assistant.py validate .
       if exit != 0 -> run mutator auto-remediation -> re-test gate.
       if exit == 0 -> present evidence & scorecard -> Done.
```

## 3. ARCHITECTURAL SUBSYSTEM TRIAD

```
checklists/ : Aspect 01-09 Dynamic Python 3 Validators + full_system_validator.py
generators/ : Aspect 01-10 Multi-File Directory Generators + generate.py (SubApp Tree)
mutators/   : Aspect 01-04 Directory Restructuring & Token Normalizers + mutate.py
assistant.py: Master AI Coding Agent Router, Environment Adapter & Skill Guide
```
