import { Command } from 'commander';

export const installCommand = new Command('install')
  .description('Install git hooks for automatic linting and quality checks')
  .option('--hooks', 'Install pre-commit git hooks', true)
  .option('--pre-push', 'Install pre-push quality check hooks', true)
  .action(async (options: { hooks: boolean; prePush: boolean }) => {
    try {
      if (options.hooks) {
        console.log('📦 Installing cclint pre-commit hooks...');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { installHook } =
          // @ts-expect-error: TS7016 - No declaration file for JS module
          await import('../../../scripts/install-hooks.js');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        installHook();
        console.log('✅ Pre-commit hooks installed successfully!');
        console.log('');
        console.log(
          'Your CLAUDE.md files will now be automatically linted before each commit.'
        );
        console.log(
          'To skip the check for a specific commit, use: git commit --no-verify'
        );
        console.log('');
      }

      if (options.prePush) {
        console.log('📦 Installing pre-push quality check hooks...');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { installPrePushHook } =
          // @ts-expect-error: TS7016 - No declaration file for JS module
          await import('../../../scripts/install-pre-push-hook.js');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        installPrePushHook();
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('Error: Unknown error occurred');
      }
      process.exit(1);
    }
  });
