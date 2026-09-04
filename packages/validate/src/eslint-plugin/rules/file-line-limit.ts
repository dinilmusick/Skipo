import type { Rule } from 'eslint';

export const fileLineLimit: Rule.RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforces maximum lines per file',
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: { type: 'number' },
        },
        additionalProperties: false,
      }
    ],
  },
  create(context) {
    const max = context.options[0]?.max || 200;
    
    return {
      Program(node) {
        const lines = context.sourceCode.lines;
        if (lines.length > max) {
          context.report({
            node,
            message: `File exceeds line limit of ${max} (has ${lines.length} lines).`,
          });
        }
      }
    };
  },
};
