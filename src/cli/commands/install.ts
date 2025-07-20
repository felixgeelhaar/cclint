import { Command } from 'commander';
import { installHook } from '../../../scripts/install-hooks.js';

export const installCommand = new Command('install')
  .description('Install git hooks for automatic linting')
  .option('--hooks', 'Install pre-commit git hooks', true)
  .action(async (options: { hooks: boolean }) => {
    try {
      if (options.hooks) {
        console.log('📦 Installing cclint git hooks...');
        await installHook();
        console.log('✅ Git hooks installed successfully!');
        console.log('');
        console.log('Your CLAUDE.md files will now be automatically linted before each commit.');
        console.log('To skip the check for a specific commit, use: git commit --no-verify');
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