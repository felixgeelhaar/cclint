import { Command } from 'commander';
import { FileReader } from '../../infrastructure/FileReader.js';
import { RulesEngine } from '../../domain/RulesEngine.js';
import {
  buildSeverityOverrides,
  type CclintConfig,
} from '../../domain/Config.js';
import { createRules } from '../../rules/registry/createRules.js';
import { formatResult } from '../formatters/textFormatter.js';
import { formatDirectoryResult } from '../formatters/directoryFormatter.js';
import { ConfigLoader } from '../../infrastructure/ConfigLoader.js';
import { AutoFixer } from '../../infrastructure/AutoFixer.js';
import { InteractiveFixer } from '../../infrastructure/InteractiveFixer.js';
import { RuleRegistry } from '../../infrastructure/RuleRegistry.js';
import { PluginLoader } from '../../infrastructure/PluginLoader.js';
import { FileDiscovery } from '../../infrastructure/FileDiscovery.js';
import type { CustomRule } from '../../domain/CustomRule.js';
import { existsSync, statSync, writeFileSync } from 'fs';
import { GitDiffProvider } from '../../infrastructure/GitDiffProvider.js';
import { LintingResult } from '../../domain/LintingResult.js';

export const lintEnhancedCommand = new Command('lint')
  .description('Lint a CLAUDE.md file, or a project directory of config files')
  .argument(
    '<path>',
    'Path to a config file, or a directory to lint project-wide'
  )
  .option('-f, --format <format>', 'Output format (text, json, sarif)', 'text')
  .option('--max-size <size>', 'Maximum file size in characters', '10000')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--fix', 'Automatically fix problems where possible')
  .option('-i, --interactive', 'Interactively fix problems one at a time')
  .option('--diff', 'Only show violations on changed lines')
  .option(
    '--diff-ref <ref>',
    'Git ref to compare against (default: HEAD)',
    'HEAD'
  )
  .option(
    '--plain',
    'Plain text output (no emoji) for CI logs and screen readers'
  )
  .option(
    '--summary',
    'Group violations by rule with counts (compact view for noisy files)'
  )
  .option(
    '--allow-plugins',
    'Load custom rule plugins declared in project config. Off by default: ' +
      'config-declared plugins execute code in-process, so loading them is ' +
      'opt-in (or set CCLINT_ALLOW_PLUGINS=1).'
  )
  .action(
    async (
      file: string,
      options: {
        format: string;
        maxSize: string;
        config?: string;
        fix?: boolean;
        interactive?: boolean;
        diff?: boolean;
        diffRef?: string;
        plain?: boolean;
        summary?: boolean;
        allowPlugins?: boolean;
      }
    ) => {
      try {
        // Load configuration
        const config = ConfigLoader.load(options.config);

        // Initialize plugin system
        const registry = new RuleRegistry();
        const pluginLoader = new PluginLoader(registry);

        // Load plugins if configured.
        //
        // SECURITY: plugins declared in a project's config execute arbitrary
        // code in-process. They are only loaded when the operator opts in
        // out-of-band via `--allow-plugins` or `CCLINT_ALLOW_PLUGINS=1` — a
        // gate the linted repository itself cannot set. Otherwise the plugins
        // are skipped (never imported) and the user is told how to enable them.
        if (config.plugins && config.plugins.length > 0) {
          const allowPlugins =
            options.allowPlugins === true ||
            process.env['CCLINT_ALLOW_PLUGINS'] === '1';

          const pluginResult = await pluginLoader.loadPluginsFromConfig(
            config.plugins,
            { allowPlugins }
          );

          if (pluginResult.loaded.length > 0) {
            console.log(
              `📦 Loaded ${pluginResult.loaded.length} plugin(s): ${pluginResult.loaded.join(', ')}`
            );
          }

          if (pluginResult.failed.length > 0) {
            console.warn(
              `⚠️ Failed to load ${pluginResult.failed.length} plugin(s):`
            );
            pluginResult.failed.forEach(failure => {
              console.warn(`  - ${failure.name}: ${failure.error.message}`);
            });
          }

          if (pluginResult.skipped.length > 0) {
            console.warn(
              `🔒 Skipped ${pluginResult.skipped.length} config-declared plugin(s) for security: ${pluginResult.skipped.join(', ')}`
            );
            console.warn(
              '   Plugins run arbitrary code in-process. If you trust this ' +
                "project's plugins, re-run with --allow-plugins (or set " +
                'CCLINT_ALLOW_PLUGINS=1) to enable them.'
            );
          }
        }

        const fileReader = new FileReader();

        const maxSize = parseInt(options.maxSize, 10);
        if (isNaN(maxSize) || maxSize <= 0) {
          console.error('Error: --max-size must be a positive number');
          process.exit(1);
        }

        // Build the built-in rules from the single canonical factory. The CLI
        // `--max-size` flag still takes precedence over config when the user
        // set it explicitly (i.e. it differs from the default).
        const effectiveConfig: CclintConfig =
          options.maxSize !== '10000'
            ? {
                ...config,
                rules: {
                  ...config.rules,
                  'file-size': {
                    ...config.rules['file-size'],
                    enabled: config.rules['file-size']?.enabled ?? false,
                    options: {
                      ...config.rules['file-size']?.options,
                      maxSize,
                    },
                  },
                },
              }
            : config;
        const rules = createRules(effectiveConfig);

        // Add custom rules from plugins
        const allCustomRules = registry.getAllRules();
        const enabledCustomRules: CustomRule[] = [];
        for (const rule of allCustomRules) {
          // Only CustomRule instances have generateFixes method
          if (
            'generateFixes' in rule &&
            typeof rule.generateFixes === 'function'
          ) {
            const customRule = rule as CustomRule;
            // Check if the custom rule is enabled in configuration
            const ruleConfig = config.rules[customRule.id];
            if (ruleConfig?.enabled !== false) {
              rules.push(customRule);
              enabledCustomRules.push(customRule);
            }
          }
        }

        const engine = new RulesEngine(rules, buildSeverityOverrides(config));

        // Project-wide lint: when the target is a directory, discover every
        // Claude Code config file and lint each through the SAME rule pipeline.
        // Single-file behavior below is left entirely unchanged.
        if (isDirectoryTarget(file)) {
          await lintDirectory(file, engine, fileReader, {
            format: options.format,
            plain: options.plain,
            summary: options.summary,
          });
          return;
        }

        const contextFile = await fileReader.readContextFile(file);
        let result = engine.lint(contextFile);

        // Filter violations to changed lines if --diff is enabled
        if (options.diff) {
          const diffProvider = new GitDiffProvider();
          if (diffProvider.isGitRepository()) {
            const diffOptions = options.diffRef ? { ref: options.diffRef } : {};
            const diffInfo = diffProvider.getFileDiffInfo(file, diffOptions);

            if (!diffInfo.isNew) {
              // Filter violations to only those on changed lines
              const filteredViolations = [...result.violations].filter(
                violation =>
                  diffProvider.isLineChanged(violation.location.line, diffInfo)
              );

              // Create a new result with filtered violations
              const filteredResult = new LintingResult(contextFile);
              filteredViolations.forEach(v => filteredResult.addViolation(v));
              result = filteredResult;

              if (filteredViolations.length === 0) {
                console.log(
                  `✅ No violations found on changed lines (comparing to ${options.diffRef ?? 'HEAD'})`
                );
                process.exit(0);
              }

              console.log(
                `📝 Showing ${filteredViolations.length} violation(s) on changed lines (comparing to ${options.diffRef ?? 'HEAD'})\n`
              );
            }
          } else {
            console.warn(
              '⚠️  Not a git repository. Running lint without diff filtering.\n'
            );
          }
        }

        // Interactive fix if requested
        if (options.interactive) {
          const interactiveFixer = new InteractiveFixer();
          const fixResult = await interactiveFixer.fix(
            contextFile.content,
            [...result.violations],
            enabledCustomRules
          );

          if (fixResult.fixed) {
            writeFileSync(file, fixResult.content, 'utf8');

            // Re-lint after fixes
            const newContextFile = await fileReader.readContextFile(file);
            const newResult = engine.lint(newContextFile);

            const output = formatResult(newResult, options.format, {
              plain: options.plain,
            });
            console.log(output);

            if (newResult.getErrorCount() > 0) {
              process.exit(1);
            }
            process.exit(0);
          }
        }

        // Auto-fix if requested
        if (options.fix) {
          const fixes = AutoFixer.generateFixesForViolations(
            [...result.violations],
            contextFile.content,
            enabledCustomRules
          );
          if (fixes.length > 0) {
            const fixResult = AutoFixer.applyFixes(contextFile.content, fixes);
            if (fixResult.fixed) {
              writeFileSync(file, fixResult.content, 'utf8');
              console.log(
                `🔧 Applied ${fixResult.appliedFixes.length} fixes to ${file}`
              );

              // Re-lint after fixes
              const newContextFile = await fileReader.readContextFile(file);
              const newResult = engine.lint(newContextFile);

              const output = formatResult(newResult, options.format, {
                plain: options.plain,
              });
              console.log(output);

              if (newResult.getErrorCount() > 0) {
                process.exit(1);
              }
              process.exit(0);
            }
          }
        }

        const fixableFixes = AutoFixer.generateFixesForViolations(
          [...result.violations],
          contextFile.content,
          enabledCustomRules
        );
        const fixableCount = new Set(
          fixableFixes.map(f => `${f.range.start.line}:${f.range.start.column}`)
        ).size;

        const output = formatResult(result, options.format, {
          plain: options.plain,
          summary: options.summary,
          fixableCount,
        });
        console.log(output);

        if (result.getErrorCount() > 0) {
          process.exit(1);
        } else if (result.getWarningCount() > 0) {
          process.exit(0);
        }

        process.exit(0);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(`Error: ${error.message}`);
        } else {
          console.error('Error: Unknown error occurred');
        }
        process.exit(1);
      }
    }
  );

