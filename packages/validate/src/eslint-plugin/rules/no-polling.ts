import type { Rule } from 'eslint';

export const noPolling: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Bans setInterval and polling mechanisms',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' && node.callee.name === 'setInterval' ||
          (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier' && node.callee.property.name === 'setInterval')
        ) {
          context.report({
            node,
            message: 'Polling mechanisms like setInterval are banned. Use event-driven patterns instead.',
          });
        }
      }
    };
  },
};
