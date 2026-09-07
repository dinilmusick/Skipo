#!/usr/bin/env node
import {
  SkipoValidator
} from "../chunk-EK3RR5XH.js";

// src/cli/report.ts
function printReport(result) {
  console.log(`
Skipo Validation Report
`);
  console.log(`Files scanned: ${result.filesScanned}`);
  console.log(`Duration: ${result.duration}ms`);
  if (result.violations.length === 0) {
    console.log(`
\u2705 All clear!`);
    return;
  }
  console.log(`
Violations:
`);
  const byFile = result.violations.reduce((acc, v) => {
    acc[v.filePath] = acc[v.filePath] || [];
    acc[v.filePath].push(v);
    return acc;
  }, {});
  for (const [file, violations] of Object.entries(byFile)) {
    console.log(`File: ${file}`);
    for (const v of violations) {
      const icon = v.severity === "error" ? "\u274C" : v.severity === "warning" ? "\u26A0\uFE0F" : "\u2139\uFE0F";
      console.log(`  ${icon} [${v.ruleId}] ${v.message}`);
      if (v.line) {
        console.log(`     Line: ${v.line}`);
      }
      if (v.suggestion) {
        console.log(`     Suggestion: ${v.suggestion}`);
      }
    }
    console.log("");
  }
}

// src/cli/validate.ts
function main() {
  const rootDir = process.argv[2] || process.cwd();
  console.log(`Running Skipo validation on ${rootDir}...`);
  const validator = new SkipoValidator({
    rootDir
  });
  const result = validator.validate();
  printReport(result);
  if (!result.valid) {
    process.exit(1);
  }
}
main();