/**
 * Whether a target path is an existing directory (as opposed to a file).
 *
 * @remarks
 * Missing or unreadable paths report `false` so the caller falls through to the
 * single-file flow, where {@link FileReader} raises a precise, user-facing error.
 */
function isDirectoryTarget(target: string): boolean {
  try {
    return existsSync(target) && statSync(target).isDirectory();
  } catch {
    return false;
  }
}

interface DirectoryLintOptions {
  format: string;
  plain?: boolean | undefined;
  summary?: boolean | undefined;
}

/**
 * Discover and lint every Claude Code config file under a project directory,
 * then report aggregated results and exit with a non-zero code if ANY file has
 * an error-severity violation.
 *
 * @remarks
 * Reuses the exact `RulesEngine` built for single-file linting; each file is
 * read via {@link FileReader} and only receives the rules that self-gate to its
 * kind (via `Rule.appliesTo`). An unreadable individual file is reported and
 * skipped rather than aborting the whole run.
 */
async function lintDirectory(
  dir: string,
  engine: RulesEngine,
  fileReader: FileReader,
  options: DirectoryLintOptions
): Promise<void> {
  const files = new FileDiscovery().discover(dir);

  if (files.length === 0) {
    console.log(
      `No Claude Code config files found in ${dir}. Nothing to lint.`
    );
    process.exit(0);
  }

  const results: LintingResult[] = [];
  for (const filePath of files) {
    try {
      const contextFile = await fileReader.readContextFile(filePath);
      results.push(engine.lint(contextFile));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`⚠️  Skipped ${filePath}: ${message}`);
    }
  }

  if (results.length === 0) {
    console.log(`No lintable config files found in ${dir}.`);
    process.exit(0);
  }

  const output = formatDirectoryResult(results, options.format, {
    plain: options.plain,
    summary: options.summary,
  });
  console.log(output);

  const hasError = results.some(result => result.getErrorCount() > 0);
  process.exit(hasError ? 1 : 0);
}
