import { Command } from 'commander';
import { existsSync, statSync, writeFileSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { RulesEngine } from '../../domain/RulesEngine.js';
import { createRules } from '../../rules/registry/createRules.js';
import { ConfigLoader } from '../../infrastructure/ConfigLoader.js';
import { FileDiscovery } from '../../infrastructure/FileDiscovery.js';
import { FileReader } from '../../infrastructure/FileReader.js';
import { shouldIgnorePath } from '../../infrastructure/ignoreMatch.js';
import { ProjectDetector } from '../../infrastructure/ProjectDetector.js';
import { Scaffolder } from '../../infrastructure/Scaffolder.js';
import {
  completeAiText,
  resolveAiOptions,
} from '../../infrastructure/ai/anthropicClient.js';
import type { AiProviderName } from '../../domain/Config.js';

interface AnalyzeOptions {
  ai?: boolean;
  config?: string;
  draft?: boolean;
  write?: boolean;
  provider?: string;
}

function parseProvider(raw: string | undefined): AiProviderName | undefined {
  if (raw === undefined) return undefined;
  if (raw === 'anthropic' || raw === 'ollama') return raw;
  throw new Error(
    `Unknown AI provider "${raw}". Use "anthropic" or "ollama".`
  );
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

function resolveProjectRoot(root: string): string {
  if (existsSync(root) && statSync(root).isDirectory()) {
    return root;
  }
  return dirname(root);
}

function printDraft(projectRoot: string, write: boolean): void {
  const detector = new ProjectDetector(projectRoot);
  const detection = detector.detect();
  const scaffolder = new Scaffolder();
  const template = scaffolder.getTemplateForDetection(detection);
  const outputPath = join(projectRoot, 'CLAUDE.md');
  const projectName = detection.projectName ?? basename(projectRoot);
  const projectDescription =
    detection.projectDescription ?? 'A brief description of the project.';

  console.log('\nDraft CLAUDE.md (codebase-aware)');
  console.log(`  Detected type: ${detection.type}`);
  console.log(`  Structure: ${detection.structure}`);
  console.log(
    `  Confidence: ${Math.round(detection.confidence * 100)}%`
  );
  if (detection.evidence.length > 0) {
    console.log(`  Evidence: ${detection.evidence.join(', ')}`);
  }
  console.log(`  Template: ${template}`);
  console.log('');

  const { content } = scaffolder.preview({
    template,
    projectName,
    projectDescription,
    outputPath,
    detection,
  });

  console.log('----- BEGIN DRAFT -----');
  console.log(content.trimEnd());
  console.log('----- END DRAFT -----');

  if (!write) {
    console.log(
      '\nPreview only. Re-run with --draft --write to create CLAUDE.md when missing.'
    );
    return;
  }

  if (existsSync(outputPath)) {
    console.error(
      `\nError: ${outputPath} already exists. Refusing to overwrite; use \`cclint init --force\` if you intend to replace it.`
    );
    process.exit(1);
  }

  writeFileSync(outputPath, content, 'utf8');
  console.log(`\nWrote ${outputPath}`);
}

export const analyzeCommand = new Command('analyze')
  .description(
    'Summarize project instruction health (file kinds + lint findings). Pass --ai for a narrative (needs ANTHROPIC_API_KEY). Pass --draft for a codebase-aware CLAUDE.md preview.'
  )
  .argument('[path]', 'Project directory or single file (default: .)', '.')
  .option('--ai', 'Ask Claude for a short health narrative')
  .option(
    '--draft',
    'Generate a codebase-aware CLAUDE.md draft via ProjectDetector (preview)'
  )
  .option(
    '--write',
    'With --draft: write CLAUDE.md only if it does not already exist'
  )
  .option(
    '--provider <name>',
    'AI provider for --ai: anthropic (default) or ollama'
  )
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (target: string, options: AnalyzeOptions) => {
    try {
      if (options.write === true && options.draft !== true) {
        console.error('Error: --write requires --draft');
        process.exit(1);
      }

      const config = ConfigLoader.load(options.config);

      // Fail fast on --ai so empty trees still surface missing credentials / disabled AI.
      let aiOptions: ReturnType<typeof resolveAiOptions> | undefined;
      if (options.ai === true) {
        const resolveOpts: Parameters<typeof resolveAiOptions>[1] = {
          maxTokens: 700,
        };
        const provider = parseProvider(options.provider);
        if (provider !== undefined) resolveOpts.provider = provider;
        aiOptions = resolveAiOptions(config.ai, resolveOpts);
      }

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

      if (files.length === 0 && options.draft !== true) {
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

      if (files.length === 0) {
        console.log('No Claude Code config / instruction files found.');
      } else {
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

        if (options.ai === true && aiOptions !== undefined) {
          const prompt = `You are reviewing a Claude Code / AGENTS.md project instruction setup.

Stats:
- Root: ${root}
- Files: ${files.length} (CLAUDE=${kinds.claude}, AGENTS=${kinds.agents}, rules=${kinds.rules}, skills=${kinds.skills}, subagents=${kinds.agentsConfig}, other=${kinds.other})
- Findings: ${errors} errors, ${warnings} warnings, ${infos} info
- Top rules: ${topRules.map(([id, n]) => `${id}(${n})`).join(', ') || '(none)'}
- Sample files with findings: ${fileSummaries.slice(0, 15).join('; ') || '(none)'}

Write a short (6–12 lines) health assessment and prioritized next steps. Mention AGENTS.md fallback / .claude/rules / hooks where relevant.`;

          const narrative = await completeAiText({
            ...aiOptions,
            prompt,
          });
          console.log('\nAI narrative:\n');
          console.log(narrative);
        }
      }

      if (options.draft === true) {
        printDraft(resolveProjectRoot(root), options.write === true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
  });
