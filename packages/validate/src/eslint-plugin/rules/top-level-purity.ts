import type { Rule } from 'eslint';

export const topLevelPurity: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Entry files must only compose and export',
    },
    schema: [],
  },
  create(context) {
    const isEntry = context.filename.endsWith('index.ts') || context.filename.endsWith('App.tsx') || context.filename.endsWith('server.ts') || context.filename.endsWith('layout.tsx') || context.filename.endsWith('page.tsx');
    if (!isEntry) return {};
    
    return {
      // Simplified check for now
    };
  },
};
