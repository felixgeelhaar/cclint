import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

interface AgentFrontmatter {
  name?: string;
  description?: string;
  tools?: string[];
  model?: string;
}

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
];

const VALID_MODELS = [
  'claude-3-5-sonnet',
  'claude-3-5-sonnet-latest',
  'claude-3-5-haiku',
  'claude-3-5-haiku-latest',
  'claude-3-opus',
  'claude-3-opus-latest',
  'claude-3-sonnet',
  'claude-3-sonnet-latest',
  'claude-3-haiku',
  'claude-3-haiku-latest',
  'sonnet',
  'opus',
  'haiku',
];

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

    const frontmatter = this.parseFrontmatter(file.lines);

    violations.push(...this.validateFrontmatter(frontmatter, file.lines));
    violations.push(...this.validatePromptContent(file.content, file.lines));

    return violations;
  }

  private isAgentFile(path: string): boolean {
    return path.includes('.claude/agents/') && path.endsWith('.md');
  }

  private parseFrontmatter(lines: string[]): AgentFrontmatter {
    const frontmatter: AgentFrontmatter = {};
    let inFrontmatter = false;
    let currentKey = '';
    let currentValue = '';
    let isArray = false;
    let hasArrayItems = false;
    const arrayItems: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
        } else {
          break;
        }
        continue;
      }

      if (inFrontmatter) {
        const keyMatch = line.match(/^(\w+):\s*(.*)/);
        if (keyMatch) {
          if (currentKey) {
            this.setFrontmatterValue(
              frontmatter,
              currentKey,
              currentValue.trim(),
              hasArrayItems ? arrayItems : undefined
            );
          }
          currentKey = keyMatch[1] ?? '';
          const valuePart = keyMatch[2] ?? '';

          if (valuePart.startsWith('-')) {
            isArray = true;
            hasArrayItems = true;
            arrayItems.length = 0;
            const item = valuePart.replace(/^-\s*/, '').trim();
            if (item) arrayItems.push(item);
            currentValue = '';
          } else if (valuePart) {
            currentValue = valuePart;
            isArray = false;
            hasArrayItems = false;
            arrayItems.length = 0;
          } else {
            currentValue = '';
            isArray = false;
          }
        } else if (line.trim().startsWith('-')) {
          const item = line.trim().replace(/^-\s*/, '').trim();
          if (item) {
            arrayItems.push(item);
            hasArrayItems = true;
          }
        } else if (currentKey && !isArray) {
          currentValue += ' ' + line.trim();
        }
      }
    }

    if (currentKey) {
      this.setFrontmatterValue(
        frontmatter,
        currentKey,
        currentValue.trim(),
        hasArrayItems ? arrayItems : undefined
      );
    }

    return frontmatter;
  }

  private setFrontmatterValue(
    frontmatter: AgentFrontmatter,
    key: string,
    value: string,
    arrayValue?: string[]
  ): void {
    if (key === 'tools' && arrayValue) {
      frontmatter.tools = arrayValue;
    } else if (key === 'tools') {
      frontmatter.tools = value
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map(t => t.trim().replace(/['"]/g, ''))
        .filter(t => t.length > 0);
    } else if (key === 'model') {
      frontmatter.model = value.replace(/['"]/g, '');
    } else if (key === 'name') {
      frontmatter.name = value.replace(/['"]/g, '');
    } else if (key === 'description') {
      frontmatter.description = value.replace(/['"]/g, '');
    }
  }

  private validateFrontmatter(
    frontmatter: AgentFrontmatter,
    lines: string[]
  ): Violation[] {
    const violations: Violation[] = [];

    const hasFrontmatter = lines.some(l => l.trim() === '---');

    if (!hasFrontmatter) {
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

    if (!frontmatter.name) {
      violations.push(
        new Violation(
          this.id,
          'Subagent frontmatter is missing required "name" field.',
          Severity.ERROR,
          new Location(1, 1)
        )
      );
    }

    if (!frontmatter.description) {
      violations.push(
        new Violation(
          this.id,
          'Subagent frontmatter is missing required "description" field.',
          Severity.ERROR,
          new Location(1, 1)
        )
      );
    }

    if (frontmatter.tools && frontmatter.tools.length > 0) {
      for (const tool of frontmatter.tools) {
        if (!VALID_TOOLS.includes(tool)) {
          violations.push(
            new Violation(
              this.id,
              `Unknown tool "${tool}". Valid tools: ${VALID_TOOLS.join(', ')}.`,
              Severity.WARNING,
              new Location(1, 1)
            )
          );
        }
      }
    }

    if (frontmatter.model) {
      const normalizedModel = frontmatter.model.toLowerCase();
      const isValid = VALID_MODELS.some(
        m => m.toLowerCase() === normalizedModel
      );

      if (!isValid) {
        violations.push(
          new Violation(
            this.id,
            `Unknown model "${frontmatter.model}". Valid models: ${VALID_MODELS.join(', ')}.`,
            Severity.WARNING,
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
