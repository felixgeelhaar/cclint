import { Command } from 'commander';
import { readFileSync, existsSync, statSync } from 'fs';
import { ContextFile } from '../../domain/ContextFile.js';
import { Severity } from '../../domain/Severity.js';
import { RulesEngine } from '../../domain/RulesEngine.js';
import { createRules } from '../../rules/registry/createRules.js';
import { ConfigLoader } from '../../infrastructure/ConfigLoader.js';
import {
  completeAnthropicText,
  requireAnthropicApiKey,
} from '../../infrastructure/ai/anthropicClient.js';

interface SuggestOptions {
  maxTokens?: string;
}

function severityName(s: Severity): string {
  if (s === Severity.ERROR) return 'error';
  if (s === Severity.WARNING) return 'warning';
  return 'info';
}

export const suggestCommand = new Command('suggest')
  .description(
    'Ask Claude for concrete improvements to a project instruction file (requires ANTHROPIC_API_KEY)'
  )
  .argument('<file>', 'Path to CLAUDE.md / AGENTS.md / instruction file')
  .option('--max-tokens <n>', 'Max tokens for the suggestion', '1200')
  .action(async (file: string, options: SuggestOptions) => {
    try {
      if (!existsSync(file) || !statSync(file).isFile()) {
        console.error(`Error: file not found: ${file}`);
        process.exit(1);
      }

      const apiKey = requireAnthropicApiKey();
      const content = readFileSync(file, 'utf-8');
      const contextFile = new ContextFile(file, content);
      const engine = new RulesEngine(createRules(ConfigLoader.load()));
      const result = engine.lint(contextFile);

      const violationSummary =
        result.violations.length === 0
          ? '(no current violations)'
          : result.violations
              .slice(0, 20)
              .map(
                v =>
                  `- [${severityName(v.severity)}] ${v.ruleId}: ${v.message} (L${v.location.line})`
              )
              .join('\n');

      const excerpt =
        content.length > 6000
          ? `${content.slice(0, 6000)}\n\n…(truncated)`
          : content;

      const prompt = `You are an expert on Claude Code / AGENTS.md project instruction files.

File: ${file}
Current linter findings:
${violationSummary}

File contents:
\`\`\`markdown
${excerpt}
\`\`\`

Propose a numbered list of concrete improvements (5–10 items). Prefer:
- shorter, higher-signal instructions
- moving path-specific detail to .claude/rules/
- @AGENTS.md bridges when useful
- hooks/permissions for hard constraints
Do not rewrite the entire file unless necessary. Be specific to this content.`;

      const maxTokens = parseInt(options.maxTokens ?? '1200', 10);
      const suggestion = await completeAnthropicText({
        apiKey,
        prompt,
        maxTokens: Number.isFinite(maxTokens) ? maxTokens : 1200,
      });

      console.log(`Suggestions for ${file}:\n`);
      console.log(suggestion);

      if (result.violations.length > 0) {
        console.log(
          `\n(${result.violations.length} current violation(s) informed this suggestion — run \`cclint lint ${file}\` for details.)`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
  });
