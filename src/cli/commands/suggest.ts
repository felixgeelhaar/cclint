import { Command } from 'commander';
import { readFileSync, existsSync, statSync } from 'fs';
import { dirname } from 'path';
import { ContextFile } from '../../domain/ContextFile.js';
import { Severity } from '../../domain/Severity.js';
import { RulesEngine } from '../../domain/RulesEngine.js';
import { createRules } from '../../rules/registry/createRules.js';
import { ConfigLoader } from '../../infrastructure/ConfigLoader.js';
import { ProjectDetector } from '../../infrastructure/ProjectDetector.js';
import {
  completeAnthropicText,
  resolveAiOptions,
} from '../../infrastructure/ai/anthropicClient.js';

interface SuggestOptions {
  maxTokens?: string;
  generateMissing?: boolean;
  rewriteGeneric?: boolean;
}

function severityName(s: Severity): string {
  if (s === Severity.ERROR) return 'error';
  if (s === Severity.WARNING) return 'warning';
  return 'info';
}

function buildFocusInstructions(options: SuggestOptions): string {
  const parts: string[] = [];
  if (options.generateMissing === true) {
    parts.push(
      'Focus on generating missing required sections (Project Overview, Development Commands, Architecture, etc.) with concrete project-specific content — not placeholders.'
    );
  }
  if (options.rewriteGeneric === true) {
    parts.push(
      'Focus on rewriting vague or generic instructions into specific, actionable guidance tied to this project’s stack and layout.'
    );
  }
  if (parts.length === 0) {
    return `Propose a numbered list of concrete improvements (5–10 items). Prefer:
- shorter, higher-signal instructions
- moving path-specific detail to .claude/rules/
- @AGENTS.md bridges when useful
- hooks/permissions for hard constraints
Do not rewrite the entire file unless necessary. Be specific to this content.`;
  }
  return `${parts.join('\n')}
Propose a numbered list of concrete improvements (5–10 items). Be specific to this content; avoid rewriting the entire file unless necessary.`;
}

export const suggestCommand = new Command('suggest')
  .description(
    'Ask Claude for concrete improvements to a project instruction file (requires ANTHROPIC_API_KEY)'
  )
  .argument('<file>', 'Path to CLAUDE.md / AGENTS.md / instruction file')
  .option('--max-tokens <n>', 'Max tokens for the suggestion', '1200')
  .option(
    '--generate-missing',
    'Bias suggestions toward filling missing required sections (uses ProjectDetector context)'
  )
  .option(
    '--rewrite-generic',
    'Bias suggestions toward rewriting vague / generic instructions'
  )
  .action(async (file: string, options: SuggestOptions) => {
    try {
      if (!existsSync(file) || !statSync(file).isFile()) {
        console.error(`Error: file not found: ${file}`);
        process.exit(1);
      }

      const config = ConfigLoader.load();
      const maxTokensOverride = parseInt(options.maxTokens ?? '1200', 10);
      const ai = resolveAiOptions(config.ai, {
        maxTokens: Number.isFinite(maxTokensOverride)
          ? maxTokensOverride
          : 1200,
      });

      const content = readFileSync(file, 'utf-8');
      const contextFile = new ContextFile(file, content);
      const engine = new RulesEngine(createRules(config));
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

      let projectContext = '';
      if (options.generateMissing === true) {
        const detection = new ProjectDetector(dirname(file)).detect();
        projectContext = `
Detected project context (for missing-section generation):
- Type: ${detection.type}
- Structure: ${detection.structure}
- Confidence: ${Math.round(detection.confidence * 100)}%
- Package manager: ${detection.packageManager ?? '(unknown)'}
- Test framework: ${detection.testFramework ?? '(unknown)'}
- Evidence: ${detection.evidence.join(', ') || '(none)'}
- Name: ${detection.projectName ?? '(unknown)'}
- Description: ${detection.projectDescription ?? '(none)'}
`;
      }

      const excerpt =
        content.length > 6000
          ? `${content.slice(0, 6000)}\n\n…(truncated)`
          : content;

      const prompt = `You are an expert on Claude Code / AGENTS.md project instruction files.

File: ${file}
Current linter findings:
${violationSummary}
${projectContext}
File contents:
\`\`\`markdown
${excerpt}
\`\`\`

${buildFocusInstructions(options)}`;

      const suggestion = await completeAnthropicText({
        apiKey: ai.apiKey,
        model: ai.model,
        prompt,
        maxTokens: ai.maxTokens,
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
