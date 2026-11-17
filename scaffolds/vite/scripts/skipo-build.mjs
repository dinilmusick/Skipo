#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
function run(bin, args) {
  const result = spawnSync(bin, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
function has(name) { return existsSync(resolve(root, name)); }

console.log("[skipo] Building the single Fetch application and provider packages");
if (has("vite.config.ts") || has("vite.config.js") || has("index.html")) {
  run("npx", ["vite", "build", "--outDir", "dist/client"]);
}
for (const path of [
  "dist/client",
  "dist/providers/cloudflare",
  "dist/providers/vercel",
  "dist/providers/node",
  "api",
]) mkdirSync(resolve(root, path), { recursive: true });

run("npx", [
  "esbuild", "src/providers/cloudflare.ts", "--bundle", "--format=esm",
  "--platform=browser", "--target=es2022",
  "--outfile=dist/providers/cloudflare/worker.js",
]);
run("npx", [
  "esbuild", "src/providers/vercel.ts", "--bundle", "--format=esm",
  "--platform=node", "--target=node22", "--packages=external",
  "--outfile=api/[...path].js",
]);
run("npx", [
  "esbuild", "src/providers/vercel.ts", "--bundle", "--format=esm",
  "--platform=node", "--target=node22", "--packages=external",
  "--outfile=api/mcp.js",
]);
run("npx", [
  "esbuild", "src/providers/node.ts", "--bundle", "--format=esm",
  "--platform=node", "--target=node22", "--packages=external",
  "--outfile=dist/providers/node/server.js",
]);
console.log("[skipo] Provider packaging complete: Cloudflare, Vercel Node, Node/Cloud Run");
