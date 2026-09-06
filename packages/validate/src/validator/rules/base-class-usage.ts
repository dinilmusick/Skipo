import type { ValidationRule, RuleViolation } from '../types.js';
import type { Project } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

export const baseClassUsageRule: ValidationRule = {
  id: 'base-class-usage',
  description: 'Enforces usage of base components over raw HTML elements',
  severity: 'warning',
  validate(filePath: string, _sourceCode: string, project?: Project): RuleViolation[] {
    if (!filePath.endsWith('.tsx') || !project) return [];
    if (filePath.includes('packages/ui/src/components/base/')) return [];
    
    const violations: RuleViolation[] = [];
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return violations;

    const forbiddenElements: Record<string, string> = {
      'button': 'BaseButton',
      'input': 'BaseInput',
      'textarea': 'BaseTextarea',
      'select': 'BaseSelect'
    };

    const checkElement = (elementName: string, line: number) => {
      if (forbiddenElements[elementName]) {
        violations.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Raw HTML element <${elementName}> used instead of base component.`,
          filePath,
          line,
          suggestion: `Import and use ${forbiddenElements[elementName]} from @skipo/ui instead.`
        });
      }
    };

    sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).forEach(elem => {
      checkElement(elem.getTagNameNode().getText(), elem.getStartLineNumber());
    });

    sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).forEach(elem => {
      checkElement(elem.getTagNameNode().getText(), elem.getStartLineNumber());
    });

    return violations;
  }
};
