#!/usr/bin/env node

/**
 * @file skipo-build.cjs
 * @description Single Universal Build Pipeline for Skipo framework applications.
 * Conforms to Law L22 (Single Build Pipeline).
 *
 * Compiles all targets in one unified pass:
 * 1. Frontend SPA (Vite) -> dist/
 * 2. Node/Docker Server -> dist/server.cjs
 * 3. Vercel Serverless Function -> api/index.js
 * 4. Cloudflare Worker -> dist/api/worker/index.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

console.log('[skipo-build] Starting Universal Single-Pass Build...');
const startTime = Date.now();

// Ensure output directories exist
fs.mkdirSync(path.join(rootDir, 'api'), { recursive: true });
fs.mkdirSync(path.join(rootDir, 'dist/api/worker'), { recursive: true });

function run(cmd, desc) {
  console.log(`[skipo-build] ${desc}...`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

try {
  // 1. Frontend SPA build
  run('npx vite build', 'Building Vite frontend assets');

  // 2. Local / Docker Node Server build
  run(
    'npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs',
    'Bundling local Node server (dist/server.cjs)'
  );

  // 3. Vercel Serverless Function entrypoint
  run(
    'npx esbuild src/backend/adapters/httpsAdapter.ts --bundle --platform=node --format=esm --packages=external --minify --banner:js="// @generated" --outfile=api/index.js',
    'Bundling Vercel Serverless entrypoint (api/index.js)'
  );

  // 4. Cloudflare Worker entrypoint
  run(
    'npx esbuild src/backend/adapters/httpsAdapter.ts --bundle --platform=neutral --alias:crypto=node:crypto --external:node:crypto --format=esm --outfile=dist/api/worker/index.js',
    'Bundling Cloudflare Worker entrypoint (dist/api/worker/index.js)'
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✨ [skipo-build] Universal build completed successfully in ${duration}s.`);
} catch (error) {
  console.error('\n❌ [skipo-build] Build failed:', error.message);
  process.exit(error.status || 1);
}
