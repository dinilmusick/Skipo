#!/usr/bin/env node
/** Independently exercise the packed npm CLI without a Skipo source checkout. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "skipo-services-packed-"));
const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const npmCommand = process.platform === "win32" ? process.execPath : "npm";
const npmArgs = process.platform === "win32" ? [npmCli] : [];

function command(executable, args, cwd, expected = 0) {
  const run = spawnSync(executable, args, {
    cwd, encoding: "utf8", windowsHide: true,
    timeout: 240_000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(run.status, expected, [executable, ...args].join(" ") + "\n" + run.stdout + "\n" + run.stderr);
  return run.stdout;
}

try {
  const archive = join(scratch, "archive");
  const consumer = join(scratch, "consumer");
  const app = join(scratch, "my app with spaces");
  mkdirSync(archive); mkdirSync(consumer); mkdirSync(app);
  command(npmCommand, [...npmArgs, "pack", "--pack-destination", archive],
    join(repo, "packages", "skipo"));
  const tarballs = readdirSync(archive).filter(name => name.endsWith(".tgz"));
  assert.equal(tarballs.length, 1);
  command(npmCommand, [...npmArgs, "install", "--no-audit", "--no-fund", "--prefix", consumer,
    join(archive, tarballs[0])], scratch);
  const cli = join(consumer, "node_modules", "@ultrst-armada", "skipo", "bin", "skipo.js");
  assert.ok(existsSync(cli));
  writeFileSync(join(app, "package.json"), JSON.stringify({
    name: "consumer", dependencies: { "@ultrst-armada/krnl": "1.0.0" },
  }));
  mkdirSync(join(app, "src", "backend"), { recursive: true });
  writeFileSync(join(app, "src", "backend", "AppBackend.ts"),
    "export const services = {\n  existing: true,\n};\n");
  const service = (args, expected = 0) =>
    JSON.parse(command(process.execPath, [cli, "service", ...args, app], scratch, expected));
  const plan = service(["create", "Notes", "--plan"]);
  assert.equal(plan.applied, false);
  assert.ok(!existsSync(join(app, ".skipo")));
  assert.ok(service(["create", "Notes"]).ok);
  assert.deepEqual(service(["create", "Notes"]).writes, []);
  assert.ok(service(["functionality", "Notes", "readNote"]).ok);
  assert.ok(service(["helper", "Notes", "normaliseNote"]).ok);
  assert.ok(service(["bind", "Notes"]).ok);
  const binding = readFileSync(join(app, "src", "backend", "AppBackend.ts"), "utf8");
  assert.equal(binding.split("...appOwnedServices").length - 1, 1);
  assert.ok(service(["verify", "Notes"]).verified);
  assert.deepEqual(service(["bind", "Notes"]).writes, []);
  const userFile = join(app, "src", "backend", "services", "notes", "helpers", "normaliseNote.ts");
  writeFileSync(userFile, "export const normaliseNote = () => 42;\n");
  assert.ok(service(["repair", "Notes"]).ok);
  assert.match(readFileSync(userFile, "utf8"), /42/);
  assert.ok(!service(["functionality", "Notes", "__proto__"], 2).ok);
  if (process.argv.includes("--full")) {
    // A real, packed Skipo-built Vite application; no source checkout wiring.
    const generated = join(scratch, "GeneratedServiceApp");
    command(process.execPath, [cli, "create", "GeneratedServiceApp", generated], scratch);
    command(process.execPath, [cli, "service", "create", "Weather", generated], scratch);
    command(process.execPath, [cli, "service", "functionality", "Weather", "getForecast", generated], scratch);
    command(process.execPath, [cli, "service", "bind", "Weather", generated], scratch);
    command(process.execPath, [cli, "service", "verify", "Weather", generated], scratch);
    command("pnpm", ["install", "--frozen-lockfile"], generated);
    for (const gate of ["typecheck", "test", "build"]) {
      command("pnpm", ["run", gate], generated);
    }
    console.log(JSON.stringify({ stage: "generated-vite-service", ok: true,
      frozenInstall: true, gates: ["typecheck", "test", "build"], validateGate: "separate-issue-216" }));
  }
  console.log(JSON.stringify({ stage: "packed-app-owned-service", ok: true,
    platform: process.platform, node: process.version, archive: tarballs[0],
    checked: ["plan", "create", "repeat", "functionality", "helper", "bind",
      "verify", "repair", "user-owned preservation", "invalid name"] }));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
