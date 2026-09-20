import { Command } from 'commander';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { RulesEngine } from '../../domain/RulesEngine.js';
import { createRules } from '../../rules/registry/createRules.js';
import { ConfigLoader } from '../../infrastructure/ConfigLoader.js';
import { FileDiscovery } from '../../infrastructure/FileDiscovery.js';
import { FileReader } from '../../infrastructure/FileReader.js';
import { shouldIgnorePath } from '../../infrastructure/ignoreMatch.js';
import {
  completeAnthropicText,
  requireAnthropicApiKey,
} from '../../infrastructure/ai/anthropicClient.js';

interface AnalyzeOptions {
  ai?: boolean;
  config?: string;
}

interface KindCounts {
  claude: number;
  agents: number;
  rules: number;
  skills: number;
  agentsConfig: number;
  other: number;
}

function classify(path: string): keyof KindCounts {
  if (/AGENTS\.md$/i.test(path)) return 'agents';
  if (/\.claude\/rules\//i.test(path)) return 'rules';
  if (/\.claude\/skills\//i.test(path)) return 'skills';
  if (/\.claude\/agents\//i.test(path)) return 'agentsConfig';
  if (/CLAUDE(\.local)?\.md$/i.test(path)) return 'claude';
  return 'other';
}

export const analyzeCommand = new Command('analyze')
  .description(
    'Summarize project instruction health (file kinds + lint findings). Pass --ai for a narrative (needs ANTHROPIC_API_KEY).'
  )
  .argument('[path]', 'Project directory or single file (default: .)', '.')
  .option('--ai', 'Ask Claude for a short health narrative')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (target: string, options: AnalyzeOptions) => {
    try {
      // Fail fast on --ai so empty trees still surface missing credentials.
      if (options.ai === true) {
        requireAnthropicApiKey();
      }

      const config = ConfigLoader.load(options.config);
      const engine = new RulesEngine(createRules(config));
      const root = resolve(target);

      const files: string[] = [];
      if (existsSync(root) && statSync(root).isDirectory()) {
        const discovered = new FileDiscovery().discover(root);
        files.push(
          ...discovered.filter(
            f => !shouldIgnorePath(f, config.ignore, { projectRoot: root })
          )
        );
      } else if (existsSync(root) && statSync(root).isFile()) {
        files.push(root);
      } else {
        console.error(`Error: path not found: ${target}`);
        process.exit(1);
      }

      if (files.length === 0) {
        console.log('No Claude Code config / instruction files found.');
        process.exit(0);
      }

      const kinds: KindCounts = {
        claude: 0,
        agents: 0,
        rules: 0,
        skills: 0,
        agentsConfig: 0,
        other: 0,
      };
      const byRule = new Map<string, number>();
      let errors = 0;
      let warnings = 0;
      let infos = 0;
      const reader = new FileReader();
      const fileSummaries: string[] = [];

      for (const filePath of files) {
        kinds[classify(filePath)]++;
        try {
          const contextFile = await reader.readContextFile(filePath);
          const result = engine.lint(contextFile);
          const e = result.getErrorCount();
          const w = result.getWarningCount();
          const i = result.getInfoCount();
          errors += e;
          warnings += w;
          infos += i;
          for (const v of result.violations) {
            byRule.set(v.ruleId, (byRule.get(v.ruleId) ?? 0) + 1);
          }
          if (result.violations.length > 0) {
            fileSummaries.push(`${filePath}: ${e}e/${w}w/${i}i`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          fileSummaries.push(`${filePath}: skipped (${msg})`);
        }
      }

      const topRules = [...byRule.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      console.log(`Instruction health for ${root}`);
      console.log(`Files: ${files.length}`);
      console.log(
        `  CLAUDE.md: ${kinds.claude}  AGENTS.md: ${kinds.agents}  rules: ${kinds.rules}  skills: ${kinds.skills}  agents: ${kinds.agentsConfig}  other: ${kinds.other}`
      );
      console.log(
        `Findings: ${errors} errors, ${warnings} warnings, ${infos} info`
      );
      if (topRules.length > 0) {
        console.log('Top rules:');
        for (const [id, count] of topRules) {
          console.log(`  ${id}: ${count}`);
        }
      }
      if (fileSummaries.length > 0) {
        console.log('Files with findings:');
        for (const line of fileSummaries.slice(0, 30)) {
          console.log(`  ${line}`);
        }
        if (fileSummaries.length > 30) {
          console.log(`  …and ${fileSummaries.length - 30} more`);
        }
      }

      if (options.ai === true) {
        const apiKey = requireAnthropicApiKey();
        const prompt = `You are reviewing a Claude Code / AGENTS.md project instruction setup.

Stats:
- Root: ${root}
- Files: ${files.length} (CLAUDE=${kinds.claude}, AGENTS=${kinds.agents}, rules=${kinds.rules}, skills=${kinds.skills}, subagents=${kinds.agentsConfig}, other=${kinds.other})
- Findings: ${errors} errors, ${warnings} warnings, ${infos} info
- Top rules: ${topRules.map(([id, n]) => `${id}(${n})`).join(', ') || '(none)'}
- Sample files with findings: ${fileSummaries.slice(0, 15).join('; ') || '(none)'}

Write a short (6–12 lines) health assessment and prioritized next steps. Mention AGENTS.md fallback / .claude/rules / hooks where relevant.`;

        const narrative = await completeAnthropicText({
          apiKey,
          prompt,
          maxTokens: 700,
        });
        console.log('\nAI narrative:\n');
        console.log(narrative);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
  });
