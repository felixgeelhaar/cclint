import { Command } from 'commander';
import { resolve } from 'path';
import {
  FileWatcher,
  type FileChangeEvent,
} from '../../infrastructure/FileWatcher.js';
import { FileReader } from '../../infrastructure/FileReader.js';
import { RulesEngine } from '../../domain/RulesEngine.js';
import { FileSizeRule } from '../../rules/FileSizeRule.js';
import { StructureRule } from '../../rules/StructureRule.js';
import { ContentOrganizationRule } from '../../rules/ContentOrganizationRule.js';
import { FormatRule } from '../../rules/FormatRule.js';
import { CodeBlockRule } from '../../rules/CodeBlockRule.js';
import { ImportSyntaxRule } from '../../rules/ImportSyntaxRule.js';
import { FileLocationRule } from '../../rules/FileLocationRule.js';
import { ImportResolutionRule } from '../../rules/ImportResolutionRule.js';
import { ContentAppropriatenessRule } from '../../rules/ContentAppropriatenessRule.js';
import { MonorepoHierarchyRule } from '../../rules/MonorepoHierarchyRule.js';
import { CommandSafetyRule } from '../../rules/CommandSafetyRule.js';
import { formatResult } from '../formatters/textFormatter.js';
import { ConfigLoader } from '../../infrastructure/ConfigLoader.js';
import { AutoFixer } from '../../infrastructure/AutoFixer.js';
import { writeFileSync } from 'fs';
import type { Rule } from '../../domain/Rule.js';
import type { CclintConfig } from '../../domain/Config.js';

interface WatchOptions {
  recursive: boolean;
  fix: boolean;
  debounce: string;
  clear: boolean;
  config?: string;
}

/**
 * Creates rules based on configuration (shared with lint command)
 */
function createRules(config: CclintConfig): Rule[] {
  const rules: Rule[] = [];

  if (config.rules['file-size']?.enabled) {
    const maxSize = config.rules['file-size'].options?.maxSize ?? 10000;
    rules.push(new FileSizeRule(maxSize));
  }
  if (config.rules['structure']?.enabled) {
    rules.push(new StructureRule());
  }
  const contentEnabled = config.rules['content']?.enabled ?? false;
  const contentOrgEnabled =
    config.rules['content-organization']?.enabled ?? false;
  if (contentEnabled || contentOrgEnabled) {
    rules.push(new ContentOrganizationRule());
  }
  if (config.rules['format']?.enabled) {
    rules.push(new FormatRule());
  }
  if (config.rules['code-blocks']?.enabled !== false) {
    const codeBlockOptions = config.rules['code-blocks']?.options ?? {};
    rules.push(new CodeBlockRule(codeBlockOptions));
  }
  if (config.rules['import-syntax']?.enabled !== false) {
    const importOptions = config.rules['import-syntax']?.options ?? {};
    const maxDepth =
      typeof importOptions['maxDepth'] === 'number'
        ? importOptions['maxDepth']
        : undefined;
    rules.push(new ImportSyntaxRule(maxDepth));
  }
  if (config.rules['file-location']?.enabled !== false) {
    rules.push(new FileLocationRule());
  }
  if (config.rules['import-resolution']?.enabled !== false) {
    const importResOptions = config.rules['import-resolution']?.options ?? {};
    const maxDepth =
      typeof importResOptions['maxDepth'] === 'number'
        ? importResOptions['maxDepth']
        : undefined;
    rules.push(new ImportResolutionRule(maxDepth));
  }
  if (config.rules['content-appropriateness']?.enabled !== false) {
    const contentAppOptions =
      config.rules['content-appropriateness']?.options ?? {};
    rules.push(new ContentAppropriatenessRule(contentAppOptions));
  }
  if (config.rules['monorepo-hierarchy']?.enabled !== false) {
    rules.push(new MonorepoHierarchyRule());
  }
  if (config.rules['command-safety']?.enabled !== false) {
    rules.push(new CommandSafetyRule());
  }

  return rules;
}

/**
 * Format timestamp for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Clear the terminal screen
 */
function clearScreen(): void {
  process.stdout.write('\x1B[2J\x1B[0f');
}

