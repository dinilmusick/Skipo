#!/usr/bin/env node
// Exercise the actual npm archive, never the source checkout or a mocked engine.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const full = process.argv.includes("--full");
const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const npm = process.platform === "win32" ? process.execPath : "npm";
const npmPrefix = process.platform === "win32" ? [npmCli] : [];
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const rootVersion = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).version;
const pkgVersion = JSON.parse(readFileSync(join(repo, "packages", "skipo", "package.json"), "utf8")).version;
assert.equal(pkgVersion, rootVersion, "Root and published CLI versions must agree");

function run(command, args, cwd, options = {}) {
  const execution = spawnSync(command, args, {
    cwd, encoding: "utf8", timeout: 600_000, maxBuffer: 24 * 1024 * 1024,
    env: { ...process.env, ...options.env },
    windowsHide: true,
  });
  if (options.expected !== undefined) {
    assert.equal(execution.status, options.expected,
      [command, ...args].join(" ") + "\n" + execution.stderr + "\n" + execution.stdout);
  } else {
    assert.equal(execution.status, 0,
      [command, ...args].join(" ") + "\n" + execution.stderr + "\n" + execution.stdout);
  }
  return execution.stdout;
}

function digest(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

const scratch = mkdtempSync(join(tmpdir(), "skipo-packed-consumer-"));
try {
  const archiveDir = join(scratch, "archive");
  const consumer = join(scratch, "consumer with spaces");
  const externalCwd = join(scratch, "external working dir");
  mkdirSync(archiveDir);
  mkdirSync(consumer);
  mkdirSync(externalCwd);

  run(npm, [...npmPrefix, "pack", "--pack-destination", archiveDir], join(repo, "packages", "skipo"));
  const archives = readdirSync(archiveDir).filter((name) => name.endsWith(".tgz"));
  assert.equal(archives.length, 1, "Exactly one packed candidate is required");
  const archive = join(archiveDir, archives[0]);
  const archiveHash = digest(archive);
  run(npm, [...npmPrefix, "install", "--no-audit", "--no-fund", "--prefix", consumer, archive], externalCwd);
  const cli = join(consumer, "node_modules", "@ultrst-armada", "skipo", "bin", "skipo.js");
  assert.ok(existsSync(cli), "Real installed package must contain the executable");
  const bundledScaffoldTest = join(consumer, "node_modules", "@ultrst-armada", "skipo",
    "dist", "engine", "scaffolds", "vite", "tests", "canonical-capabilities.test.cjs");
  assert.ok(existsSync(bundledScaffoldTest),
    "npm archive must preserve generated scaffold tests ignored by source .gitignore");

  const skipo = (args, cwd = externalCwd, options = {}) =>
    run(process.execPath, [cli, ...args], cwd, options);

  assert.equal(skipo(["--version"]).trim(), pkgVersion);
  assert.match(skipo(["--help"]), /create/);
  skipo(["unknown-skipo-command"], externalCwd, { expected: 2 });
  skipo(["--help"], externalCwd, {
    expected: 127,
    env: { SKIPO_PYTHON: join(scratch, "missing-python") },
  });
  console.log(JSON.stringify({
    stage: "packed-launcher", ok: true, platform: process.platform,
    node: process.version, version: pkgVersion,
    archive: archives[0], sha256: archiveHash,
  }));

  if (full) {
  const application = join(scratch, "GeneratedSmokeApp");
  skipo(["create", "GeneratedSmokeApp", application]);
  assert.ok(existsSync(join(application, ".skipo", "project.json")));
  assert.ok(existsSync(join(application, "pnpm-lock.yaml")));
  skipo(["inspect", application]);
  skipo(["diagnose", application]);
  skipo(["plan", application]);

  // No lockfile relaxation: the first fresh-consumer dependency gate is frozen.
  run(pnpm, ["install", "--frozen-lockfile"], application);
  for (const gate of ["typecheck", "test", "build", "validate"]) {
    // Keep every full compliance rule active. Verbose logs reveal exact
    // generated-app violations instead of reporting only the scorecard.
    run(pnpm, gate === "validate" ? ["run", gate, "--verbose"] : ["run", gate], application);
  }
  skipo(["add", "ui", "settings", application]);
  skipo(["verify", application]);

  // Preserve application-owned code across two repeated full maintenance passes.
  const tab = join(application, "src", "frontend", "pages", "main", "tabs", "CustomConsumerTab.tsx");
  const service = join(application, "src", "backend", "services", "userOwnedExample.ts");
  mkdirSync(dirname(tab), { recursive: true });
  mkdirSync(dirname(service), { recursive: true });
  writeFileSync(tab, "export const customTab = 'consumer-owned';\n");
  writeFileSync(service, "export const customService = 'consumer-owned';\n");
  const before = [digest(tab), digest(service)];
  skipo(["update", application]);
  skipo(["update", application]);
  assert.deepEqual([digest(tab), digest(service)], before, "Application-owned code was rewritten");
  skipo(["verify", application]);

  console.log(JSON.stringify({
    stage: "generated-app", ok: true, frozenInstall: true,
    checked: ["create", "inspect", "diagnose", "plan", "add", "update twice", "verify",
              "typecheck", "test", "build", "validate", "custom file integrity"],
  }));
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
