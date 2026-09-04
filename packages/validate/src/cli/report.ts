import type { ValidationResult } from '../validator/types.js';

export function printReport(result: ValidationResult): void {
  console.log(`\nSkipo Validation Report\n`);
  console.log(`Files scanned: ${result.filesScanned}`);
  console.log(`Duration: ${result.duration}ms`);
  
  if (result.violations.length === 0) {
    console.log(`\n✅ All clear!`);
    return;
  }
  
  console.log(`\nViolations:\n`);
  
  const byFile = result.violations.reduce((acc, v) => {
    acc[v.filePath] = acc[v.filePath] || [];
    acc[v.filePath].push(v);
    return acc;
  }, {} as Record<string, typeof result.violations>);
  
  for (const [file, violations] of Object.entries(byFile)) {
    console.log(`File: ${file}`);
    for (const v of violations) {
      const icon = v.severity === 'error' ? '❌' : v.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`  ${icon} [${v.ruleId}] ${v.message}`);
      if (v.line) {
        console.log(`     Line: ${v.line}`);
      }
      if (v.suggestion) {
        console.log(`     Suggestion: ${v.suggestion}`);
      }
    }
    console.log('');
  }
}
