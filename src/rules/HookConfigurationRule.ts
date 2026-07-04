import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

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

  // The hook events Claude Code actually dispatches. A top-level `hooks`
  // object is keyed by these; each maps to an array of matcher groups.
  private static readonly KNOWN_EVENTS = new Set([
    'PreToolUse',
    'PostToolUse',
    'UserPromptSubmit',
    'Notification',
    'Stop',
    'SubagentStop',
    'SessionStart',
    'SessionEnd',
    'PreCompact',
  ]);

  private validateHooks(data: unknown): Violation[] {
    const violations: Violation[] = [];

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
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

    const hooks = (data as Record<string, unknown>)['hooks'];
    // A settings.json with no "hooks" block is valid — it may configure only
    // other things. Nothing to validate.
    if (hooks === undefined) {
      return violations;
    }
    if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) {
      violations.push(
        new Violation(
          this.id,
          '"hooks" must be an object keyed by event name (PreToolUse, PostToolUse, UserPromptSubmit, …).',
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      return violations;
    }

    for (const [event, groups] of Object.entries(
      hooks as Record<string, unknown>
    )) {
      if (!HookConfigurationRule.KNOWN_EVENTS.has(event)) {
        violations.push(
          new Violation(
            this.id,
            `Unknown hook event "${event}". Known events: ${[...HookConfigurationRule.KNOWN_EVENTS].join(', ')}.`,
            Severity.WARNING,
            new Location(1, 1)
          )
        );
        continue;
      }
      if (!Array.isArray(groups)) {
        violations.push(
          new Violation(
            this.id,
            `Hook event "${event}" must be an array of matcher groups.`,
            Severity.ERROR,
            new Location(1, 1)
          )
        );
        continue;
      }
      groups.forEach((group, i) =>
        violations.push(...this.validateMatcherGroup(event, group, i))
      );
    }

    return violations;
  }

  /** Validate one `{ matcher?, hooks: [...] }` group under an event. */
  private validateMatcherGroup(
    event: string,
    group: unknown,
    index: number
  ): Violation[] {
    const violations: Violation[] = [];
    const where = `${event}[${index}]`;

    if (typeof group !== 'object' || group === null || Array.isArray(group)) {
      violations.push(
        new Violation(
          this.id,
          `Hook "${where}" must be an object with an optional "matcher" and a "hooks" array.`,
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      return violations;
    }

    const g = group as Record<string, unknown>;
    if (g['matcher'] !== undefined && typeof g['matcher'] !== 'string') {
      violations.push(
        new Violation(
          this.id,
          `Hook "${where}".matcher must be a string.`,
          Severity.ERROR,
          new Location(1, 1)
        )
      );
    }

    const inner = g['hooks'];
    if (!Array.isArray(inner)) {
      violations.push(
        new Violation(
          this.id,
          `Hook "${where}" is missing a "hooks" array.`,
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      return violations;
    }

    inner.forEach((h, i) =>
      violations.push(...this.validateHookCommand(`${where}.hooks[${i}]`, h))
    );
    return violations;
  }

  /** Validate one `{ type: "command", command: "..." }` entry. */
  private validateHookCommand(where: string, hook: unknown): Violation[] {
    const violations: Violation[] = [];

    if (typeof hook !== 'object' || hook === null || Array.isArray(hook)) {
      violations.push(
        new Violation(
          this.id,
          `Hook "${where}" must be an object with "type": "command" and a "command" string.`,
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      return violations;
    }

    const h = hook as Record<string, unknown>;
    if (h['type'] !== undefined && h['type'] !== 'command') {
      violations.push(
        new Violation(
          this.id,
          `Hook "${where}".type ${JSON.stringify(h['type'])} is not supported; expected "command".`,
          Severity.WARNING,
          new Location(1, 1)
        )
      );
    }

    const command = h['command'];
    if (typeof command !== 'string' || command.trim() === '') {
      violations.push(
        new Violation(
          this.id,
          `Hook "${where}" is missing a non-empty "command" string.`,
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      return violations;
    }

    return violations.concat(this.checkCommand(where, command));
  }

  /** Scan a real hook command string for danger + fail-safety. */
  private checkCommand(where: string, command: string): Violation[] {
    const violations: Violation[] = [];

    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        violations.push(
          new Violation(
            this.id,
            `Hook "${where}" runs a dangerous command.`,
            Severity.WARNING,
            new Location(1, 1)
          )
        );
      }
    }

    if (command.includes('&&') && !command.includes('set -e')) {
      violations.push(
        new Violation(
          this.id,
          `Hook "${where}" chains commands with "&&" but no "set -e"; a failure mid-chain may be ignored.`,
          Severity.INFO,
          new Location(1, 1)
        )
      );
    }

    return violations;
  }
}
