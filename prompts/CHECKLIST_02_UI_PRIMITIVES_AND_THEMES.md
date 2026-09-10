# TASK CHECKLIST 02: UI PRIMITIVES & THEME TOKEN SEMANTICS

$$\forall \text{Element } e \in \text{UI}: e \notin \{\text{button}, \text{input}, \text{select}, \text{textarea}\} \wedge \forall \text{Color } c \in \text{Styles}: c = \text{var}(--\text{skipo}-*)$$

## 1. Prescriptive UI Invariants (Blocking)

1. **Zero-Custom-UI Mandate**:
   - **BANNED**: Raw HTML `<button>`, `<input>`, `<select>`, `<textarea>`, or clickable `<div onClick>`.
   - **MANDATORY**: Import standard `@skipo/ui` primitives:
     - `BaseButton`, `IconOnlyButton`
     - `BaseInput`, `CredentialField`
     - `BaseSelect`, `BaseTextarea`, `BaseToggle`, `BaseBadge`, `BaseCard`
2. **100% Theme Token Semantics**:
   - **BANNED**: Raw hardcoded hex colors (`#hex`), `rgb()`, `rgba()`, `hsl()` outside token definition files.
   - **MANDATORY**: Consume CSS variables from `<SkipoThemeProvider>`:
     - `--skipo-surface`, `--skipo-matte-bg`, `--skipo-accent`, `--skipo-accent-glow`, `--skipo-border-color`, `--skipo-text`, `--skipo-text-muted`

---

## 2. Dynamic Execution Gate

### Google AI Studio (Python Code Execution):
```python
import subprocess
result = subprocess.run(["python3", "checklists/02_ui_primitives_themes.py", "."], capture_output=True, text=True)
print(result.stdout)
assert result.returncode == 0, "UI primitives & theme validation failed!"
```

### Local CLI / Terminal:
```bash
python3 checklists/02_ui_primitives_themes.py .
```

---

## 3. Agent Protocol
- Replace every raw HTML element with the corresponding `@skipo/ui` component.
- Convert all hardcoded color literals to `var(--skipo-*)` tokens.
