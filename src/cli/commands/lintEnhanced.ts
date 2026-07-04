import { Command } from 'commander';
import { FileReader } from '../../infrastructure/FileReader.js';
import { RulesEngine } from '../../domain/RulesEngine.js';
import { buildSeverityOverrides } from '../../domain/Config.js';
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
import { SkillStructureRule } from '../../rules/SkillStructureRule.js';
import { SubagentStructureRule } from '../../rules/SubagentStructureRule.js';
import { HookConfigurationRule } from '../../rules/HookConfigurationRule.js';
import { KarpathyRule } from '../../rules/KarpathyRule.js';
import { formatResult } from '../formatters/textFormatter.js';
import { ConfigLoader } from '../../infrastructure/ConfigLoader.js';
import { AutoFixer } from '../../infrastructure/AutoFixer.js';
import { InteractiveFixer } from '../../infrastructure/InteractiveFixer.js';
import { RuleRegistry } from '../../infrastructure/RuleRegistry.js';
import { PluginLoader } from '../../infrastructure/PluginLoader.js';
import type { CustomRule } from '../../domain/CustomRule.js';
import { writeFileSync } from 'fs';
import { GitDiffProvider } from '../../infrastructure/GitDiffProvider.js';
import { LintingResult } from '../../domain/LintingResult.js';

export const lintEnhancedCommand = new Command('lint')
  .description('Lint a CLAUDE.md file')
  .argument('<file>', 'Path to the CLAUDE.md file to lint')
  .option('-f, --format <format>', 'Output format (text, json)', 'text')
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
      }
    ) => {
      try {
        // Load configuration
        const config = ConfigLoader.load(options.config);

        // Initialize plugin system
        const registry = new RuleRegistry();
        const pluginLoader = new PluginLoader(registry);

        // Load plugins if configured
        if (config.plugins && config.plugins.length > 0) {
          const pluginResult = await pluginLoader.loadPluginsFromConfig(
            config.plugins
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
        }

        const fileReader = new FileReader();
        const contextFile = await fileReader.readContextFile(file);

        const maxSize = parseInt(options.maxSize, 10);
        if (isNaN(maxSize) || maxSize <= 0) {
          console.error('Error: --max-size must be a positive number');
          process.exit(1);
        }

        // Create rules based on configuration
        const rules = [];

        // Add built-in rules
        if (config.rules['file-size']?.enabled) {
          // CLI option takes precedence over config
          const effectiveMaxSize =
            options.maxSize !== '10000'
              ? maxSize
              : (config.rules['file-size'].options?.maxSize ?? maxSize);
          rules.push(new FileSizeRule(effectiveMaxSize));
        }
        if (config.rules['structure']?.enabled) {
          rules.push(
            new StructureRule(
              config.rules['structure'].options?.requiredSections
            )
          );
        }
        // Support both 'content' (backward compat) and 'content-organization' (new)
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
          // Code block rule is enabled by default
          const codeBlockOptions = config.rules['code-blocks']?.options ?? {};
          rules.push(new CodeBlockRule(codeBlockOptions));
        }
        // New rules (v0.5.0+)
        if (config.rules['import-syntax']?.enabled !== false) {
          // Import syntax rule is enabled by default
          const importOptions = config.rules['import-syntax']?.options ?? {};
          const maxDepth =
            typeof importOptions['maxDepth'] === 'number'
              ? importOptions['maxDepth']
              : undefined;
          rules.push(new ImportSyntaxRule(maxDepth));
        }
        if (config.rules['file-location']?.enabled !== false) {
          // File location rule is enabled by default
          rules.push(new FileLocationRule());
        }
        // New rules (v0.6.0+) - 10/10 Anthropic alignment
        if (config.rules['import-resolution']?.enabled !== false) {
          const importResOptions =
            config.rules['import-resolution']?.options ?? {};
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
        // New rules (v0.11.0+) - Claude Code extended features
        if (config.rules['skill-structure']?.enabled !== false) {
          const skillOptions = config.rules['skill-structure']?.options ?? {};
          rules.push(new SkillStructureRule(skillOptions));
        }
        if (config.rules['subagent-structure']?.enabled !== false) {
          const agentOptions =
            config.rules['subagent-structure']?.options ?? {};
          rules.push(new SubagentStructureRule(agentOptions));
        }
        if (config.rules['hook-configuration']?.enabled !== false) {
          const hookOptions = config.rules['hook-configuration']?.options ?? {};
          rules.push(new HookConfigurationRule(hookOptions));
        }
        if (config.rules['karpathy']?.enabled !== false) {
          rules.push(new KarpathyRule());
        }

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
