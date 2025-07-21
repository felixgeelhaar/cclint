import { Command } from 'commander';
import { FileReader } from '../../infrastructure/FileReader.js';
import { RulesEngine } from '../../domain/RulesEngine.js';
import { FileSizeRule } from '../../rules/FileSizeRule.js';
import { StructureRule } from '../../rules/StructureRule.js';
import { ContentRule } from '../../rules/ContentRule.js';
import { FormatRule } from '../../rules/FormatRule.js';
import { formatResult } from '../formatters/textFormatter.js';
import { ConfigLoader } from '../../infrastructure/ConfigLoader.js';
import { AutoFixer } from '../../infrastructure/AutoFixer.js';
import { writeFileSync } from 'fs';

export const lintEnhancedCommand = new Command('lint')
  .description('Lint a CLAUDE.md file')
  .argument('<file>', 'Path to the CLAUDE.md file to lint')
  .option('-f, --format <format>', 'Output format (text, json)', 'text')
  .option('--max-size <size>', 'Maximum file size in characters', '10000')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--fix', 'Automatically fix problems where possible')
  .action(
    async (
      file: string,
      options: {
        format: string;
        maxSize: string;
        config?: string;
        fix?: boolean;
      }
    ) => {
      try {
        // Load configuration
        const config = ConfigLoader.load(options.config);

        const fileReader = new FileReader();
        const contextFile = await fileReader.readContextFile(file);

        const maxSize = parseInt(options.maxSize, 10);
        if (isNaN(maxSize) || maxSize <= 0) {
          console.error('Error: --max-size must be a positive number');
          process.exit(1);
        }

        // Create rules based on configuration
        const rules = [];
        if (config.rules['file-size']?.enabled) {
          // CLI option takes precedence over config
          const effectiveMaxSize = options.maxSize !== '10000' 
            ? maxSize 
            : config.rules['file-size'].options?.maxSize || maxSize;
          rules.push(new FileSizeRule(effectiveMaxSize));
        }
        if (config.rules['structure']?.enabled) {
          rules.push(new StructureRule());
        }
        if (config.rules['content']?.enabled) {
          rules.push(new ContentRule());
        }
        if (config.rules['format']?.enabled) {
          rules.push(new FormatRule());
        }

        const engine = new RulesEngine(rules);
        const result = engine.lint(contextFile);

        // Auto-fix if requested
        if (options.fix) {
          const fixes = AutoFixer.generateFixesForViolations(
            [...result.violations],
            contextFile.content
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

              const output = formatResult(newResult, options.format);
              console.log(output);

              if (newResult.getErrorCount() > 0) {
                process.exit(1);
              }
              process.exit(0);
            }
          }
        }

        const output = formatResult(result, options.format);
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
