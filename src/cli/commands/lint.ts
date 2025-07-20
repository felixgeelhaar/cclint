import { Command } from 'commander';
import { FileReader } from '../../infrastructure/FileReader.js';
import { RulesEngine } from '../../domain/RulesEngine.js';
import { FileSizeRule } from '../../rules/FileSizeRule.js';
import { StructureRule } from '../../rules/StructureRule.js';
import { ContentRule } from '../../rules/ContentRule.js';
import { FormatRule } from '../../rules/FormatRule.js';
import { formatResult } from '../formatters/textFormatter.js';

export const lintCommand = new Command('lint')
  .description('Lint a CLAUDE.md file')
  .argument('<file>', 'Path to the CLAUDE.md file to lint')
  .option('-f, --format <format>', 'Output format (text, json)', 'text')
  .option('--max-size <size>', 'Maximum file size in characters', '10000')
  .action(
    async (file: string, options: { format: string; maxSize: string }) => {
      try {
        const fileReader = new FileReader();
        const contextFile = await fileReader.readContextFile(file);

        const maxSize = parseInt(options.maxSize, 10);
        if (isNaN(maxSize) || maxSize <= 0) {
          console.error('Error: --max-size must be a positive number');
          process.exit(1);
        }

        const rules = [
          new FileSizeRule(maxSize),
          new StructureRule(),
          new ContentRule(),
          new FormatRule(),
        ];

        const engine = new RulesEngine(rules);
        const result = engine.lint(contextFile);

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
