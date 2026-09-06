import type { ValidationRule, RuleViolation } from '../types.js';
import type { Project } from 'ts-morph';

export const importSuffixRule: ValidationRule = {
  id: 'import-suffix',
  description: 'Enforces .js extensions on relative imports',
  severity: 'warning',
  validate(filePath: string, _sourceCode: string, project?: Project): RuleViolation[] {
    if (!project) return [];
    
    const violations: RuleViolation[] = [];
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return violations;

    const imports = sourceFile.getImportDeclarations();
    imports.forEach(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      if (moduleSpecifier.startsWith('.') && !moduleSpecifier.endsWith('.js') && !moduleSpecifier.endsWith('.css') && !moduleSpecifier.endsWith('.json')) {
        violations.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Relative import "${moduleSpecifier}" must end with .js`,
          filePath,
          line: imp.getStartLineNumber(),
          suggestion: 'Append .js to the import path for NodeNext compatibility.',
        });
      }
    });

    return violations;
  }
};
