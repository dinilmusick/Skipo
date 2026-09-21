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

      // 2. Check for unguarded top-level fs.mkdirSync outside functions or try blocks
      if (
        (trimmed.startsWith('fs.mkdirSync') || trimmed.startsWith('mkdirSync')) &&
        !trimmed.includes('/tmp') &&
        !trimmed.includes('os.tmpdir()')
      ) {
        let inTryOrFunc = false;
        for (let i = Math.max(0, index - 8); i < index; i++) {
          const prev = lines[i].trim();
          if (prev.includes('try {') || prev.includes('function ') || prev.includes('=>') || prev.includes('if (')) {
            inTryOrFunc = true;
            break;
          }
        }
        if (!inTryOrFunc) {
          violations.push({
            ruleId: this.id,
            severity: this.severity,
            message: 'Unconditional top-level fs.mkdirSync detected in server module. Will crash with EROFS in read-only serverless runtimes.',
            filePath,
            line: index + 1,
            suggestion: 'Wrap filesystem initialization in try/catch and route writable paths to /tmp in serverless environments.',
          });
        }
      }
    });

    return violations;
  }
};
