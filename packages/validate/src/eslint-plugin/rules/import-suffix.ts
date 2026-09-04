import type { Rule } from 'eslint';

export const importSuffix: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforces .js extensions on relative imports',
    },
    fixable: 'code',
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value as string;
        if (source.startsWith('.') && !source.endsWith('.js') && !source.endsWith('.json') && !source.endsWith('.css')) {
          context.report({
            node,
            message: `Relative import "${source}" must end with .js`,
            fix(fixer) {
              return fixer.replaceText(node.source, `'${source}.js'`);
            }
          });
        }
      }
    };
  },
};
