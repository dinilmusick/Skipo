import type { Rule } from 'eslint';

export const helperPurity: Rule.RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforces maximum lines per function body',
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
    const max = context.options[0]?.max || 30;
    
    function checkFunction(node: any) {
      if (!node.body || node.body.type !== 'BlockStatement') return;
      const lines = node.body.loc.end.line - node.body.loc.start.line + 1;
      if (lines > max) {
        context.report({
          node,
          message: `Function body exceeds ${max} lines (has ${lines} lines).`,
        });
      }
    }
    
    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
};
