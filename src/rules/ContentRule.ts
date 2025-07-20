import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

export interface ContentPattern {
  pattern: string;
  description: string;
  isRegex?: boolean;
}

export class ContentRule implements Rule {
  public readonly id = 'content';
  public readonly description: string;

  private readonly patterns: ContentPattern[];

  constructor(patterns: ContentPattern[] = ContentRule.getDefaultPatterns()) {
    this.patterns = patterns;
    const descriptions = patterns.map(p => p.description).join(', ');
    this.description = `File must contain required content: ${descriptions}`;
  }

  private static getDefaultPatterns(): ContentPattern[] {
    return [
      { pattern: 'npm', description: 'npm commands' },
      { pattern: 'TypeScript', description: 'TypeScript usage' },
      { pattern: 'test', description: 'testing information' },
      { pattern: 'build', description: 'build process' },
    ];
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    for (const contentPattern of this.patterns) {
      if (!this.hasPattern(file, contentPattern)) {
        violations.push(
          new Violation(
            this.id,
            `Missing required content: ${contentPattern.description} (expected: "${contentPattern.pattern}")`,
            Severity.WARNING,
            new Location(1, 1)
          )
        );
      }
    }

    return violations;
  }

  private hasPattern(
    file: ContextFile,
    contentPattern: ContentPattern
  ): boolean {
    const content = file.content;

    if (contentPattern.isRegex) {
      const regex = new RegExp(contentPattern.pattern, 'i');
      return regex.test(content);
    } else {
      return content
        .toLowerCase()
        .includes(contentPattern.pattern.toLowerCase());
    }
  }
}
