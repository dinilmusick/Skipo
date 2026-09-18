import type { ValidationRule, RuleViolation } from '../types.js';
import type { Project } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

export const uiInvariantsRule: ValidationRule = {
  id: 'ui-invariants',
  description: 'Enforces anti-nested tabs, icon-only buttons, and zero-floating-tooltip invariants',
  severity: 'error',
  validate(filePath: string, _sourceCode: string, project?: Project): RuleViolation[] {
    if (!filePath.endsWith('.tsx') || !project) return [];

    const violations: RuleViolation[] = [];
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return violations;

    // 1. Invariant: Anti-nested tabs
    const tabContainers = sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
      .concat(sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement) as any)
      .filter(elem => elem.getTagNameNode().getText() === 'TabContainer');

    tabContainers.forEach(container => {
      const parent = container.getFirstAncestorByKind(SyntaxKind.JsxElement);
      if (parent) {
        const opening = parent.getOpeningElement();
        if (opening.getTagNameNode().getText() === 'TabContainer') {
          violations.push({
            ruleId: 'ui-invariants',
            severity: 'error',
            message: 'Nested TabContainer detected. Nested tabs of any kind are strictly forbidden.',
            filePath,
            line: container.getStartLineNumber(),
            suggestion: 'Move view navigation to the single top-level TopToolbar with flat tabs.'
          });
        }
      }
    });

    // 2. Invariant: No floating tooltip bubbles
    sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).forEach(lit => {
      const text = lit.getLiteralValue();
      if (text.includes('skipo-tooltip--') || (text === 'skipo-tooltip' && !filePath.includes('BaseTooltip'))) {
        violations.push({
          ruleId: 'ui-invariants',
          severity: 'error',
          message: 'Floating tooltip bubble class used. Floating tooltips are forbidden.',
          filePath,
          line: lit.getStartLineNumber(),
          suggestion: 'Use BottomStrip with hover inspection text instead of floating text bubbles.'
        });
      }
    });

    // 3. Invariant: BottomStrip center slot exclusivity for dynamic hover text
    const bottomStrips = sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
      .concat(sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement) as any)
      .filter(elem => elem.getTagNameNode().getText() === 'BottomStrip');

    bottomStrips.forEach(elem => {
      const centerAttr = elem.getAttribute('centerSlot');
      if (centerAttr) {
        const text = centerAttr.getText();
        if (text.includes('Button') || text.includes('button') || text.includes('onClick') || text.includes('input')) {
          violations.push({
            ruleId: 'ui-invariants',
            severity: 'error',
            message: 'BottomStrip centerSlot must not contain interactive buttons or controls. The middle area is reserved exclusively for cursor hover inspection labels.',
            filePath,
            line: centerAttr.getStartLineNumber(),
            suggestion: 'Remove interactive buttons or actions from centerSlot. Use BottomStripContext.setInspectionText for dynamic hover feedback.'
          });
        }
      }
    });

    // 4. Invariant: 4-Word Maximum UI Text Label Cap (Law L18)
    const actionElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement)
      .filter(elem => {
        const tagName = elem.getOpeningElement().getTagNameNode().getText();
        return ['BaseButton', 'BrutalistButton', 'BaseBadge', 'button'].includes(tagName);
      });

    actionElements.forEach(elem => {
      const textNodes = elem.getJsxChildren().filter(c => c.getKind() === SyntaxKind.JsxText);
      textNodes.forEach(tNode => {
        const raw = tNode.getText().trim();
        if (raw) {
          const words = raw.split(/\s+/).filter(w => /[a-zA-Z0-9]/.test(w));
          if (words.length > 4) {
            violations.push({
              ruleId: 'ui-invariants',
              severity: 'error',
              message: `UI action/badge label "${words.slice(0, 5).join(' ')}..." exceeds 4-word maximum limit (${words.length} words).`,
              filePath,
              line: tNode.getStartLineNumber(),
              suggestion: 'Cap visible UI label to <=4 words. Move detailed guidance to element description (D+Hover mode).'
            });
          }
        }
      });
    });

    return violations;
  }
};
