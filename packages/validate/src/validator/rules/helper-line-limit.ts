import type { ValidationRule, RuleViolation } from '../types.js';
import type { Project } from 'ts-morph';

export const helperLineLimitRule: ValidationRule = {
  id: 'helper-line-limit',
  description: 'Enforces maximum lines per function body',
  severity: 'warning',
  validate(filePath: string, sourceCode: string, project?: Project): RuleViolation[] {
    if (!project) return [];
    
    const violations: RuleViolation[] = [];
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return violations;

    const limit = 30;

    sourceFile.getFunctions().forEach(func => {
      const body = func.getBody();
      if (body) {
        const text = body.getText();
        const lines = text.split('\n').length;
        if (lines > limit) {
          violations.push({
            ruleId: this.id,
            severity: this.severity,
            message: `Function ${func.getName() || 'anonymous'} body exceeds ${limit} lines (has ${lines})`,
            filePath,
            line: func.getStartLineNumber(),
            suggestion: 'Refactor into smaller helper functions.',
          });
        }
      }
    });

    return violations;
  }
};
