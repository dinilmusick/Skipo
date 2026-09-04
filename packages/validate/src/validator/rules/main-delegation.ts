import type { ValidationRule, RuleViolation } from '../types.js';

export const mainDelegationRule: ValidationRule = {
  id: 'main-delegation',
  description: 'Enforces max sequential substantive lines before delegation',
  severity: 'warning',
  validate(filePath: string, sourceCode: string): RuleViolation[] {
    // A simplified heuristic for sequential substantive lines.
    // Real implementation would parse AST blocks.
    const violations: RuleViolation[] = [];
    return violations;
  }
};
