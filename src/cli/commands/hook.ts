import { Command } from 'commander';
import {
  HookManager,
  type HookManagerType,
} from '../../infrastructure/HookManager.js';

interface InstallHookOptions {
  fix: boolean;
  staged: boolean;
  manager?: string;
}

/**
 * Validates that a string is a valid hook manager type
 */
function isValidManager(name: string): name is HookManagerType {
  const valid: HookManagerType[] = ['husky', 'lefthook', 'pre-commit', 'git'];
  return valid.includes(name as HookManagerType);
}

export const installHookCommand = new Command('install-hook')
  .description('Install Git pre-commit hook for cclint')
  .option('--fix', 'Enable auto-fix in hook', false)
  .option('--staged', 'Only lint staged files', false)
  .option(
    '-m, --manager <type>',
    'Hook manager to use (husky, lefthook, pre-commit, git)'
  )
  .action((options: InstallHookOptions) => {
    try {
      const hookManager = new HookManager(process.cwd());

      // Validate manager if specified
      if (options.manager && !isValidManager(options.manager)) {
        console.error(
          `Error: Invalid hook manager "${options.manager}". ` +
            `Available: husky, lefthook, pre-commit, git`
        );
        process.exit(1);
      }

      // Detect manager if not specified
      const detectedManager = hookManager.detect();
      const manager = options.manager
        ? (options.manager as HookManagerType)
        : detectedManager;

      if (!manager) {
        console.error(
          'Error: Could not detect hook manager. ' +
            'Make sure you have a .git directory or use -m to specify one.'
        );
        process.exit(1);
      }

      console.log(`📦 Installing cclint pre-commit hook using ${manager}...`);

      if (options.fix) {
        console.log('   Auto-fix: enabled');
      }
      if (options.staged) {
        console.log('   Staged files only: enabled');
      }

      const result = hookManager.install({
        manager,
        fix: options.fix,
        staged: options.staged,
      });

      if (result.success) {
        console.log(`\n✅ ${result.message}`);
        console.log(`   Hook path: ${result.hookPath}`);

        if (manager === 'lefthook') {
          console.log(
            '\nNext step: Run `lefthook install` to activate the hook.'
          );
        } else if (manager === 'pre-commit') {
          console.log(
            '\nNext step: Run `pre-commit install` to activate the hook.'
          );
        }
      } else {
        console.error(`\n❌ ${result.message}`);
        process.exit(1);
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

export const uninstallHookCommand = new Command('uninstall-hook')
  .description('Remove cclint Git pre-commit hook')
  .action(() => {
    try {
      const hookManager = new HookManager(process.cwd());

      const detectedManager = hookManager.detect();

      if (!detectedManager) {
        console.log('No hook manager detected. Nothing to uninstall.');
        return;
      }

      console.log(
        `📦 Removing cclint pre-commit hook from ${detectedManager}...`
      );

      const result = hookManager.uninstall();

      if (result.success) {
        console.log(`\n✅ ${result.message}`);
      } else {
        console.error(`\n❌ ${result.message}`);
        process.exit(1);
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
