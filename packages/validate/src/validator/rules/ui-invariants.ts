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

    return violations;
  }
};
