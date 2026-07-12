import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';
import {
  LAST_VERIFIED,
  RECOMMENDED_MODELS_TEXT,
  isModelAlias,
  isKnownModelShape,
  isLegacyModel,
} from './data/claude-models.js';
import { FrontmatterParser, Frontmatter } from './support/FrontmatterParser.js';

const VALID_TOOLS = [
  'Read',
  'Edit',
  'Write',
  'Bash',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'TodoWrite',
  'NotebookRead',
  'NotebookEdit',
  'Task',
  'Agent',
  'Skill',
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskGet',
  'TaskOutput',
  'TaskStop',
  'ScheduleWakeup',
  'EnterPlanMode',
  'ExitPlanMode',
  'EnterWorktree',
  'ExitWorktree',
  'Monitor',
  'PushNotification',
  'RemoteTrigger',
  'CronCreate',
  'CronDelete',
  'CronList',
  'LSP',
  'ListMcpResourcesTool',
  'ReadMcpResourceTool',
  'ToolSearch',
];

const MCP_TOOL_PATTERN = /^mcp__[A-Za-z0-9_-]+(__[A-Za-z0-9_-]+)?$/;

export class SubagentStructureRule implements Rule {
  public readonly id = 'subagent-structure';
  public readonly description = 'Validates Claude Code subagent configuration';

  constructor(_options?: { allowDangerousTools?: boolean }) {
    // Reserved for future use: allowDangerousTools option
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    if (!this.isAgentFile(file.path)) {
      return violations;
    }

    const frontmatter = FrontmatterParser.parse(file.lines);

    violations.push(...this.validateFrontmatter(frontmatter));
    violations.push(...this.validatePromptContent(file.content, file.lines));

    return violations;
  }

  private isAgentFile(path: string): boolean {
    return path.includes('.claude/agents/') && path.endsWith('.md');
  }

  private validateFrontmatter(frontmatter: Frontmatter): Violation[] {
    const violations: Violation[] = [];

    const name = frontmatter.getString('name');
    const description = frontmatter.getString('description');
    const tools = frontmatter.getStringArray('tools');
    const model = frontmatter.getString('model');

    if (!frontmatter.hasFence) {
      violations.push(
        new Violation(
          this.id,
          'Subagent file is missing frontmatter. Add --- at the start with name, description, and tools.',
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      return violations;
    }

    if (!name) {
      violations.push(
        new Violation(
          this.id,
          'Subagent frontmatter is missing required "name" field.',
          Severity.ERROR,
          new Location(1, 1)
        )
      );
    }

    if (!description) {
      violations.push(
        new Violation(
          this.id,
          'Subagent frontmatter is missing required "description" field.',
          Severity.ERROR,
          new Location(1, 1)
        )
      );
    }

    if (tools && tools.length > 0) {
      for (const tool of tools) {
        if (!VALID_TOOLS.includes(tool) && !MCP_TOOL_PATTERN.test(tool)) {
          violations.push(
            new Violation(
              this.id,
              `Unknown tool "${tool}". Expected one of: ${VALID_TOOLS.slice(0, 11).join(', ')}, … or an mcp__* tool.`,
              Severity.INFO,
              new Location(1, 1)
            )
          );
        }
      }
    }

    if (model) {
      if (isLegacyModel(model)) {
        violations.push(
          new Violation(
            this.id,
            `Model "${model}" is from the Claude 3 family and is deprecated. Consider ${RECOMMENDED_MODELS_TEXT}.`,
            Severity.INFO,
            new Location(1, 1)
          )
        );
      } else if (!isModelAlias(model) && !isKnownModelShape(model)) {
        violations.push(
          new Violation(
            this.id,
            `Model "${model}" not recognized. Verify against the current Anthropic model list (last verified ${LAST_VERIFIED}). Current: ${RECOMMENDED_MODELS_TEXT}.`,
            Severity.INFO,
            new Location(1, 1)
          )
        );
      }
    }

    return violations;
  }

  private validatePromptContent(
    _content: string,
    lines: string[]
  ): Violation[] {
    const violations: Violation[] = [];

    let lineNumber = 0;
    let foundPrompt = false;
    let inFrontmatter = false;
    let inPrompt = false;
    const promptLines: string[] = [];

    for (const line of lines) {
      lineNumber++;
      const trimmed = line.trim();

      if (trimmed === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
          continue;
        } else {
          inFrontmatter = false;
          inPrompt = true;
          continue;
        }
      }

      if (inPrompt) {
        if (trimmed.length > 0) {
          foundPrompt = true;
          promptLines.push(trimmed);
        }
      }
    }

    if (!foundPrompt) {
      violations.push(
        new Violation(
          this.id,
          'Subagent file is missing prompt content. Add instructions after the frontmatter.',
          Severity.ERROR,
          new Location(lineNumber, 1)
        )
      );
    }

    const promptContent = promptLines.join(' ');
    const wordCount = promptContent
      .split(/\s+/)
      .filter(w => w.length > 0).length;
    if (wordCount > 0 && wordCount < 10) {
      violations.push(
        new Violation(
          this.id,
          `Subagent prompt seems too short (${wordCount} words). Add more detailed instructions.`,
          Severity.WARNING,
          new Location(1, 1)
        )
      );
    }

    return violations;
  }
}
