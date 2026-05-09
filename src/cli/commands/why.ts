import { Command } from 'commander';
import { readFileSync } from 'fs';
import { ContextFile } from '../../domain/ContextFile.js';
import { Severity } from '../../domain/Severity.js';
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
import { SkillStructureRule } from '../../rules/SkillStructureRule.js';
import { SubagentStructureRule } from '../../rules/SubagentStructureRule.js';
import { HookConfigurationRule } from '../../rules/HookConfigurationRule.js';
import { RULE_METADATA } from '../../infrastructure/RuleMetadata.js';

interface WhyOptions {
  rule?: string;
  line?: string;
  ai?: boolean;
}

function buildEngine(): RulesEngine {
  return new RulesEngine([
    new FileSizeRule(10000),
    new StructureRule(),
    new ContentOrganizationRule(),
    new FormatRule(),
    new CodeBlockRule(),
    new ImportSyntaxRule(),
    new FileLocationRule(),
    new ImportResolutionRule(),
    new ContentAppropriatenessRule(),
    new MonorepoHierarchyRule(),
    new CommandSafetyRule(),
    new SkillStructureRule(),
    new SubagentStructureRule(),
    new HookConfigurationRule(),
  ]);
}

function severityName(s: Severity): string {
  if (s === Severity.ERROR) return 'error';
  if (s === Severity.WARNING) return 'warning';
  return 'info';
}

async function explainViaClaude(
  apiKey: string,
  ruleId: string,
  ruleRationale: string,
  violation: { message: string; line: number },
  fileContent: string,
  filePath: string
): Promise<string> {
  const offendingLine = fileContent.split('\n')[violation.line - 1] ?? '';
  const prompt = `You are helping a developer fix a CLAUDE.md linter violation.

Rule: ${ruleId}
Rationale: ${ruleRationale}
Violation message: ${violation.message}
File: ${filePath}
Offending line ${violation.line}: ${offendingLine}

Give a concise (3-6 lines) actionable suggestion. Show a concrete rewrite or fix. Do not restate the rule.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Anthropic API error ${response.status}: ${body.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find(b => b.type === 'text')?.text;
  return text ?? '(empty response)';
}

export const whyCommand = new Command('why')
  .description(
    'Explain a violation in plain language and (optionally) get an AI fix suggestion. Pair with --ai and ANTHROPIC_API_KEY for context-aware suggestions.'
  )
  .argument('<file>', 'Path to the CLAUDE.md file with the violation')
  .option(
    '-r, --rule <rule-id>',
    'Filter to a specific rule id (e.g. "command-safety")'
  )
  .option('-l, --line <line>', 'Filter to violations on a specific line')
  .option(
    '--ai',
    'Use Anthropic API to generate a context-aware fix. Requires ANTHROPIC_API_KEY env var.'
  )
  .action(async (file: string, options: WhyOptions) => {
    try {
      const content = readFileSync(file, 'utf-8');
      const contextFile = new ContextFile(file, content);
      const engine = buildEngine();
      const result = engine.lint(contextFile);

      let violations = [...result.violations];
      if (options.rule !== undefined) {
        violations = violations.filter(v => v.ruleId === options.rule);
      }
      if (options.line !== undefined) {
        const lineNum = parseInt(options.line, 10);
        violations = violations.filter(v => v.location.line === lineNum);
      }

      if (violations.length === 0) {
        console.log('No matching violations found.');
        return;
      }

      const apiKey = process.env['ANTHROPIC_API_KEY'];
      const useAi = options.ai === true;
      if (useAi && (apiKey === undefined || apiKey === '')) {
        console.error(
          'Error: --ai requires ANTHROPIC_API_KEY environment variable.'
        );
        process.exit(1);
      }

      for (const v of violations) {
        const meta = RULE_METADATA[v.ruleId];
        console.log(
          `\n[${severityName(v.severity).toUpperCase()}] ${v.ruleId} at ${v.location.line}:${v.location.column}`
        );
        console.log(`  ${v.message}`);
        if (meta) {
          console.log(`\nWhy this rule exists:`);
          console.log(`  ${meta.rationale}`);
          if (meta.goodExamples[0]) {
            console.log(`\nGood example:`);
            console.log(`  ${meta.goodExamples[0].code}`);
            console.log(`  → ${meta.goodExamples[0].explanation}`);
          }
        }
        if (useAi && apiKey !== undefined) {
          try {
            const suggestion = await explainViaClaude(
              apiKey,
              v.ruleId,
              meta?.rationale ?? '',
              { message: v.message, line: v.location.line },
              content,
              file
            );
            console.log(`\nAI suggestion:`);
            console.log(
              suggestion
                .split('\n')
                .map(l => `  ${l}`)
                .join('\n')
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`\n  AI suggestion unavailable: ${msg}`);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
  });
