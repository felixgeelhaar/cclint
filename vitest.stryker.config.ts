import { defineConfig } from 'vitest/config';

// Vitest config used only by Stryker mutation runs.
// Excludes tests that call process.chdir() — Node worker_threads (which
// Stryker uses to parallelise) reject chdir, breaking the dry run.
// Domain primitives have no need for those tests anyway.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/domain/**/*.test.ts',
      'tests/unit/rules/**/*.test.ts',
      'tests/integration/extended-features.test.ts',
    ],
    exclude: ['node_modules', 'dist'],
  },
});
