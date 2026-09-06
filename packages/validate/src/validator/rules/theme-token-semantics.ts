import type { ValidationRule, RuleViolation } from '../types.js';
import type { Project } from 'ts-morph';

export const themeTokenSemanticsRule: ValidationRule = {
  id: 'theme-token-semantics',
  description: 'Enforces usage of standardized --skipo-* semantic tokens over hardcoded colors',
  severity: 'warning',
  validate(filePath: string, sourceCode: string, _project?: Project): RuleViolation[] {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.css')) return [];
    // Ignore theme definition files themselves
    if (filePath.includes('theme/tokens') || filePath.includes('theme/ThemePackLoader') || filePath.includes('theme/types')) {
      return [];
    }

    const violations: RuleViolation[] = [];
    const lines = sourceCode.split('\n');

    const hexColorRegex = /#([0-9a-fA-F]{3,8})\b/;
    const rgbColorRegex = /rgba?\([^)]+\)/;

    lines.forEach((line, index) => {
      // Allow CSS variable definitions or comments
      if (line.includes('var(--skipo-') || line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
        return;
      }

      if (hexColorRegex.test(line) && !line.includes('KNOWN_CREDENTIAL_URLS')) {
        violations.push({
          ruleId: 'theme-token-semantics',
          severity: 'warning',
          message: 'Hardcoded color detected instead of standardized --skipo-* semantic theme token.',
          filePath,
          line: index + 1,
          suggestion: 'Replace with var(--skipo-accent), var(--skipo-bg), var(--skipo-surface), etc.'
        });
      } else if (rgbColorRegex.test(line) && !line.includes('var(--skipo-')) {
        violations.push({
          ruleId: 'theme-token-semantics',
          severity: 'warning',
          message: 'Hardcoded rgb/rgba color detected instead of standardized --skipo-* semantic token.',
          filePath,
          line: index + 1,
          suggestion: 'Use semantic theme CSS tokens.'
        });
      }
    });

    return violations;
  }
};
