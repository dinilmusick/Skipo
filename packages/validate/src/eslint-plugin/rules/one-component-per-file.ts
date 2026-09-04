import type { Rule } from 'eslint';

export const oneComponentPerFile: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'One React component per file',
    },
    schema: [],
  },
  create(context) {
    if (!context.filename.endsWith('.tsx')) return {};
    let componentCount = 0;
    
    return {
      FunctionDeclaration(node) {
        if (node.id && /^[A-Z]/.test(node.id.name)) {
          componentCount++;
        }
      },
      'Program:exit'(node) {
        if (componentCount > 1) {
          context.report({
            node,
            message: `Found ${componentCount} components. Only one component per .tsx file is allowed.`,
          });
        }
      }
    };
  },
};
