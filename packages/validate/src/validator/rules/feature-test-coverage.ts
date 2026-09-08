import type { ValidationRule, RuleViolation } from '../types.js';
import type { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

function isProductionComponent(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, '/');
  if (norm.includes('/__tests__/') || norm.includes('.test.') || norm.includes('.spec.')) return false;
  if (norm.includes('packages/validate/') || norm.includes('packages/create-skipo/')) return false;
  return norm.endsWith('.tsx') || (norm.includes('/api/') && norm.endsWith('.ts'));
}

export const featureTestCoverageRule: ValidationRule = {
  id: 'feature-test-coverage',
  description: 'Enforces that production features and components have companion test suites',
  severity: 'warning',
  validate(filePath: string, _sourceCode: string, _project?: Project): RuleViolation[] {
    if (!isProductionComponent(filePath)) return [];

    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    
    // Look for companion test in same dir or __tests__ dir
    const potentialTests = [
      path.join(dir, `${baseName}.test.ts`),
      path.join(dir, `${baseName}.test.tsx`),
      path.join(dir, `${baseName}.spec.ts`),
      path.join(dir, `${baseName}.spec.tsx`),
      path.join(dir, '__tests__', `${baseName}.test.ts`),
      path.join(dir, '__tests__', `${baseName}.test.tsx`),
      path.join(dir, '..', '__tests__', `${baseName}.test.ts`),
      path.join(dir, '..', '__tests__', `${baseName}.test.tsx`)
    ];

    const hasTest = potentialTests.some(testPath => fs.existsSync(testPath));

    if (!hasTest) {
      return [{
        ruleId: this.id,
        severity: this.severity,
        message: `Feature module "${baseName}" is missing a dedicated test file. Work is not done without end-to-end testing.`,
        filePath,
        suggestion: `Create a companion test suite at ${path.join(dir, '__tests__', `${baseName}.test.ts`)} and verify with pnpm test.`
      }];
    }

    return [];
  }
};
