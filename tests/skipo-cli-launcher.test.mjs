import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(repo, "packages", "skipo", "bin", "skipo.js");
const pythonCandidates = process.platform === "win32"
  ? [["py", ["-3"]], ["python", []], ["python3", []]]
  : [["python3", []], ["python", []]];
const python = pythonCandidates.find(([command, flags]) => {
  const result = spawnSync(command, [...flags, "-c", "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 3)"], { encoding: "utf8" });
  return result.status === 0;
});

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "skipo-cli-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const packageRoot = join(dir, "installed package");
  const scriptRoot = join(packageRoot, "dist", "engine", "scripts");
  mkdirSync(join(packageRoot, "bin"), { recursive: true });
  mkdirSync(scriptRoot, { recursive: true });
  writeFileSync(join(packageRoot, "package.json"), '{"type":"module"}\n');
  copyFileSync(entry, join(packageRoot, "bin", "skipo.js"));
  writeFileSync(join(scriptRoot, "skipo_cli.py"), [
    "import os, sys",
    "print('cwd=' + os.getcwd())",
    "print('args=' + '|'.join(sys.argv[1:]))",
    "sys.exit(23 if '--fail' in sys.argv else 0)",
  ].join("\n") + "\n");
  const cwd = join(dir, "separate working directory");
  mkdirSync(cwd);
  return { executable: join(packageRoot, "bin", "skipo.js"), cwd };
}

function run(executable, cwd, args, env = {}) {
  return spawnSync(process.execPath, [executable, ...args], {
    cwd, encoding: "utf8", windowsHide: true,
    env: { ...process.env, ...env },
  });
}

test("missing explicitly selected Python fails with actionable diagnostics", (t) => {
  const { executable, cwd } = fixture(t);
  const result = run(executable, cwd, ["--help"], {
    SKIPO_PYTHON: join(cwd, "no such interpreter"),
  });
  assert.equal(result.status, 127);
  assert.match(result.stderr, /Python 3\.10 or newer/);
  assert.match(result.stderr, /SKIPO_PYTHON/);
  assert.doesNotMatch(result.stdout, /args=/);
});

test("launched Python forwards arguments and arbitrary consumer working directory", { skip: !python }, (t) => {
  const { executable, cwd } = fixture(t);
  const result = run(executable, cwd, ["inspect", "some project"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /args=inspect\|some project/);
  assert.ok(result.stdout.includes("cwd=" + cwd), result.stdout);
});

test("launched Python preserves nonzero command status", { skip: !python }, (t) => {
  const { executable, cwd } = fixture(t);
  const result = run(executable, cwd, ["--fail"]);
  assert.equal(result.status, 23, result.stderr);
});

test("the actual source Python CLI prints its declared version", { skip: !python }, () => {
  const result = spawnSync(python[0], [...python[1], join(repo, "scripts", "skipo_cli.py"), "--version"], {
    cwd: repo, encoding: "utf8", windowsHide: true,
  });
  const expected = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).version;
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), expected);
});
