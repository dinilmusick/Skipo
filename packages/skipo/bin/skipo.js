#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, env, exit, platform } from "node:process";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "dist", "engine", "scripts", "skipo_cli.py");
const configured = env.SKIPO_PYTHON?.trim();
const candidates = configured
  ? [[configured, []]]
  : platform === "win32"
    ? [["py", ["-3"]], ["python", []], ["python3", []]]
    : [["python3", []], ["python", []]];
const failures = [];

for (const [executable, flags] of candidates) {
  const label = [executable, ...flags].join(" ");
  const probe = spawnSync(
    executable,
    [...flags, "-c", "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 3)"],
    { encoding: "utf8", windowsHide: true },
  );
  if (probe.error) {
    failures.push(label + ": " + (probe.error.code ?? probe.error.message));
    continue;
  }
  if (probe.status !== 0) {
    failures.push(label + ": " + (
      probe.status === 3 ? "Python version is too old" :
      "probe exited " + (probe.status ?? "without a status")
    ));
    continue;
  }

  const child = spawnSync(executable, [...flags, script, ...argv.slice(2)], {
    stdio: "inherit",
    cwd: process.cwd(),
    env,
    windowsHide: true,
  });
  if (child.error) {
    console.error("[skipo] Failed to run " + label + ": " + child.error.message);
    exit(1);
  }
  // Preserve Python's success, usage, and failure codes exactly.
  exit(typeof child.status === "number" ? child.status : 1);
}

console.error("[skipo] Python 3.10 or newer is required to run @ultrst-armada/skipo.");
console.error("[skipo] Interpreter search: " + (failures.join("; ") || "no candidates") + ".");
console.error("[skipo] Install Python 3.10+, or set SKIPO_PYTHON to an executable path and retry.");
exit(127);
