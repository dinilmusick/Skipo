#!/usr/bin/env node

import { SkipoValidator } from '../validator/SkipoValidator.js';
import { printReport } from './report.js';

function main() {
  const rootDir = process.argv[2] || process.cwd();
  console.log(`\n======================================================`);
  console.log(`  SKIPO MANDATORY VERIFICATION & ANTI-PLACEHOLDER GATE`);
  console.log(`======================================================`);
  console.log(`Scanning target: ${rootDir}`);
  console.log(`[Rule 1] Zero placeholder data, synthetic telemetry, or fake listings allowed.`);
  console.log(`[Rule 2] Features are only considered complete after end-to-end tests are written, debugged, and passing.\n`);
  
  const validator = new SkipoValidator({
    rootDir,
  });
  
  const result = validator.validate();
  printReport(result);
  
  if (!result.valid) {
    console.error(`\n❌ Validation failed with ${result.violations.filter(v => v.severity === 'error').length} error(s).`);
    console.error(`AI Agent: You MUST resolve all errors and verify end-to-end tests before considering this task done.\n`);
    process.exit(1);
  }
  console.log(`\n✨ Gate Passed: Code meets all architectural purity, zero-placeholder, and testing standards.\n`);
}

main();

