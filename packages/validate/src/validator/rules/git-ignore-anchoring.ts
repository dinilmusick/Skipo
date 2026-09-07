import type { ValidationRule, RuleViolation } from '../types.js';
import * as path from 'path';

export const gitIgnoreAnchoringRule: ValidationRule = {
  id: 'git-ignore-anchoring',
  description: 'Ensures .gitignore files anchor output directories (/dist/) to prevent masking nested package dist directories',
  severity: 'error',
  validate(filePath: string, sourceCode: string): RuleViolation[] {
    const fileName = path.basename(filePath);
    if (fileName !== '.gitignore') return [];

    const violations: RuleViolation[] = [];
    const lines = sourceCode.split('\n');

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      // Detect unanchored dist or dist/ patterns
      if (trimmed === 'dist' || trimmed === 'dist/' || trimmed === 'dist/**') {
        violations.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Unanchored gitignore pattern "${trimmed}" masks nested package distribution directories (e.g. packages/*/dist).`,
          filePath,
          line: index + 1,
          suggestion: 'Anchor pattern with leading slash: "/dist/" instead of "dist/".',
        });
      }
    });

    return violations;
  }
};
