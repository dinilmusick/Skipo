#!/usr/bin/env node
/** Inspect actual generated provider artifacts, not manifest existence alone. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, join, sep } from "node:path";

const [appArg, target] = process.argv.slice(2);
assert.ok(appArg && ["fullstack", "api"].includes(target), "Usage: verify-build-targets <app> <api|fullstack>");
const app = resolve(appArg);
const manifest = JSON.parse(readFileSync(join(app, "config/build/manifests", target + ".json"), "utf8"));
assert.equal(manifest.target, target);
const names = [];
for (const provider of manifest.providers) {
  const path = resolve(app, provider.outfile);
  assert.ok(path.startsWith(app + sep), "Provider output must remain inside generated app");
  assert.ok(existsSync(path), "Missing real provider output: " + provider.name);
  assert.ok(statSync(path).size > 0, "Empty provider output: " + provider.name);
  if (provider.name === "vercel" || provider.name === "mcp") {
    assert.equal(provider.minify, true, "Serverless output must be explicitly compacted");
    const body = readFileSync(path, "utf8");
    const lineCount = body.split(/\r?\n/).length;
    assert.ok(lineCount <= 200,
      provider.name + " generated serverless bundle exceeds 200 lines: " + lineCount);
    const syntax = spawnSync(process.execPath, ["--check", path], {
      cwd: app, encoding: "utf8", windowsHide: true,
    });
    assert.equal(syntax.status, 0, "Invalid serverless JavaScript: " + syntax.stderr);
  }
  names.push(provider.name);
}
const client = join(app, "dist", "client", "index.html");
if (target === "api") {
  assert.equal(existsSync(client), false, "API-only build unexpectedly generated browser UI");
  assert.equal(names.includes("node"), false);
} else {
  assert.ok(existsSync(client), "Full-stack build did not generate browser UI");
  assert.ok(statSync(client).size > 0);
  assert.ok(names.includes("node"));
}
console.log(JSON.stringify({ stage: "generated-provider-build", target, providers: names, ok: true }));
