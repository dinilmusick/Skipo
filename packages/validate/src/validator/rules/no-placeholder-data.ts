import type { ValidationRule, RuleViolation } from '../types.js';
import type { Project } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';

const FORBIDDEN_PLACEHOLDER_REGEX = /\b(placeholder|lorem\s+ipsum|mock_data|dummy_data|fake_telemetry|fake_listing|sample\s+item|dummy\s+value|test\s+user|todo\s+implement)\b/i;

function isExemptPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.includes('/__tests__/') ||
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.includes('packages/validate/src/')
  );
}

export const noPlaceholderDataRule: ValidationRule = {
  id: 'no-placeholder-data',
  description: 'Prohibits synthetic placeholders, dummy telemetry, and fake listings in production code',
  severity: 'error',
  validate(filePath: string, _sourceCode: string, project?: Project): RuleViolation[] {
    if (isExemptPath(filePath) || !project) return [];

    const violations: RuleViolation[] = [];
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return violations;

    // Check string literals for forbidden placeholder terms
    sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).forEach(lit => {
      const val = lit.getLiteralValue();
      if (FORBIDDEN_PLACEHOLDER_REGEX.test(val)) {
        violations.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Prohibited placeholder string detected: "${val}". Real data or explicit empty states required.`,
          filePath,
          line: lit.getStartLineNumber(),
          suggestion: 'Fetch real data from backend/database or render an <EmptyState> component.'
        });
      }
    });

    // Check JSX text for placeholder content
    sourceFile.getDescendantsOfKind(SyntaxKind.JsxText).forEach(jsxText => {
      const text = jsxText.getText().trim();
      if (text && FORBIDDEN_PLACEHOLDER_REGEX.test(text)) {
        violations.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Prohibited placeholder UI text detected: "${text}".`,
          filePath,
          line: jsxText.getStartLineNumber(),
          suggestion: 'Render genuine UI data or use @skipo/ui <EmptyState> / <StatusIndicator>.'
        });
      }
    });

    return violations;
  }
};
