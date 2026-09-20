import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

/** Options for {@link FileSizeRule}. */
export interface FileSizeRuleOptions {
  /** Maximum character count (default 10_000). */
  maxSize?: number;
  /**
   * Maximum line count (default 200). Anthropic's current guidance targets
   * under ~200 lines per CLAUDE.md / instruction file for better adherence.
   * Set to `0` to disable the line check.
   */
  maxLines?: number;
}

/**
 * Enforces size limits on project instruction files.
 *
 * @remarks
 * Character limits catch oversized blobs; the line limit mirrors Anthropic's
 * ~200-line CLAUDE.md guidance (longer files consume context and reduce
 * adherence — prefer `.claude/rules/` or skills for overflow).
 */
export class FileSizeRule implements Rule {
  public readonly id = 'file-size';
  public readonly description: string;

  private readonly maxSize: number;
  private readonly maxLines: number;

  constructor(maxSizeOrOptions: number | FileSizeRuleOptions = {}) {
    if (typeof maxSizeOrOptions === 'number') {
      this.maxSize = maxSizeOrOptions;
      this.maxLines = 200;
    } else {
      this.maxSize = maxSizeOrOptions.maxSize ?? 10000;
      this.maxLines =
        maxSizeOrOptions.maxLines === undefined
          ? 200
          : maxSizeOrOptions.maxLines;
    }

    if (this.maxSize <= 0) {
      throw new Error('Max size must be positive');
    }
    if (this.maxLines < 0) {
      throw new Error('Max lines must be non-negative');
    }

    const parts = [`${this.maxSize} characters`];
    if (this.maxLines > 0) {
      parts.push(`${this.maxLines} lines`);
    }
    this.description = `File size should not exceed ${parts.join(' or ')}`;
  }

  public appliesTo(file: ContextFile): boolean {
    return (
      file.isProjectInstructionFile() ||
      file.isClaudeRulesFile() ||
      file.isSkillFile() ||
      file.isAgentFile() ||
      file.isOutputStyle()
    );
  }

  public lint(file: ContextFile): Violation[] {
    if (!this.appliesTo(file)) {
      return [];
    }

    const violations: Violation[] = [];
    const size = file.getCharacterCount();

    if (size > this.maxSize) {
      violations.push(
        new Violation(
          this.id,
          `File size (${size} characters) exceeds maximum allowed size (${this.maxSize} characters)`,
          Severity.WARNING,
          new Location(1, 1)
        )
      );
    }

    if (this.maxLines > 0) {
      const lines = file.getLineCount();
      if (lines > this.maxLines) {
        violations.push(
          new Violation(
            this.id,
            `File has ${lines} lines (recommended: ≤${this.maxLines}). Longer instruction files reduce adherence — move path-specific guidance to .claude/rules/ or on-demand skills.`,
            Severity.WARNING,
            new Location(1, 1)
          )
        );
      }
    }

    return violations;
  }
}
