import { fileLineLimit } from './rules/file-line-limit.js';
import { oneComponentPerFile } from './rules/one-component-per-file.js';
import { topLevelPurity } from './rules/top-level-purity.js';
import { noPolling } from './rules/no-polling.js';
import { importSuffix } from './rules/import-suffix.js';
import { helperPurity } from './rules/helper-purity.js';
import { noPlaceholderData } from './rules/no-placeholder-data.js';

export const rules = {
  'file-line-limit': fileLineLimit,
  'one-component-per-file': oneComponentPerFile,
  'top-level-purity': topLevelPurity,
  'no-polling': noPolling,
  'import-suffix': importSuffix,
  'helper-purity': helperPurity,
  'no-placeholder-data': noPlaceholderData,
};

export const configs = {
  recommended: {
    plugins: {
      '@skipo': { rules }
    },
    rules: {
      '@skipo/file-line-limit': ['error', { max: 200 }],
      '@skipo/one-component-per-file': 'error',
      '@skipo/top-level-purity': 'warn',
      '@skipo/no-polling': 'error',
      '@skipo/import-suffix': 'warn',
      '@skipo/helper-purity': ['warn', { max: 30 }],
      '@skipo/no-placeholder-data': 'error',
    },
  },
};

export default { rules, configs };
