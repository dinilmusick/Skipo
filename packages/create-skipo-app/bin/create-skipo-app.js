#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { argv, exit } from "node:process";

const require = createRequire(import.meta.url);
const skipoCli = require.resolve("skipo/bin/skipo.js");
const args = argv.slice(2);

try {
  execFileSync(process.execPath, [skipoCli, "create", ...args], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
} catch (error) {
  exit(typeof error?.status === "number" ? error.status : 1);
}
