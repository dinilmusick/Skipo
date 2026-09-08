import type { Rule } from 'eslint';

const FORBIDDEN_PLACEHOLDER_REGEX = /\b(placeholder|lorem\s+ipsum|mock_data|dummy_data|fake_telemetry|fake_listing|sample\s+item|dummy\s+value|test\s+user|todo\s+implement)\b/i;

export const noPlaceholderData: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prohibits synthetic placeholders, dummy telemetry, and fake listings in production code',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || '';
    if (filename.includes('.test.') || filename.includes('.spec.') || filename.includes('/__tests__/')) {
      return {};
    }

    return {
      Literal(node: any) {
        if (typeof node.value === 'string' && FORBIDDEN_PLACEHOLDER_REGEX.test(node.value)) {
          context.report({
            node,
            message: `Prohibited placeholder string "${node.value}". Real backend data or <EmptyState> required.`,
          });
        }
      },
      JSXText(node: any) {
        const text = (node.value || '').trim();
        if (text && FORBIDDEN_PLACEHOLDER_REGEX.test(text)) {
          context.report({
            node,
            message: `Prohibited placeholder UI text "${text}". Real backend data or <EmptyState> required.`,
          });
        }
      }
    };
  },
};
