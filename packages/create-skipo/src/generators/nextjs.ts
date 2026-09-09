/**
 * @fileoverview Next.js project generator.
 */

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { nextjsTemplates } from './nextjs-templates.js';
import {
  governanceMiddlewareTemplate,
  governanceTypesTemplate,
  governanceRateLimiterTemplate,
  governanceAbuseDetectorTemplate,
  governanceBudgetTemplate,
  governanceValidatorTemplate,
  governanceHeadersTemplate,
  governanceObservabilityTemplate,
  governanceErrorHandlerTemplate,
  governanceRouteTemplate,
  governanceIndexTemplate,
  governanceSessionTemplate,
  governanceEmailVerificationTemplate,
  governanceTrustTemplate,
  governanceSecurityEventsTemplate
} from './templates/index.js';

async function writeFile(path: string, content: string) {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, content, 'utf-8');
}

/**
 * Scaffolds a Next.js App Router application.
 * 
 * @param projectName - The name of the project.
 * @param skipGit - Whether to skip git initialization.
 * @param skipInstall - Whether to skip npm install.
 */
export async function generateNextjs(
  projectName: string,
  _skipGit: boolean,
  _skipInstall: boolean
): Promise<void> {
  const projectDir = join(process.cwd(), projectName);
  
  await fs.mkdir(projectDir, { recursive: true });

  // Root files
  await writeFile(join(projectDir, 'package.json'), nextjsTemplates.packageJson(projectName));
  await writeFile(join(projectDir, 'tsconfig.json'), nextjsTemplates.tsconfigJson());
  await writeFile(join(projectDir, 'next.config.js'), nextjsTemplates.nextConfigJs());
  await writeFile(join(projectDir, '.gitignore'), nextjsTemplates.gitignore());
  await writeFile(join(projectDir, 'src', 'app', 'globals.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');

  // App router pages
  await writeFile(join(projectDir, 'src', 'app', 'layout.tsx'), nextjsTemplates.layoutTsx());
  await writeFile(join(projectDir, 'src', 'app', 'page.tsx'), nextjsTemplates.pageTsx());
  await writeFile(join(projectDir, 'src', 'app', 'login', 'page.tsx'), nextjsTemplates.loginPageTsx());
  await writeFile(join(projectDir, 'src', 'app', 'admin', 'login', 'page.tsx'), nextjsTemplates.adminLoginPageTsx());
  await writeFile(join(projectDir, 'src', 'app', 'admin', 'page.tsx'), nextjsTemplates.adminPageTsx());

  // API Routes
  await writeFile(join(projectDir, 'src', 'app', 'api', 'auth', '[...route]', 'route.ts'), nextjsTemplates.authRouteTs());
  await writeFile(join(projectDir, 'src', 'app', 'api', 'events', 'route.ts'), nextjsTemplates.eventsRouteTs());
  await writeFile(join(projectDir, 'src', 'app', 'api', 'workspace', 'route.ts'), nextjsTemplates.workspaceRouteTs());

  // Edge Security Middleware
  await writeFile(join(projectDir, 'middleware.ts'), governanceMiddlewareTemplate());

  // API Governance Framework
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'types.ts'), governanceTypesTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'rate-limiter.ts'), governanceRateLimiterTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'abuse-detector.ts'), governanceAbuseDetectorTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'resource-budget.ts'), governanceBudgetTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'request-validator.ts'), governanceValidatorTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'security-headers.ts'), governanceHeadersTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'observability.ts'), governanceObservabilityTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'error-handler.ts'), governanceErrorHandlerTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'create-secure-route.ts'), governanceRouteTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'session-manager.ts'), governanceSessionTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'email-verification.ts'), governanceEmailVerificationTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'trust-engine.ts'), governanceTrustTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'security-events.ts'), governanceSecurityEventsTemplate());
  await writeFile(join(projectDir, 'src', 'lib', 'api-governance', 'index.ts'), governanceIndexTemplate());

  // Components
  await writeFile(join(projectDir, 'src', 'components', 'CustomButton.tsx'), nextjsTemplates.customComponentTsx());

  // Scripts
  await writeFile(join(projectDir, 'scripts', 'create-admin.ts'), nextjsTemplates.createAdminTs());
  await writeFile(join(projectDir, 'scripts', 'validate.ts'), nextjsTemplates.validateTs());

  // State
  await writeFile(join(projectDir, '.skipo', 'agent-state.json'), nextjsTemplates.agentStateJson());

  console.log('Next.js project setup complete.');
}
