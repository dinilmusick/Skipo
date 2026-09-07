/**
 * @fileoverview Electron project generator.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';

/**
 * Scaffolds an Electron application.
 * 
 * @param projectName - The name of the project.
 * @param skipGit - Whether to skip git initialization.
 * @param skipInstall - Whether to skip npm install.
 */
export async function generateElectron(
  projectName: string,
  _skipGit: boolean,
  _skipInstall: boolean
): Promise<void> {
  const projectDir = join(process.cwd(), projectName);
  
  await fs.mkdir(projectDir, { recursive: true });

  const pkgJson = {
    name: projectName,
    version: "0.1.0",
    private: true,
    main: "main.js",
    scripts: {
      "start": "electron ."
    },
    dependencies: {
      "@skipo/core": "latest"
    },
    devDependencies: {
      "electron": "latest"
    }
  };

  await fs.writeFile(
    join(projectDir, 'package.json'),
    JSON.stringify(pkgJson, null, 2),
    'utf-8'
  );

  const gitignoreContent = `.DS_Store
*.log
.gemini/
*.tmp
node_modules/
/dist/
.turbo/
`;

  await fs.writeFile(
    join(projectDir, '.gitignore'),
    gitignoreContent,
    'utf-8'
  );

  console.log('Electron project setup complete (stub).');
}
