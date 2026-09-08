type Severity = 'error' | 'warning' | 'info';
interface RuleViolation {
    ruleId: string;
    severity: Severity;
    message: string;
    filePath: string;
    line?: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
    suggestion?: string;
}
interface ValidationResult {
    valid: boolean;
    violations: RuleViolation[];
    filesScanned: number;
    duration: number;
}
interface ValidationRule {
    id: string;
    description: string;
    severity: Severity;
    validate(filePath: string, sourceCode: string, project?: any): RuleViolation[];
}
interface ValidatorConfig {
    rootDir: string;
    include?: string[];
    exclude?: string[];
    rules?: Record<string, Severity | 'off'>;
    fileLineLimit?: number;
    helperLineLimit?: number;
    mainDelegationLimit?: number;
}

declare class SkipoValidator {
    private config;
    private rules;
    private project?;
    constructor(config: ValidatorConfig);
    private scanDir;
    validate(): ValidationResult;
}

declare const fileLineLimitRule: ValidationRule;

declare const helperLineLimitRule: ValidationRule;

declare const mainDelegationRule: ValidationRule;

declare const topLevelPurityRule: ValidationRule;

declare const oneComponentRule: ValidationRule;

declare const noPollingRule: ValidationRule;

declare const importSuffixRule: ValidationRule;

declare const baseClassUsageRule: ValidationRule;

declare const themeTokenSemanticsRule: ValidationRule;

declare const uiInvariantsRule: ValidationRule;

declare const gitIgnoreAnchoringRule: ValidationRule;

declare const serverlessCompatibilityRule: ValidationRule;

declare const noPlaceholderDataRule: ValidationRule;

declare const featureTestCoverageRule: ValidationRule;

declare function validate(rootDir: string): ValidationResult;

export { type RuleViolation, type Severity, SkipoValidator, type ValidationResult, type ValidationRule, type ValidatorConfig, baseClassUsageRule, featureTestCoverageRule, fileLineLimitRule, gitIgnoreAnchoringRule, helperLineLimitRule, importSuffixRule, mainDelegationRule, noPlaceholderDataRule, noPollingRule, oneComponentRule, serverlessCompatibilityRule, themeTokenSemanticsRule, topLevelPurityRule, uiInvariantsRule, validate };
