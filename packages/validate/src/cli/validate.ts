#!/usr/bin/env node

import { SkipoValidator } from '../validator/SkipoValidator.js';
import { printReport } from './report.js';

function main() {
  const rootDir = process.argv[2] || process.cwd();
  console.log(`Running Skipo validation on ${rootDir}...`);
  
  const validator = new SkipoValidator({
    rootDir,
  });
  
  const result = validator.validate();
  printReport(result);
  
  if (!result.valid) {
    process.exit(1);
  }
}

main();
