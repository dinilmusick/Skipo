#!/usr/bin/env node
/**
 * Clean-room black-box Skipo CLI acceptance test.
 * The consumer lives in its own freshly initialized Git repository, uses an
 * actual npm tarball installed outside this checkout, and exercises the public
 * command executable. No source imports or framework mocks are allowed.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "skipo-independent-lab-"));
const evidenceDir = join(repo, "e2e-evidence", process.platform);
mkdirSync(evidenceDir, { recursive: true });

const report = {
  schemaVersion: 1,
  test: "installed-skipo-cli-independent-git-consumer",
  platform: process.platform,
  node: process.version,
  frameworkRevision: process.env.GITHUB_SHA || "local",
  checks: [],
  blockers: [],
  requiredBuild: ["frozen-pnpm-install", "typecheck", "unit-tests", "vite-build"],
};
const requiredFailures = [];

function digest(data) {
  return createHash("sha256").update(data).digest("hex");
}
function mark(name, result) {
  report.checks.push({ name, ...result });
  console.log(JSON.stringify({ name, ...result }));
}
function run(name, executable, args, cwd, { expected = 0, env = {}, allowFailure = false, timeout = 360_000 } = {}) {
  const cmd = spawnSync(executable, args, {
    cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    timeout, windowsHide: true,
    shell: process.platform === "win32" && /\.cmd$/i.test(executable),
    env: { ...process.env, ...env },
  });
  const actual = cmd.status ?? -1;
  const success = actual === expected && !cmd.error;
  const detail = {
    ok: success, expected, actual,
    command: [basename(executable), ...args].join(" "),
    stdoutTail: (cmd.stdout || "").slice(-1000),
    stderrTail: (cmd.stderr || "").slice(-2000),
  };
  mark(name, detail);
  if (!success) {
    if (allowFailure) {
      const safe = name.replace(/[^a-z0-9_-]/gi, "_");
      writeFileSync(join(evidenceDir, safe + ".stdout.log"), cmd.stdout || "");
      writeFileSync(join(evidenceDir, safe + ".stderr.log"), cmd.stderr || "");
      let structured = null;
      try {
        structured = JSON.parse(cmd.stdout || "");
      } catch {
        /* Some CLI commands stream subprocess logs before their JSON result. */
      }
      const diagnostics = structured?.diagnostics || structured?.errors || [];
      report.blockers.push({
        name, actual, expected,
        diagnosticCount: structured?.diagnostic_count,
        diagnostics: Array.isArray(diagnostics) ? diagnostics.slice(0, 35) : diagnostics,
        gate: structured?.error, status: structured?.status,
        stderr: detail.stderrTail, stdout: detail.stdoutTail,
      });
      return cmd;
    }
    requiredFailures.push(name);
    throw new Error(name + " failed: exit " + actual + ", expected " + expected + "\n" +
      (cmd.stderr || "") + "\n" + (cmd.stdout || ""));
  }
  return cmd;
}
function content(path) { return readFileSync(path, "utf8"); }
function snapshot(path) { return digest(readFileSync(path)); }
function assertStage(name, callback) {
  try {
    callback();
    mark(name, { ok: true });
  } catch (error) {
    mark(name, { ok: false, error: String(error) });
    requiredFailures.push(name);
    throw error;
  }
}

const npm = process.platform === "win32" ? process.execPath : "npm";
const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const npmPrefix = process.platform === "win32" ? [npmCli] : [];
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

