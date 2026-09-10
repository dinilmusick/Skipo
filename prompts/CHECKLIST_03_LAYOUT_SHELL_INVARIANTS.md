# TASK CHECKLIST 03: LAYOUT SHELL & USER EXPERIENCE INVARIANTS

$$\text{ShellInvariant} = \text{TopToolbar}(44\text{px}) \wedge \text{BottomStrip}(30\text{px}) \wedge \text{AntiNestedTabs} \wedge \text{AntiFloatingBubbles}$$

## 1. Prescriptive Layout Invariants (Blocking)

1. **Anti-Nested Tabs Law**:
   - Primary view navigation MUST be flat and hosted within a single `TopToolbar` (height: 44px) at the top of the viewport.
   - Nested `TabContainer` elements inside drawers, sidebars, or subviews are STRICTLY FORBIDDEN.
2. **Dedicated BottomStrip & Zero Floating Text**:
   - All hover inspection text, element descriptions, and active statuses MUST route through the 30px `BottomStrip` via `BottomStripContext` (`setInspectionText(...)`).
   - Floating tooltip bubbles (`skipo-tooltip` popovers, balloon tooltips) are STRICTLY FORBIDDEN.
3. **Icon-Only Action Buttons**:
   - Toolbar and dock action buttons must contain only monochromatic SVG glyphs (`IconOnlyButton`) without static text labels.
4. **FloatingDetailsPanel Invariant**:
   - Element inspection must use `FloatingDetailsPanel` featuring 8-way resize, draggable header, pin toggle, and geometry persistence (`usePanelGeometry`).

---

## 2. Dynamic Execution Gate

### Google AI Studio (Python Code Execution):
```python
import subprocess
result = subprocess.run(["python3", "checklists/03_layout_shell_invariants.py", "."], capture_output=True, text=True)
print(result.stdout)
assert result.returncode == 0, "Layout shell invariants validation failed!"
```

### Local CLI / Terminal:
```bash
python3 checklists/03_layout_shell_invariants.py .
```
