import type { ValidationRule, RuleViolation } from '../types.js';

export const fileLineLimitRule: ValidationRule = {
  id: 'file-line-limit',
  description: 'Enforces maximum lines per file',
  severity: 'error',
  validate(filePath: string, sourceCode: string): RuleViolation[] {
    const lines = sourceCode.split('\n');
    const limit = 200; // Configurable later
    if (lines.length > limit) {
      return [{
        ruleId: this.id,
        severity: this.severity,
        message: `File exceeds line limit of ${limit} (has ${lines.length} lines)`,
        filePath,
        suggestion: 'Split into smaller, more focused modules.',
      }];
    }
    return [];
  }
};
