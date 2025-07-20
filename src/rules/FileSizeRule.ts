import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

export class FileSizeRule implements Rule {
  public readonly id = 'file-size';
  public readonly description: string;

  private readonly maxSize: number;

  constructor(maxSize: number = 10000) {
    if (maxSize <= 0) {
      throw new Error('Max size must be positive');
    }

    this.maxSize = maxSize;
    this.description = `File size should not exceed ${maxSize} characters`;
  }

  public lint(file: ContextFile): Violation[] {
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

    return violations;
  }
}
