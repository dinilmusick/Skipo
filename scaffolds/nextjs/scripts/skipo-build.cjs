#!/usr/bin/env node

/**
 * @file skipo-build.cjs
 * @description Universal build router for Skipo framework applications.
 * Dynamically executes fullstack or api builds and assembles static client assets.
 * Conforms to Skipo Governance (< 200 lines).
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const target = (process.argv[2] || process.env.DEPLOY_TARGET || pkg.skipo?.deploy || 'fullstack').toLowerCase().trim();
const framework = pkg.dependencies?.next ? 'nextjs' : 'vite';

console.log(`[skipo-build] Framework detected: ${framework}`);
console.log(`[skipo-build] Selected target:   ${target}`);

function assembleNextClientAssets(root) {
  const clientDir = path.join(root, 'dist/client');
  const nextStatic = path.join(root, '.next/static');
  const nextApp = path.join(root, '.next/server/app');
  const publicDir = path.join(root, 'public');

  if (!fs.existsSync(nextApp)) return;

  fs.mkdirSync(path.join(clientDir, '_next'), { recursive: true });

  if (fs.existsSync(nextStatic)) {
    fs.cpSync(nextStatic, path.join(clientDir, '_next/static'), { recursive: true });
  }

  const pages = ['index.html', 'login.html', 'admin.html', '_not-found.html'];
  for (const page of pages) {
    const src = path.join(nextApp, page);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(clientDir, page));
    }
  }

  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, clientDir, { recursive: true });
  }
  console.log(`[skipo-build] Assembled Next.js static assets into dist/client.`);
}

const commands = {
  nextjs: {
    fullstack: 'npx next build',
    api: "BUILD_TARGET=api npx esbuild src/backend/adapters/httpsAdapter.ts --bundle --platform=browser --format=esm --target=es2022 --minify '--external:node:*' --external:fs --external:path --external:crypto --external:stream --external:buffer --external:util --external:events --external:os --external:net --external:tls --external:http --external:https --external:zlib --outfile=dist/api/worker/index.js",
  },
  vite: {
    fullstack: 'npx vite build && npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs',
    api: 'npx esbuild src/backend/adapters/httpsAdapter.ts --bundle --platform=neutral --format=esm --outfile=dist/api/worker/index.js',
  },
};

const cmd = commands[framework]?.[target];

if (!cmd) {
  console.error(`[skipo-build] Error: Unknown target "${target}" for framework "${framework}".`);
  process.exit(1);
}

console.log(`[skipo-build] Executing command: ${cmd}\n`);

try {
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
  if (framework === 'nextjs') {
    assembleNextClientAssets(rootDir);
  }
  console.log(`\n[skipo-build] Build completed successfully for target "${target}".`);
} catch (error) {
  console.error(`\n[skipo-build] Build failed for target "${target}".`);
  process.exit(error.status || 1);
}
