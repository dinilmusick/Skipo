import type { ValidationRule, RuleViolation } from '../types.js';
import * as path from 'path';

export const serverlessDeploymentBudgetRule: ValidationRule = {
  id: 'serverless-deployment-budget',
  description: 'Enforces Vercel serverless functions code size limits (50MB Hobby / 250MB Pro), standalone tracing, tree-shaking, and external CDN storage',
  severity: 'error',
  validate(filePath: string, sourceCode: string): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const normalized = filePath.replace(/\\/g, '/');
    const baseName = path.basename(normalized);

    // 1. Next.js Config: Must enable output: 'standalone'
    if (baseName.startsWith('next.config.')) {
      if (!sourceCode.includes('standalone')) {
        violations.push({
          ruleId: this.id,
          severity: 'error',
          message: "next.config is missing `output: 'standalone'`. Output file tracing is required to prevent serverless function bundles from exceeding 50MB.",
          filePath,
          suggestion: "Add `output: 'standalone'` to your next.config to automatically trace and bundle only necessary dependencies.",
        });
      }
    }

    // 2. Package.json: Enforce devDependencies separation and ban heavy packages
    if (baseName === 'package.json') {
      try {
        const pkg = JSON.parse(sourceCode);
        const deps = pkg.dependencies || {};
        const devTools = ['eslint', 'jest', 'vitest', 'cypress', 'playwright', 'prettier', 'typescript', 'webpack', 'vite'];
        
        for (const tool of devTools) {
          if (deps[tool]) {
            violations.push({
              ruleId: this.id,
              severity: 'error',
              message: `Development tool '${tool}' found in production dependencies. Vercel bundles production dependencies into serverless functions.`,
              filePath,
              suggestion: `Move '${tool}' to devDependencies to prevent exceeding the 50MB deployment limit.`,
            });
          }
        }

        if (deps['moment']) {
          violations.push({
            ruleId: this.id,
            severity: 'error',
            message: "Heavy library 'moment' detected in dependencies. Moment adds excessive bundle weight.",
            filePath,
            suggestion: "Replace 'moment' with modular alternatives like 'date-fns' or 'dayjs'.",
          });
        }
      } catch {}
    }

    // 3. Source Code: Tree-shaking and Prisma Engine Optimization
    if (normalized.endsWith('.ts') || normalized.endsWith('.tsx') || normalized.endsWith('.js') || normalized.endsWith('.jsx')) {
      const lines = sourceCode.split('\n');

      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('import ') && !trimmed.startsWith('import type')) {
          // Flag monolithic lodash imports
          if (/import\s+([A-Za-z0-9_$]+|\*\s+as\s+[A-Za-z0-9_$]+)\s+from\s+['"]lodash['"]/.test(trimmed)) {
            violations.push({
              ruleId: this.id,
              severity: 'error',
              message: "Monolithic import from 'lodash' prevents bundler tree-shaking.",
              filePath,
              line: idx + 1,
              suggestion: "Import specific methods directly, e.g. import debounce from 'lodash/debounce'.",
            });
          }
          // Flag moment imports
          if (/import\s+.*\s+from\s+['"]moment['"]/.test(trimmed)) {
            violations.push({
              ruleId: this.id,
              severity: 'error',
              message: "Monolithic import of heavy 'moment' library.",
              filePath,
              line: idx + 1,
              suggestion: "Use 'date-fns' or 'dayjs' instead.",
            });
          }
        }
      });

      // Prisma Client binary check in serverless API routes
      if ((normalized.includes('/api/') || normalized.includes('/server/')) && sourceCode.includes('new PrismaClient(')) {
        if (!sourceCode.includes('@prisma/client/edge') && !sourceCode.toLowerCase().includes('accelerate')) {
          violations.push({
            ruleId: this.id,
            severity: 'warning',
            message: "Standard PrismaClient initialized in serverless route without Prisma Accelerate or Edge runtime. Bundled Prisma engine binaries can exhaust function limits.",
            filePath,
            suggestion: "Use '@prisma/client/edge' or Prisma Accelerate to avoid bundling heavy query engine binaries.",
          });
        }
      }
    }

    return violations;
  }
};
