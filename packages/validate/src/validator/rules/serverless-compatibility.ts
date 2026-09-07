import type { ValidationRule, RuleViolation } from '../types.js';
import type { Project } from 'ts-morph';
import * as path from 'path';

export const serverlessCompatibilityRule: ValidationRule = {
  id: 'serverless-compatibility',
  description: 'Flags static imports of development tooling in server factories and backend endpoints',
  severity: 'error',
  validate(filePath: string, sourceCode: string, _project?: Project): RuleViolation[] {

    const violations: RuleViolation[] = [];
    const normalized = filePath.replace(/\\/g, '/');

    const isServerFile =
      normalized.includes('/server/') ||
      normalized.includes('/api/') ||
      path.basename(normalized).startsWith('server.') ||
      path.basename(normalized).startsWith('AppFactory.');

    if (!isServerFile) return [];

    const lines = sourceCode.split('\n');

    // 1. Check for static imports of dev tooling (vite, esbuild)
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const isStaticImport = trimmed.startsWith('import ') && !trimmed.startsWith('import type');
      if (isStaticImport) {
        if (
          trimmed.includes("'vite'") ||
          trimmed.includes('"vite"') ||
          trimmed.includes("'@vitejs/plugin-react'") ||
          trimmed.includes('"@vitejs/plugin-react"')
        ) {
          violations.push({
            ruleId: this.id,
            severity: this.severity,
            message: 'Static import of Vite in server factory. In serverless runtime, Vite dependencies fail to resolve.',
            filePath,
            line: index + 1,
            suggestion: "Use dynamic import inside an environment check: if (!process.env.VERCEL) { const { createServer } = await import('vite'); }",
          });
        }
      }
    });

    return violations;
  }
};
