export type Severity = 'error' | 'warning' | 'info';

export interface RuleViolation {
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

export interface ValidationResult {
  valid: boolean;
  violations: RuleViolation[];
  filesScanned: number;
  duration: number;
}

export interface ValidationRule {
  id: string;
  description: string;
  severity: Severity;
  validate(filePath: string, sourceCode: string, project?: any): RuleViolation[];
}

export interface ValidatorConfig {
  rootDir: string;
  include?: string[];
  exclude?: string[];
  rules?: Record<string, Severity | 'off'>;
  fileLineLimit?: number;
  helperLineLimit?: number;
  mainDelegationLimit?: number;
}
