import { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import type { ValidatorConfig, ValidationResult, RuleViolation, ValidationRule } from './types.js';
import { fileLineLimitRule } from './rules/file-line-limit.js';
import { helperLineLimitRule } from './rules/helper-line-limit.js';
import { mainDelegationRule } from './rules/main-delegation.js';
import { topLevelPurityRule } from './rules/top-level-purity.js';
import { oneComponentRule } from './rules/one-component.js';
import { noPollingRule } from './rules/no-polling.js';
import { importSuffixRule } from './rules/import-suffix.js';
import { baseClassUsageRule } from './rules/base-class-usage.js';
import { themeTokenSemanticsRule } from './rules/theme-token-semantics.js';
import { uiInvariantsRule } from './rules/ui-invariants.js';

export class SkipoValidator {
  private config: ValidatorConfig;
  private rules: ValidationRule[] = [
    fileLineLimitRule,
    helperLineLimitRule,
    mainDelegationRule,
    topLevelPurityRule,
    oneComponentRule,
    noPollingRule,
    importSuffixRule,
    baseClassUsageRule,
    themeTokenSemanticsRule,
    uiInvariantsRule
  ];
  private project?: Project;

  constructor(config: ValidatorConfig) {
    this.config = config;
  }

  private scanDir(dir: string, files: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.includes('node_modules') && !entry.name.includes('dist')) {
          this.scanDir(fullPath, files);
        }
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  public validate(): ValidationResult {
    const startTime = Date.now();
    const files = this.scanDir(this.config.rootDir);
    const violations: RuleViolation[] = [];

    // Lazy initialization of ts-morph project
    this.project = new Project({
      compilerOptions: { allowJs: true }
    });
    
    for (const file of files) {
      this.project.addSourceFileAtPath(file);
    }

    for (const file of files) {
      const sourceCode = fs.readFileSync(file, 'utf8');
      
      for (const rule of this.rules) {
        // Skip disabled rules
        if (this.config.rules && this.config.rules[rule.id] === 'off') {
          continue;
        }
        
        try {
          const ruleViolations = rule.validate(file, sourceCode, this.project);
          
          // Override severity if specified in config
          const mappedViolations = ruleViolations.map(v => {
            const configSeverity = this.config.rules?.[rule.id];
            if (configSeverity && configSeverity !== 'off') {
              v.severity = configSeverity;
            }
            return v;
          });
          
          violations.push(...mappedViolations);
        } catch (e) {
          console.error(`Error running rule ${rule.id} on ${file}:`, e);
        }
      }
    }

    return {
      valid: !violations.some(v => v.severity === 'error'),
      violations,
      filesScanned: files.length,
      duration: Date.now() - startTime
    };
  }
}
