#!/usr/bin/env node
/** Deterministic provider build; config/build/manifests are executable inputs. */
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, relative, dirname, sep } from "node:path";

const root = process.cwd();
const options = process.argv.slice(2);
const targetAt = options.indexOf("--target");
if (options.length && (targetAt !== 0 || options.length !== 2)) {
  throw new Error("Usage: skipo-build.mjs [--target api|fullstack]");
}
const target = targetAt === -1 ? "fullstack" : options[1];
if (!["fullstack", "api"].includes(target)) {
  throw new Error("Unsupported Skipo build target: " + target);
}
const manifest = JSON.parse(readFileSync(resolve(root, "config/build/manifests", target + ".json"), "utf8"));
if (manifest.schemaVersion !== 1 || manifest.target !== target ||
    !Array.isArray(manifest.providers) || !manifest.providers.length) {
  throw new Error("Invalid or mismatched Skipo build manifest");
}
const within = (name) => {
  if (typeof name !== "string" || !name || name.includes("\0")) throw new Error("Invalid build path");
  const abs = resolve(root, name);
  if (abs !== root && !abs.startsWith(root + sep)) throw new Error("Build path escapes project: " + name);
  return abs;
};
function run(bin, args) {
  const result = spawnSync(bin, args, {
    cwd: root, stdio: "inherit", shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("[skipo] Building " + target + " provider targets from pinned manifest");
if (manifest.client) {
  if (!existsSync(within(manifest.client.entrypoint))) throw new Error("Browser entrypoint missing");
  const outdir = within(manifest.client.outdir);
  run("npx", ["vite", "build", "--outDir", relative(root, outdir)]);
}
for (const provider of manifest.providers) {
  if (!["browser", "node"].includes(provider.platform) ||
      !/^[a-z][a-z0-9-]*$/.test(provider.name) ||
      !/^src\/providers\/[a-zA-Z0-9_-]+\.ts$/.test(provider.entrypoint) ||
      !/^(dist\/providers\/[a-z0-9/-]+\.js|api\/(?:mcp|\[\.\.\.path\])\.js)$/.test(provider.outfile)) {
    throw new Error("Invalid provider in Skipo build manifest");
  }
  const entry = within(provider.entrypoint);
  const outfile = within(provider.outfile);
  if (!existsSync(entry)) throw new Error("Provider source missing: " + provider.entrypoint);
  mkdirSync(dirname(outfile), { recursive: true });
  const args = ["esbuild", provider.entrypoint, "--bundle", "--format=esm",
    "--platform=" + provider.platform, "--target=" + provider.target,
    "--outfile=" + provider.outfile];
  if (provider.packages === "external") args.push("--packages=external");
  // Compact deployed serverless artifacts while retaining descriptive symbol
  // names (no identifier mangling). The full source remains in src/providers.
  if (provider.minify === true) args.push("--minify-whitespace", "--minify-syntax");
  run("npx", args);
}
console.log("[skipo] Completed " + target + " provider packaging");
