/**
 * @file react-vite.ts
 * @description React + Vite project generator preserving root index.html and canonical connectivity wiring.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export async function generateReactVite(
  projectName: string,
  _skipGit: boolean,
  _skipInstall: boolean
): Promise<void> {
  const projectDir = join(process.cwd(), projectName);
  const srcDir = join(projectDir, 'src');
  const compDir = join(srcDir, 'components', 'AppShell');

  await fs.mkdir(compDir, { recursive: true });

  const pkgJson = {
    name: projectName,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'tsc -b && vite build',
      preview: 'vite preview',
    },
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      '@skipo/core': 'latest',
      '@skipo/ui': 'latest',
      '@skipo/backend': 'latest',
      '@skipo/systems': 'latest',
    },
    devDependencies: {
      '@types/react': '^18.3.3',
      '@types/react-dom': '^18.3.0',
      '@vitejs/plugin-react': '^4.3.1',
      typescript: '^5.5.3',
      vite: '^5.4.1',
    },
  };

  await fs.writeFile(join(projectDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8');

  const gitignoreContent = `.DS_Store\n*.log\nnode_modules/\n/dist/\n.turbo/\n`;
  await fs.writeFile(join(projectDir, '.gitignore'), gitignoreContent, 'utf-8');

  const vercelJson = {
    rewrites: [
      { source: '/api/(.*)', destination: '/api' },
      { source: '/(.*)', destination: '/index.html' },
    ],
  };
  await fs.writeFile(join(projectDir, 'vercel.json'), JSON.stringify(vercelJson, null, 2), 'utf-8');

  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;
  await fs.writeFile(join(projectDir, 'vite.config.ts'), viteConfig, 'utf-8');

  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      useDefineForClassFields: true,
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      skipLibCheck: true,
      moduleResolution: 'bundler',
      allowImportingTsExtensions: false,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: 'react-jsx',
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
    },
    include: ['src'],
  };
  await fs.writeFile(join(projectDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2), 'utf-8');

  // ROOT index.html: Mandatory for Google AI Studio and Vercel
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  await fs.writeFile(join(projectDir, 'index.html'), indexHtml, 'utf-8');

  // Top-level File Purity: main.tsx has ONLY imports + single root mount
  const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import '@skipo/ui/dist/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  await fs.writeFile(join(srcDir, 'main.tsx'), mainTsx, 'utf-8');

  // Top-level File Purity: App.tsx wraps with BackendProvider and mounts AppShell
  const appTsx = `import React from 'react';
import { BackendProvider, BackendResolver } from '@skipo/backend/client';
import { AppShell } from './components/AppShell/AppShell.js';

const resolver = new BackendResolver({ strategy: 'LOCAL_FIRST' });

export default function App() {
  return (
    <BackendProvider resolver={resolver}>
      <AppShell />
    </BackendProvider>
  );
}
`;
  await fs.writeFile(join(srcDir, 'App.tsx'), appTsx, 'utf-8');

  const appShellTsx = `import React from 'react';
import { SkipoThemeProvider, TopToolbar, BottomStrip } from '@skipo/ui';
import { useBackend } from '@skipo/backend/client';

export function AppShell() {
  const backend = useBackend();
  const [activeTab, setActiveTab] = React.useState('main');

  return (
    <SkipoThemeProvider>
      <div className="flex flex-col h-screen w-screen bg-[var(--skipo-bg-primary)] text-[var(--skipo-text-primary)]">
        <TopToolbar
          title="${projectName}"
          tabs={[{ id: 'main', label: 'Dashboard' }]}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
        />
        <main className="flex-1 overflow-auto p-4">
          <h1 className="text-xl font-bold">Welcome to ${projectName}</h1>
        </main>
        <BottomStrip centerText="Skipo Backend Connected" />
      </div>
    </SkipoThemeProvider>
  );
}
`;
  await fs.writeFile(join(compDir, 'AppShell.tsx'), appShellTsx, 'utf-8');

  console.log(`React+Vite project setup complete at ${projectDir}`);
}
