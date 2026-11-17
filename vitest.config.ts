import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Python and Node's built-in test runner own their respective suites.
    // Vitest owns TypeScript unit/integration tests only.
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.skipo/**'],
  },
});
