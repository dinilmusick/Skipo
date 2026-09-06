import type { ValidationRule, RuleViolation } from '../types.js';
import type { Project } from 'ts-morph';

export const oneComponentRule: ValidationRule = {
  id: 'one-component',
  description: 'One React component per file',
  severity: 'error',
  validate(filePath: string, _sourceCode: string, project?: Project): RuleViolation[] {
    if (!filePath.endsWith('.tsx') || !project) return [];
    
    const violations: RuleViolation[] = [];
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return violations;

    // Simple AST heuristic
    let componentCount = 0;
    sourceFile.getFunctions().forEach(func => {
      const name = func.getName();
      if (name && /^[A-Z]/.test(name) && func.getBodyText()?.includes('<')) {
        componentCount++;
      }
    });

    if (componentCount > 1) {
      violations.push({
        ruleId: this.id,
        severity: this.severity,
        message: `Found ${componentCount} components in file. Only one component per .tsx file is allowed.`,
        filePath,
        suggestion: 'Extract additional components into their own files.',
      });
    }

    return violations;
  }
};
