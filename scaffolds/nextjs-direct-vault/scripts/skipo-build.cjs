#!/usr/bin/env node

/**
 * @file skipo-build.cjs
 * @description Single Universal Build Pipeline for Next.js Skipo framework applications.
 * Conforms to Law L22 (Single Build Pipeline).
 *
 * Compiles all targets in one unified pass:
 * 1. Next.js Fullstack build -> .next/
 * 2. Static asset harvesting -> dist/client/ (for Cloudflare Assets CDN)
 * 3. Universal Polyglot Backend (esbuild) -> api/index.js (for Cloudflare Workers / Node)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

console.log('[skipo-build] Starting Next.js Universal Single-Pass Build...');
const startTime = Date.now();

// Ensure output directories exist
fs.mkdirSync(path.join(rootDir, 'api'), { recursive: true });
fs.mkdirSync(path.join(rootDir, 'dist/client'), { recursive: true });

function run(cmd, desc) {
  console.log(`[skipo-build] ${desc}...`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

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
  console.log('[skipo-build] Assembled Next.js static assets into dist/client.');
}

try {
  // 1. Next.js Fullstack build
  run('npx next build', 'Building Next.js application');

  // 2. Harvest static client assets for Cloudflare Assets CDN
  assembleNextClientAssets(rootDir);

  // 3. Single Universal Polyglot Backend bundle
  run(
    "npx esbuild src/backend/adapters/universalEntry.ts --bundle --platform=neutral --format=esm --alias:crypto=node:crypto '--external:node:*' --outfile=api/index.js",
    'Bundling Single Universal Polyglot Backend (api/index.js)'
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✨ [skipo-build] Next.js universal build completed successfully in ${duration}s.`);
} catch (error) {
  console.error('\n❌ [skipo-build] Build failed:', error.message);
  process.exit(error.status || 1);
}