let application;
try {
  const archiveDir = join(scratch, "archive");
  const externalConsumer = join(scratch, "installed consumer with spaces");
  application = join(scratch, "a new standalone Git repo");
  mkdirSync(archiveDir);
  mkdirSync(externalConsumer);
  const pkg = join(repo, "packages", "skipo");
  const metadata = JSON.parse(content(join(pkg, "package.json")));
  report.package = { name: metadata.name, version: metadata.version };
  run("npm-pack", npm, [...npmPrefix, "pack", "--pack-destination", archiveDir], pkg);
  const archives = readdirSync(archiveDir).filter(name => name.endsWith(".tgz"));
  assert.equal(archives.length, 1, "one and only one npm archive");
  const tarball = join(archiveDir, archives[0]);
  report.package.tarballSHA256 = snapshot(tarball);
  run("external-npm-install", npm,
    [...npmPrefix, "install", "--prefix", externalConsumer, "--no-fund", "--no-audit", tarball], scratch);
  const cli = join(externalConsumer, "node_modules", "@ultrst-armada", "skipo", "bin", "skipo.js");
  assert.ok(existsSync(cli), "real installed skipo executable");
  const engine = join(externalConsumer, "node_modules", "@ultrst-armada", "skipo", "dist", "engine");
  assert.ok(existsSync(join(engine, "scaffolds", "vite", "package.json")),
    "scaffold packaged with CLI rather than loaded from Git checkout");

  const skipo = (name, args, cwd = application, options = {}) =>
    run(name, process.execPath, [cli, ...args], cwd, options);

  assertStage("version", () => {
    const result = skipo("skipo-version", ["--version"], scratch);
    assert.equal(result.stdout.trim(), metadata.version);
  });
  skipo("missing-python-exit-127", ["--help"], scratch,
    { expected: 127, env: { SKIPO_PYTHON: join(scratch, "nonexistent-interpreter") } });
  skipo("invalid-cli-command-exit-2", ["unknown-command"], scratch, { expected: 2 });
  skipo("invalid-create-name-denied", ["create", "../Escape", application], scratch, { expected: 2 });
  assertStage("invalid-create-does-not-create-repo", () => {
    assert.equal(existsSync(application), false);
  });

  skipo("create-new-app", ["create", "IndependentLab", application], scratch);
  assertStage("created-valid-app", () => {
    assert.ok(existsSync(join(application, ".skipo", "project.json")));
    assert.ok(existsSync(join(application, "pnpm-lock.yaml")));
    const ignore = content(join(application, ".gitignore"));
    assert.match(ignore, /node_modules\//);
    assert.match(ignore, /\/dist\//);
    assert.match(ignore, /\/api\//);
    assert.ok(existsSync(join(application, "src", "frontend", "pages", "main", "tabs", "README.md")));
    assert.ok(existsSync(join(application, "src", "backend", "AppBackend.ts")));
    assert.ok(!existsSync(join(application, "node_modules")),
      "create must not silently install dependencies");
  });
  skipo("refuse-overwrite-of-live-app", ["create", "IndependentLab", application, "--force"],
    scratch, { expected: 2 });

  run("git-init-new-independent-repository", "git", ["init", "-b", "main"], application);
  run("git-set-author", "git", ["config", "user.name", "Skipo Cleanroom CI"], application);
  run("git-set-email", "git", ["config", "user.email", "skipo-e2e@example.invalid"], application);
  run("git-add-baseline", "git", ["add", "-A"], application);
  run("git-commit-baseline", "git", ["commit", "-m", "baseline: generated using packaged Skipo CLI"], application);
  run("git-tracks-canonical-commonjs-tests", "git",
    ["ls-files", "--error-unmatch", "tests/canonical-capabilities.test.cjs"], application);
  report.newRepository = { created: true, pathType: "temporary isolated directory" };

  skipo("inspect", ["inspect", application], scratch);
  skipo("plan", ["plan", application], scratch, { allowFailure: true });
  skipo("diagnose", ["diagnose", application], scratch, { allowFailure: true });

  // Service creation must distinguish a brand-new app-owned service from a
  // canonical Kloks service and must never replace an existing implementation.
  const serviceBase = join(application, "src", "backend", "services", "notes");
  skipo("service-create-plan", ["service", "create", "Notes", application, "--plan"], scratch);
  assertStage("service-plan-no-mutation", () => {
    assert.ok(!existsSync(serviceBase));
  });
  skipo("service-create", ["service", "create", "Notes", application], scratch);
  const serviceFile = join(serviceBase, "service.ts");
  assertStage("uses-actual-krnl-service-definition", () => {
    assert.match(content(serviceFile), /createServiceDefinition/);
    assert.match(content(serviceFile), /createService/);
  });
  skipo("service-create-idempotent", ["service", "create", "Notes", application], scratch);
  skipo("service-functionality", ["service", "functionality", "Notes", "readNote", application], scratch);
  skipo("service-helper", ["service", "helper", "Notes", "normaliseNote", application], scratch);
  skipo("service-bind-explicit", ["service", "bind", "Notes", application], scratch);
  skipo("service-verify", ["service", "verify", "Notes", application], scratch);
  skipo("deny-canonical-Kloks-service-duplication",
    ["service", "create", "Database", application], scratch, { expected: 2 });

  const operation = join(serviceBase, "functionalities", "readNote.ts");
  const helper = join(serviceBase, "helpers", "normaliseNote.ts");
  const applicationOwnedTag = "// application-owned implementation retained by Skipo\n";
  writeFileSync(operation, content(operation) + applicationOwnedTag);
  writeFileSync(helper, content(helper) + applicationOwnedTag);
  const owned = { operation: snapshot(operation), helper: snapshot(helper) };
  skipo("service-repair-preserves-user-code", ["service", "repair", "Notes", application], scratch);
  assertStage("service-user-code-integrity", () => {
    assert.equal(snapshot(operation), owned.operation);
    assert.equal(snapshot(helper), owned.helper);
  });
  const managedIndex = join(serviceBase, "functionalities", "index.ts");
  writeFileSync(managedIndex, content(managedIndex) + "// mutated generated index\n");
  skipo("refuse-implicit-service-index-overwrite",
    ["service", "repair", "Notes", application], scratch, { expected: 2 });
  skipo("repair-plan-does-not-override",
    ["service", "repair", "Notes", application, "--plan"], scratch,
    { expected: 2 });
  skipo("explicit-service-index-backup-and-restore",
    ["service", "repair", "Notes", application, "--reset"], scratch);
  skipo("service-verify-after-repair", ["service", "verify", "Notes", application], scratch);
  assertStage("service-restore-does-not-touch-user-code", () => {
    assert.equal(snapshot(operation), owned.operation);
    assert.equal(snapshot(helper), owned.helper);
    assert.ok(!content(managedIndex).includes("mutated generated index"));
  });

  // Both command forms should compose existing Kloks services, not scaffold
  // them. The first invocation is a registered storage capability.
  skipo("canonical-Kloks-storage-import", ["add", "service", "storage", application], scratch,
    { allowFailure: true });
  skipo("canonical-app-main-tab", ["add", "main", "tab", "Lab Dashboard", application], scratch,
    { allowFailure: true });
  skipo("canonical-shell-auth-plan", ["login", application, "--plan"], scratch,
    { allowFailure: true });

  const consumerCustom = join(application, "src", "frontend", "pages", "main", "tabs", "UserOwnedConsumer.tsx");
  writeFileSync(consumerCustom, "export const UserOwned = () => null;\n");
  const userOwnedHash = snapshot(consumerCustom);
  const backendOwned = snapshot(operation);

  skipo("update-1", ["update", application], scratch, { allowFailure: true });
  skipo("update-2", ["update", application], scratch, { allowFailure: true });
  assertStage("updates-preserve-user-code", () => {
    assert.equal(snapshot(consumerCustom), userOwnedHash);
    assert.equal(snapshot(operation), backendOwned);
  });
  skipo("sync", ["sync", application], scratch, { allowFailure: true });
  // update explicitly announces sync as its next stage; verify the final
  // reconciled state only AFTER that canonical synchronization stage.
  skipo("verify-after-update", ["verify", application], scratch, { allowFailure: true });

  // Never relax frozen installation or substitute fake provider packages.
  run("frozen-pnpm-install", pnpm, ["install", "--frozen-lockfile"], application);
  run("typecheck", pnpm, ["run", "typecheck"], application);
  run("unit-tests", pnpm, ["run", "test"], application);
  run("vite-build", pnpm, ["run", "build"], application);
  run("git-ignores-installed-dependencies", "git", ["check-ignore", "-q", "node_modules"], application);
  run("git-ignores-generated-vite-output", "git", ["check-ignore", "-q", "dist"], application);
  run("git-ignores-generated-api-output", "git", ["check-ignore", "-q", "api"], application);
  skipo("CLI-test-four-gates", ["test", application], scratch, { allowFailure: true, timeout: 600_000 });

  run("git-record-diff", "git", ["status", "--short"], application);
  const status = run("git-status-porcelain", "git", ["status", "--porcelain"], application);
  writeFileSync(join(evidenceDir, "git-status.txt"), status.stdout);
  report.reconciled = {
    sourceHash: snapshot(serviceFile),
    operationHash: snapshot(operation),
    userTabHash: snapshot(consumerCustom),
    rootCommitRecorded: true,
  };
} catch (err) {
  report.fatal = String(err);
  console.error(err);
} finally {
  report.summary = {
    passed: report.checks.filter(c => c.ok).length,
    failed: report.checks.filter(c => !c.ok).length,
    requiredFailures,
    advisoryFailures: report.blockers.map(b => b.name),
    generatedRepo: Boolean(application && existsSync(application)),
  };
  writeFileSync(join(evidenceDir, "skipo-cleanroom-report.json"),
    JSON.stringify(report, null, 2) + "\n");
  console.log("SKIPO_CLEANROOM_REPORT " + JSON.stringify(report.summary));
  rmSync(scratch, { recursive: true, force: true });
  if (report.fatal || requiredFailures.length) process.exitCode = 1;
  else if (report.blockers.length) process.exitCode = 2;
}
