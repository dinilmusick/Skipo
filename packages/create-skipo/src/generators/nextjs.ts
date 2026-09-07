/**
 * @fileoverview Next.js project generator.
 */

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { nextjsTemplates } from './nextjs-templates.js';

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

  // Components
  await writeFile(join(projectDir, 'src', 'components', 'CustomButton.tsx'), nextjsTemplates.customComponentTsx());

  // Scripts
  await writeFile(join(projectDir, 'scripts', 'create-admin.ts'), nextjsTemplates.createAdminTs());
  await writeFile(join(projectDir, 'scripts', 'validate.ts'), nextjsTemplates.validateTs());

  // State
  await writeFile(join(projectDir, '.skipo', 'agent-state.json'), nextjsTemplates.agentStateJson());

  console.log('Next.js project setup complete.');
}
