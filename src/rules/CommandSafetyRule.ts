import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';
import { CodeBlockExtractor } from '../infrastructure/CodeBlockExtractor.js';
import type { CodeBlock } from '../domain/CodeBlock.js';

/**
 * Rule that validates bash command safety in CLAUDE.md
 *
 * @remarks
 * Validates that bash commands:
 * - Avoid dangerous operations (rm -rf, sudo without context)
 * - Include proper error handling
 * - Use safe patterns (quotes, error checks)
 * - Follow Anthropic's safety recommendations
 *
 * @see {@link https://www.anthropic.com/engineering/claude-code-best-practices | Claude Code Best Practices}
 *
 * @category Rules
 */
export class CommandSafetyRule implements Rule {
  public readonly id = 'command-safety';
  public readonly description =
    'Validates safety of bash commands in CLAUDE.md files';

  private readonly extractor: CodeBlockExtractor;

  constructor() {
    this.extractor = new CodeBlockExtractor();
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];
    const bashBlocks = this.extractor.extractCodeBlocksByLanguage(file, 'bash');

    for (const block of bashBlocks) {
      violations.push(...this.checkDangerousCommands(block));
      violations.push(...this.checkErrorHandling(block));
      violations.push(...this.checkQuoting(block));
      violations.push(...this.checkSudoUsage(block));
    }

    return violations;
  }

  /**
   * Check for dangerous commands
   */
  private checkDangerousCommands(block: CodeBlock): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    const dangerousPatterns = [
      {
        pattern: /rm\s+-rf\s+\/(?!\s*(tmp|var\/tmp))/,
        message:
          'Dangerous: rm -rf on root paths. Use specific paths and consider: mkdir -p /path/to/backup && cp -r target /path/to/backup',
        severity: Severity.ERROR,
      },
      {
        pattern: /rm\s+-rf\s+\*/,
        message:
          'Dangerous: rm -rf with wildcard. Be explicit about files to delete',
        severity: Severity.ERROR,
      },
      {
        pattern: /:\(\)\{\s*:\|:&\s*\};:/,
        message: 'Fork bomb detected. Remove this dangerous command',
        severity: Severity.ERROR,
      },
      {
        pattern: /dd\s+if=\/dev\/(zero|random)\s+of=\/dev/,
        message:
          'Dangerous: dd writing to device. This can destroy data. Add safety checks',
        severity: Severity.ERROR,
      },
      {
        pattern: /mkfs\./,
        message:
          'Dangerous: filesystem creation. Ensure this is intentional and add confirmation',
        severity: Severity.WARNING,
      },
      {
        pattern: />\s*\/dev\/sd[a-z]/,
        message: 'Dangerous: writing to disk device. Add safety checks',
        severity: Severity.ERROR,
      },
      {
        pattern: /chmod\s+-R\s+777/,
        message:
          'Insecure: chmod 777 is overly permissive. Use specific permissions like 755 or 644',
        severity: Severity.WARNING,
      },
      {
        pattern: /curl\s+.*\|\s*(?:bash|sh)/,
        message:
          'Security risk: piping curl to bash. Download and inspect scripts first: curl -o script.sh URL && chmod +x script.sh && ./script.sh',
        severity: Severity.ERROR,
      },
      {
        pattern: /wget\s+.*\|\s*(?:bash|sh)/,
        message:
          'Security risk: piping wget to bash. Download and inspect scripts first',
        severity: Severity.ERROR,
      },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNumber = block.location.line + i;

      for (const { pattern, message, severity } of dangerousPatterns) {
        if (pattern.test(line)) {
          violations.push(
            new Violation(
              this.id,
              message,
              severity,
              new Location(lineNumber, 1)
            )
          );
        }
      }
    }

    return violations;
  }

  /**
   * Check error handling
   */
  private checkErrorHandling(block: CodeBlock): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();
    const content = block.content;

    // Check for set -e or error handling
    const hasSetE = /set\s+-e/.test(content);
    const hasErrorHandling = /\|\|/.test(content) || /if\s+\[/.test(content);

    if (!hasSetE && !hasErrorHandling && lines.length > 3) {
      violations.push(
        new Violation(
          this.id,
          'Add error handling to bash script: Use "set -e" at the start or add "|| exit 1" to critical commands',
          Severity.WARNING,
          block.location
        )
      );
    }

    // Check for cd without error handling
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNumber = block.location.line + i;

      if (/^\s*cd\s+/.test(line) && !/\|\|/.test(line)) {
        const nextLine = lines[i + 1] ?? '';
        if (!nextLine.includes('||') && !hasSetE) {
          violations.push(
            new Violation(
              this.id,
              'cd command without error handling. Use: cd /path || exit 1',
              Severity.WARNING,
              new Location(lineNumber, 1)
            )
          );
        }
      }
    }

    return violations;
  }

  /**
   * Check variable quoting
   */
  private checkQuoting(block: CodeBlock): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNumber = block.location.line + i;

      // Check for unquoted variables in dangerous contexts
      const unquotedInRm = /rm\s+.*\$\w+(?!\s*")/.test(line);
      const unquotedInMv = /mv\s+.*\$\w+(?!\s*")/.test(line);

      if (unquotedInRm || unquotedInMv) {
        violations.push(
          new Violation(
            this.id,
            'Unquoted variable in potentially destructive command. Use "$VAR" instead of $VAR',
            Severity.WARNING,
            new Location(lineNumber, 1)
          )
        );
      }
    }

    return violations;
  }

  /**
   * Check sudo usage
   */
  private checkSudoUsage(block: CodeBlock): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNumber = block.location.line + i;

      if (/^\s*sudo/.test(line)) {
        // Check if it's in a documented/safe context
        const context = block.context.toLowerCase();
        const isDocumented =
          context.includes('install') ||
          context.includes('setup') ||
          context.includes('admin');

        if (!isDocumented) {
          violations.push(
            new Violation(
              this.id,
              'sudo command without clear context. Document why sudo is needed: "# System setup requires sudo"',
              Severity.INFO,
              new Location(lineNumber, 1)
            )
          );
        }

        // Check for sudo with dangerous commands
        if (/sudo\s+rm\s+-rf/.test(line)) {
          violations.push(
            new Violation(
              this.id,
              'sudo rm -rf is extremely dangerous. Add explicit path validation and confirmation',
              Severity.ERROR,
              new Location(lineNumber, 1)
            )
          );
        }
      }
    }

    return violations;
  }
}
