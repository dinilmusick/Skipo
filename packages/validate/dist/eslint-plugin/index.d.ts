import * as eslint from 'eslint';

declare const rules: {
    'file-line-limit': eslint.Rule.RuleModule;
    'one-component-per-file': eslint.Rule.RuleModule;
    'top-level-purity': eslint.Rule.RuleModule;
    'no-polling': eslint.Rule.RuleModule;
    'import-suffix': eslint.Rule.RuleModule;
    'helper-purity': eslint.Rule.RuleModule;
};
declare const configs: {
    recommended: {
        plugins: {
            '@skipo': {
                rules: {
                    'file-line-limit': eslint.Rule.RuleModule;
                    'one-component-per-file': eslint.Rule.RuleModule;
                    'top-level-purity': eslint.Rule.RuleModule;
                    'no-polling': eslint.Rule.RuleModule;
                    'import-suffix': eslint.Rule.RuleModule;
                    'helper-purity': eslint.Rule.RuleModule;
                };
            };
        };
        rules: {
            '@skipo/file-line-limit': (string | {
                max: number;
            })[];
            '@skipo/one-component-per-file': string;
            '@skipo/top-level-purity': string;
            '@skipo/no-polling': string;
            '@skipo/import-suffix': string;
            '@skipo/helper-purity': (string | {
                max: number;
            })[];
        };
    };
};
declare const _default: {
    rules: {
        'file-line-limit': eslint.Rule.RuleModule;
        'one-component-per-file': eslint.Rule.RuleModule;
        'top-level-purity': eslint.Rule.RuleModule;
        'no-polling': eslint.Rule.RuleModule;
        'import-suffix': eslint.Rule.RuleModule;
        'helper-purity': eslint.Rule.RuleModule;
    };
    configs: {
        recommended: {
            plugins: {
                '@skipo': {
                    rules: {
                        'file-line-limit': eslint.Rule.RuleModule;
                        'one-component-per-file': eslint.Rule.RuleModule;
                        'top-level-purity': eslint.Rule.RuleModule;
                        'no-polling': eslint.Rule.RuleModule;
                        'import-suffix': eslint.Rule.RuleModule;
                        'helper-purity': eslint.Rule.RuleModule;
                    };
                };
            };
            rules: {
                '@skipo/file-line-limit': (string | {
                    max: number;
                })[];
                '@skipo/one-component-per-file': string;
                '@skipo/top-level-purity': string;
                '@skipo/no-polling': string;
                '@skipo/import-suffix': string;
                '@skipo/helper-purity': (string | {
                    max: number;
                })[];
            };
        };
    };
};

export { configs, _default as default, rules };
