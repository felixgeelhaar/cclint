import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'fs';
import { z } from 'zod';
import { ContextFile } from '../domain/ContextFile.js';
import { RulesEngine } from '../domain/RulesEngine.js';
import { LintingResult } from '../domain/LintingResult.js';
import { Severity } from '../domain/Severity.js';
import { FileSizeRule } from '../rules/FileSizeRule.js';
import { StructureRule } from '../rules/StructureRule.js';
import { ContentOrganizationRule } from '../rules/ContentOrganizationRule.js';
import { FormatRule } from '../rules/FormatRule.js';
import { CodeBlockRule } from '../rules/CodeBlockRule.js';
import { ImportSyntaxRule } from '../rules/ImportSyntaxRule.js';
import { FileLocationRule } from '../rules/FileLocationRule.js';
import { ImportResolutionRule } from '../rules/ImportResolutionRule.js';
import { ContentAppropriatenessRule } from '../rules/ContentAppropriatenessRule.js';
import { MonorepoHierarchyRule } from '../rules/MonorepoHierarchyRule.js';
import { CommandSafetyRule } from '../rules/CommandSafetyRule.js';
import { SkillStructureRule } from '../rules/SkillStructureRule.js';
import { SubagentStructureRule } from '../rules/SubagentStructureRule.js';
import { HookConfigurationRule } from '../rules/HookConfigurationRule.js';
import {
  RULE_METADATA,
  getAllRuleIds,
} from '../infrastructure/RuleMetadata.js';

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

function serializeResult(result: LintingResult): {
  file: string;
  violations: Array<{
    ruleId: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    line: number;
    column: number;
  }>;
  summary: { errors: number; warnings: number; infos: number };
} {
  const severityName = (s: Severity): 'error' | 'warning' | 'info' => {
    if (s === Severity.ERROR) return 'error';
    if (s === Severity.WARNING) return 'warning';
    return 'info';
  };
  return {
    file: result.file.path,
    violations: result.violations.map(v => ({
      ruleId: v.ruleId,
      message: v.message,
      severity: severityName(v.severity),
      line: v.location.line,
      column: v.location.column,
    })),
    summary: {
      errors: result.getErrorCount(),
      warnings: result.getWarningCount(),
      infos: result.getInfoCount(),
    },
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'cclint',
    version: '0.14.0',
  });

  server.registerTool(
    'lint_file',
    {
      title: 'Lint a CLAUDE.md file',
      description:
        'Run cclint against a CLAUDE.md, skill, subagent, or hook config file on disk. Returns structured violations.',
      inputSchema: {
        path: z
          .string()
          .describe('Absolute or relative path to the file to lint.'),
      },
    },
    ({ path }) => {
      try {
        const content = readFileSync(path, 'utf-8');
        const file = new ContextFile(path, content);
        const result = buildEngine().lint(file);
        const payload = serializeResult(result);
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text', text: `lint_file failed: ${msg}` }],
        };
      }
    }
  );

  server.registerTool(
    'lint_string',
    {
      title: 'Lint inline content',
      description:
        'Run cclint against in-memory CLAUDE.md content. Useful when you want to check edits before writing them to disk.',
      inputSchema: {
        path: z
          .string()
          .describe(
            'Logical file path (used by location-aware rules). For example "/repo/CLAUDE.md".'
          ),
        content: z.string().describe('Markdown content to lint.'),
      },
    },
    ({ path, content }) => {
      try {
        const file = new ContextFile(path, content);
        const result = buildEngine().lint(file);
        const payload = serializeResult(result);
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text', text: `lint_string failed: ${msg}` }],
        };
      }
    }
  );

  server.registerTool(
    'list_rules',
    {
      title: 'List cclint rules',
      description:
        'Return every rule cclint can enforce, with id, name, severity, and short description.',
      inputSchema: {},
    },
    () => {
      const rules = getAllRuleIds().map(id => {
        const meta = RULE_METADATA[id];
        return {
          id,
          name: meta?.name ?? id,
          severity: meta?.defaultSeverity ?? 'warning',
          description: meta?.description ?? '',
          fixable: meta?.fixable ?? false,
        };
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(rules, null, 2) }],
      };
    }
  );

  server.registerTool(
    'explain_rule',
    {
      title: 'Explain a cclint rule',
      description:
        'Return the rule rationale, good and bad examples, and configuration options for a single rule id.',
      inputSchema: {
        ruleId: z
          .string()
          .describe('Rule id, e.g. "subagent-structure" or "command-safety".'),
      },
    },
    ({ ruleId }) => {
      const meta = RULE_METADATA[ruleId];
      if (!meta) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Unknown rule "${ruleId}". Use list_rules to see available rules.`,
            },
          ],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(meta, null, 2) }],
      };
    }
  );

  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
