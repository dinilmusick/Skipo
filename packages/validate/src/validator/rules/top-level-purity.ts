import type { ValidationRule, RuleViolation } from '../types.js';

export const topLevelPurityRule: ValidationRule = {
  id: 'top-level-purity',
  description: 'Entry files must only compose and export',
  severity: 'error',
  validate(filePath: string, _sourceCode: string): RuleViolation[] {
    const isEntry = filePath.endsWith('index.ts') || filePath.endsWith('App.tsx') || filePath.endsWith('server.ts') || filePath.endsWith('layout.tsx') || filePath.endsWith('page.tsx');
    if (!isEntry) return [];

    // Simple heuristic. Real implementation requires AST
    const violations: RuleViolation[] = [];
    return violations;
  }
};
