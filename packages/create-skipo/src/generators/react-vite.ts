/**
 * @fileoverview React + Vite project generator.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';

/**
 * Scaffolds a React + Vite application.
 * 
 * @param projectName - The name of the project.
 * @param skipGit - Whether to skip git initialization.
 * @param skipInstall - Whether to skip npm install.
 */
export async function generateReactVite(
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
    type: "module",
    scripts: {
      "dev": "vite",
      "build": "tsc -b && vite build",
      "preview": "vite preview"
    },
    dependencies: {
      "react": "^18.3.1",
      "react-dom": "^18.3.1",
      "@skipo/core": "latest",
      "@skipo/ui": "latest",
      "@skipo/systems": "latest"
    },
    devDependencies: {
      "@types/react": "^18.3.3",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.1",
      "typescript": "^5.5.3",
      "vite": "^5.4.1"
    }
  };

  await fs.writeFile(
    join(projectDir, 'package.json'),
    JSON.stringify(pkgJson, null, 2),
    'utf-8'
  );

  console.log('React+Vite project setup complete (stub).');
}
