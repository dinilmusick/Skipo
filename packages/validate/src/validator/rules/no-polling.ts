import type { ValidationRule, RuleViolation } from '../types.js';

export const noPollingRule: ValidationRule = {
  id: 'no-polling',
  description: 'Bans setInterval and polling mechanisms',
  severity: 'error',
  validate(filePath: string, sourceCode: string): RuleViolation[] {
    // Exempt rule implementation files themselves from self-flagging
    if (filePath.includes('/rules/') || filePath.includes('__tests__') || filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx')) {
      return [];
    }

    const violations: RuleViolation[] = [];
    const lines = sourceCode.split('\n');
    
    lines.forEach((line, index) => {
      if (line.includes('setInterval') || line.includes('window.setInterval')) {
        violations.push({
          ruleId: this.id,
          severity: this.severity,
          message: 'Polling mechanisms like setInterval are banned.',
          filePath,
          line: index + 1,
          suggestion: 'Use reactive event streams or event-driven patterns instead.',
        });
      }
    });

    return violations;
  }
};
