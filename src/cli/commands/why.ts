import { Command } from 'commander';
import { readFileSync } from 'fs';
import { ContextFile } from '../../domain/ContextFile.js';
import { Severity } from '../../domain/Severity.js';
import { RulesEngine } from '../../domain/RulesEngine.js';
import { createRules } from '../../rules/registry/createRules.js';
import { ConfigLoader } from '../../infrastructure/ConfigLoader.js';
import { RULE_METADATA } from '../../infrastructure/RuleMetadata.js';
import { resolveAiOptions } from '../../infrastructure/ai/anthropicClient.js';
import type { AiProviderName } from '../../domain/Config.js';
import { suggestViolationFix } from '../../infrastructure/ai/suggestViolationFix.js';

interface WhyOptions {
  rule?: string;
  line?: string;
  ai?: boolean;
  provider?: string;
}

function parseProvider(raw: string | undefined): AiProviderName | undefined {
  if (raw === undefined) return undefined;
  if (raw === 'anthropic' || raw === 'ollama') return raw;
  throw new Error(
    `Unknown AI provider "${raw}". Use "anthropic" or "ollama".`
  );
}

function severityName(s: Severity): string {
  if (s === Severity.ERROR) return 'error';
  if (s === Severity.WARNING) return 'warning';
  return 'info';
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
    'Use Anthropic API (or --provider ollama) to generate a context-aware fix. Requires ANTHROPIC_API_KEY unless using ollama.'
  )
  .option(
    '--provider <name>',
    'AI provider: anthropic (default) or ollama (with --ai)'
  )
  .action(async (file: string, options: WhyOptions) => {
    try {
      const content = readFileSync(file, 'utf-8');
      const contextFile = new ContextFile(file, content);
      const config = ConfigLoader.load();
      const engine = new RulesEngine(createRules(config));
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

      let ai:
        | ReturnType<typeof resolveAiOptions>
        | undefined;
      const useAi = options.ai === true;
      if (useAi) {
        try {
          const resolveOpts: Parameters<typeof resolveAiOptions>[1] = {
            maxTokens: 400,
          };
          const provider = parseProvider(options.provider);
          if (provider !== undefined) resolveOpts.provider = provider;
          ai = resolveAiOptions(config.ai, resolveOpts);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Error: ${msg}`);
          process.exit(1);
        }
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
        if (useAi && ai !== undefined) {
          try {
            const fixOpts: Parameters<typeof suggestViolationFix>[0] = {
              ai,
              file,
              content,
              violation: v,
            };
            if (meta?.rationale !== undefined) {
              fixOpts.rationale = meta.rationale;
            }
            const suggestion = await suggestViolationFix(fixOpts);
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
