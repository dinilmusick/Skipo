---
name: code-limits-guidelines
description: Directives for file length limits (200 lines max), top-level file purity, one-component-per-file, and modularity across frontend and backend.
---

# CODE LIMITS & MODULARITY (DENSE)

$$\forall f \in \text{Files}: |\text{Lines}(f)| \le 200 \wedge \text{Components}(f) \le 1 \wedge \text{Purity}(\text{TopLevel})$$

## 1. TOP-LEVEL FILE PURITY LAW
Files: `App.tsx`, `index.tsx`, `main.ts`, `server.ts`.
- **ALLOWED**: Imports + Single default export composing root shell.
- **FORBIDDEN**: Inline JSX tags (`<div>`, `<button>`), inline styles, hooks (`useState`, `useEffect`), direct fetches, inline event handlers.

```tsx
// Canonical App.tsx
import React from "react";
import { AppShell } from "./components/AppShell/AppShell";
export default function App() { return <AppShell />; }
```

## 2. MULTI-TIER LINE LIMITS

```
Global File Limit     : <= 200 lines (hard limit, frontend & backend).
Helper Functions      : <= 150 lines per file (max 30 lines per individual helper).
Main Logic Skeletons  : <= 20 lines of sequential flow before delegating to helper.
```

## 3. ONE COMPONENT / ONE MODULE PER FILE
- Frontend: 1 React component per `.tsx` file (plus its Props interface).
- Backend: 1 service, 1 controller, or 1 route factory per `.ts` file.
- Multiple component exports in a single file are strictly prohibited.

## 4. CHECKLIST GATE
`python3 checklists/04_code_limits_purity.py .`
