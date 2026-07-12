import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    // Integration tests spawn the CLI as a child process; under v8 coverage
    // instrumentation these routinely take 7-12s, exceeding the 5s default and
    // causing flaky timeouts. Give them realistic headroom.
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/cli/index.ts',
        'src/mcp/index.ts',
        'src/action/index.ts',
        'src/templates/**',
      ],
      // Coverage thresholds enforced when running `npm run test:coverage`.
      // Tuned to current state; raise as test quality improves.
      // Branches threshold is lower than lines because language-specific
      // code paths in CodeBlockRule have many partially-exercised branches.
      thresholds: {
        lines: 85,
        functions: 80,
        branches: 75,
        statements: 85,
      },
    },
    watchExclude: ['node_modules', 'dist'],
  },
});
