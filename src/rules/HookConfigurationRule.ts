import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

interface HookDefinition {
  matcher?: string;
  command?: string[];
  cwd?: string;
}

const DANGEROUS_PATTERNS = [
  {
    pattern: /rm\s+-rf\s+/,
    message: 'Recursive forced removal is dangerous in hooks',
  },
  { pattern: /curl\s+.*\|.*sh/, message: 'Piping curl to shell is dangerous' },
  { pattern: /wget\s+.*\|.*sh/, message: 'Piping wget to shell is dangerous' },
  { pattern: /:.*\{.*\|.*\}/, message: 'Fork bomb detected' },
  { pattern: /dd\s+if=/, message: 'Direct disk operations are dangerous' },
  { pattern: /mkfs/, message: 'Filesystem format command is dangerous' },
  {
    pattern: />.*\/dev\/sd/,
    message: 'Writing directly to disk device is dangerous',
  },
];

export class HookConfigurationRule implements Rule {
  public readonly id = 'hook-configuration';
  public readonly description = 'Validates Claude Code hook configuration';

  private readonly dangerousPatterns: RegExp[];

  constructor(options?: { dangerousCommands?: string[] }) {
    this.dangerousPatterns = options?.dangerousCommands
      ? options.dangerousCommands.map(cmd => new RegExp(cmd, 'i'))
      : DANGEROUS_PATTERNS.map(p => p.pattern);
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    if (!this.isSettingsFile(file.path)) {
      return violations;
    }

    const parseResult = this.parseJson(file.content);

    if (parseResult.error) {
      violations.push(
        new Violation(
          this.id,
          `Invalid JSON: ${parseResult.error}`,
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      return violations;
    }

    violations.push(...this.validateHooks(parseResult.data));

    return violations;
  }

  private isSettingsFile(path: string): boolean {
    return (
      path.endsWith('.claude/settings.json') ||
      path.endsWith('.claude/settings')
    );
  }

  private parseJson(content: string): { data: unknown; error?: string } {
    try {
      const data: unknown = JSON.parse(content);
      return { data };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown JSON error';
      return { data: null, error };
    }
  }

  private validateHooks(data: unknown): Violation[] {
    const violations: Violation[] = [];

    if (typeof data !== 'object' || data === null) {
      violations.push(
        new Violation(
          this.id,
          'Settings file must contain a JSON object.',
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      return violations;
    }

    const settings = data as Record<string, unknown>;

    const hookKeys = [
      'onStartup',
      'preToolUse',
      'onToolUse',
      'postMessageEdit',
      'onMultifileComplete',
    ];

    for (const key of hookKeys) {
      if (settings[key] !== undefined) {
        violations.push(
          ...this.validateHookDefinition(
            key,
            settings[key] as Record<string, unknown>
          )
        );
      }
    }

    if (Object.keys(settings).length === 0) {
      violations.push(
        new Violation(
          this.id,
          'Settings file is empty. Add hook definitions.',
          Severity.WARNING,
          new Location(1, 1)
        )
      );
    }

    return violations;
  }

  private validateHookDefinition(name: string, value: unknown): Violation[] {
    const violations: Violation[] = [];

    if (typeof value === 'string') {
      violations.push(
        new Violation(
          this.id,
          `Hook "${name}" should be an object with "matcher" and "command" fields, not a string.`,
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      return violations;
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      violations.push(
        new Violation(
          this.id,
          `Hook "${name}" should be an object.`,
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      return violations;
    }

    const hook = value as HookDefinition;

    if (!hook.matcher) {
      violations.push(
        new Violation(
          this.id,
          `Hook "${name}" is missing required "matcher" field.`,
          Severity.WARNING,
          new Location(1, 1)
        )
      );
    }

    if (!hook.command) {
      violations.push(
        new Violation(
          this.id,
          `Hook "${name}" is missing required "command" field.`,
          Severity.ERROR,
          new Location(1, 1)
        )
      );
    } else if (Array.isArray(hook.command)) {
      violations.push(...this.validateCommands(name, hook.command));
    }

    return violations;
  }

  private validateCommands(hookName: string, commands: unknown[]): Violation[] {
    const violations: Violation[] = [];

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];

      if (typeof cmd !== 'string') {
        violations.push(
          new Violation(
            this.id,
            `Hook "${hookName}" command at index ${i} should be a string.`,
            Severity.ERROR,
            new Location(1, 1)
          )
        );
        continue;
      }

      for (const dangerPattern of this.dangerousPatterns) {
        if (dangerPattern.test(cmd)) {
          violations.push(
            new Violation(
              this.id,
              `Hook "${hookName}" contains dangerous command.`,
              Severity.WARNING,
              new Location(1, 1)
            )
          );
        }
      }

      if (cmd.includes('&&') && !cmd.includes('set -e')) {
        violations.push(
          new Violation(
            this.id,
            `Hook "${hookName}" command uses "&&" without "set -e". Commands may not fail safely.`,
            Severity.INFO,
            new Location(1, 1)
          )
        );
      }
    }

    return violations;
  }
}