export const watchCommand = new Command('watch')
  .description('Watch CLAUDE.md files for changes and lint on save')
  .argument(
    '[patterns...]',
    'File patterns to watch (default: CLAUDE.md, **/CLAUDE.md)'
  )
  .option('-r, --recursive', 'Watch directories recursively', true)
  .option('--no-recursive', 'Do not watch directories recursively')
  .option('--fix', 'Automatically fix problems on save', false)
  .option('--debounce <ms>', 'Debounce delay in milliseconds', '300')
  .option('--clear', 'Clear console between runs', false)
  .option('--no-clear', 'Do not clear console between runs')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (patterns: string[], options: WatchOptions) => {
    try {
      // Default patterns if none provided
      const watchPatterns =
        patterns.length > 0 ? patterns : ['CLAUDE.md', '**/CLAUDE.md'];

      // Parse debounce
      const debounceMs = parseInt(options.debounce, 10);
      if (isNaN(debounceMs) || debounceMs < 0) {
        console.error('Error: --debounce must be a non-negative number');
        process.exit(1);
      }

      // Load configuration
      const config = ConfigLoader.load(options.config);
      const rules = createRules(config);
      const engine = new RulesEngine(rules);
      const fileReader = new FileReader();

      // Create file watcher
      const watcher = new FileWatcher({
        patterns: watchPatterns,
        recursive: options.recursive,
        debounceMs,
      });

      // Print startup message
      console.log('\n👁️  Watching for changes...');
      console.log(`   Patterns: ${watchPatterns.join(', ')}`);
      console.log(`   Debounce: ${debounceMs}ms`);
      console.log(`   Auto-fix: ${options.fix ? 'enabled' : 'disabled'}`);
      console.log(`   Recursive: ${options.recursive ? 'yes' : 'no'}`);
      console.log('\nPress Ctrl+C to stop\n');

      // Handle file changes
      watcher.on('change', (event: FileChangeEvent) => {
        void (async (): Promise<void> => {
          if (options.clear) {
            clearScreen();
            console.log('👁️  Watching for changes...\n');
          }

          const timestamp = formatTime(event.timestamp);
          const relativePath = event.path;

          if (event.type === 'unlink') {
            console.log(`[${timestamp}] Deleted: ${relativePath}\n`);
            return;
          }

          console.log(
            `[${timestamp}] ${event.type === 'add' ? 'Added' : 'Changed'}: ${relativePath}`
          );

          try {
            const absolutePath = resolve(process.cwd(), relativePath);
            const contextFile = await fileReader.readContextFile(absolutePath);
            let result = engine.lint(contextFile);

            // Auto-fix if requested
            if (options.fix && result.violations.length > 0) {
              const fixes = AutoFixer.generateFixesForViolations(
                [...result.violations],
                contextFile.content,
                []
              );
              if (fixes.length > 0) {
                const fixResult = AutoFixer.applyFixes(
                  contextFile.content,
                  fixes
                );
                if (fixResult.fixed) {
                  writeFileSync(absolutePath, fixResult.content, 'utf8');
                  console.log(
                    `🔧 Applied ${fixResult.appliedFixes.length} fixes`
                  );

                  // Re-lint after fixes
                  const newContextFile =
                    await fileReader.readContextFile(absolutePath);
                  result = engine.lint(newContextFile);
                }
              }
            }

            // Display results
            const output = formatResult(result, 'text');
            console.log(output);
          } catch (error: unknown) {
            if (error instanceof Error) {
              console.error(`Error linting ${relativePath}: ${error.message}`);
            } else {
              console.error(`Error linting ${relativePath}: Unknown error`);
            }
          }

          console.log(''); // Empty line for readability
        })();
      });

      // Handle watcher errors
      watcher.on('error', (error: Error) => {
        console.error(`Watcher error: ${error.message}`);
      });

      // Start watching
      await watcher.start();

      // Handle graceful shutdown
      const shutdown = (): void => {
        console.log('\n\nStopping watcher...');
        void watcher.stop().then(() => {
          process.exit(0);
        });
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('Error: Unknown error occurred');
      }
      process.exit(1);
    }
  });
