import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

/**
 * Rule that validates content appropriateness for CLAUDE.md files
 *
 * @remarks
 * Validates that CLAUDE.md content:
 * - Is specific and actionable (not overly generic)
 * - Belongs in CLAUDE.md vs README or other docs
 * - Follows "frequently used prompt" refinement principle
 * - Is concise and focused
 *
 * @see {@link https://www.anthropic.com/engineering/claude-code-best-practices | Claude Code Best Practices}
 *
 * @category Rules
 */
export class ContentAppropriatenessRule implements Rule {
  public readonly id = 'content-appropriateness';
  public readonly description =
    'Validates that content is appropriate for CLAUDE.md and not overly generic';

  private readonly maxFileSize: number;
  private readonly maxSectionSize: number;

  constructor(options?: ContentAppropriatenessOptions) {
    this.maxFileSize = options?.maxFileSize ?? 5000; // ~5KB recommended
    this.maxSectionSize = options?.maxSectionSize ?? 1000; // ~1KB per section
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    // Check file size (should be concise)
    violations.push(...this.checkFileSize(file));

    // Check for overly generic instructions
    violations.push(...this.checkGenericInstructions(file));

    // Check for content that belongs elsewhere
    violations.push(...this.checkMisplacedContent(file));

    // Check section sizes
    violations.push(...this.checkSectionSizes(file));

    // Check for actionable content
    violations.push(...this.checkActionability(file));

    return violations;
  }

  /**
   * Check if file is too large
   */
  private checkFileSize(file: ContextFile): Violation[] {
    const violations: Violation[] = [];
    const contentLength = file.content.length;

    if (contentLength > this.maxFileSize) {
      violations.push(
        new Violation(
          this.id,
          `CLAUDE.md is ${contentLength} characters (recommended: <${this.maxFileSize}). Consider using imports to reference external documentation: @README.md, @docs/guidelines.md`,
          Severity.WARNING,
          new Location(1, 1)
        )
      );
    }

    return violations;
  }

  /**
   * Check for overly generic instructions
   */
  private checkGenericInstructions(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    const genericPatterns = [
      {
        pattern: /follow\s+best\s+practices/i,
        message:
          'Avoid generic "follow best practices". Be specific: "Use 2-space indentation" or "Run prettier before commit"',
      },
      {
        pattern: /write\s+good\s+code/i,
        message:
          'Avoid vague "write good code". Be specific about standards: "Pass ESLint with no warnings" or "Maintain >80% test coverage"',
      },
      {
        pattern: /do\s+it\s+correctly/i,
        message:
          'Avoid generic "do it correctly". Define what correct means with measurable criteria',
      },
      {
        pattern: /use\s+common\s+sense/i,
        message:
          'Avoid "use common sense". Document specific decision criteria or examples',
      },
      {
        pattern: /be\s+careful/i,
        message:
          'Instead of "be careful", specify the exact risk and mitigation: "Always backup database before migration"',
      },
    ];

    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';

      for (const { pattern, message } of genericPatterns) {
        if (pattern.test(line)) {
          violations.push(
            new Violation(
              this.id,
              `Generic instruction detected: ${message}`,
              Severity.WARNING,
              new Location(i + 1, 1)
            )
          );
        }
      }
    }

    return violations;
  }

  /**
   * Check for content that should be in README or other docs
   */
  private checkMisplacedContent(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    // Check for extensive project descriptions
    const hasExtensiveDescription = file.content.match(
      /^#{1,2}\s+(About|Overview|Description|Introduction)/im
    );
    if (hasExtensiveDescription) {
      const sectionStart = file.content.indexOf(
        hasExtensiveDescription[0] ?? ''
      );
      const lineNumber = file.content
        .substring(0, sectionStart)
        .split('\n').length;

      violations.push(
        new Violation(
          this.id,
          'Extensive project description detected. Keep CLAUDE.md concise - use @README.md to reference project overview',
          Severity.INFO,
          new Location(lineNumber, 1)
        )
      );
    }

    // Check for API documentation
    if (
      file.content.includes('API Documentation') ||
      /^#{1,3}\s+API/im.test(file.content)
    ) {
      violations.push(
        new Violation(
          this.id,
          'API documentation detected. Move API docs to separate files and reference via imports: @docs/api.md',
          Severity.INFO,
          new Location(1, 1)
        )
      );
    }

    // Check for installation instructions
    if (
      /^#{1,3}\s+Installation/im.test(file.content) ||
      file.content.includes('npm install') ||
      file.content.includes('pip install')
    ) {
      violations.push(
        new Violation(
          this.id,
          'Installation instructions detected. Keep setup commands minimal - reference @README.md for full installation guide',
          Severity.INFO,
          new Location(1, 1)
        )
      );
    }

    return violations;
  }

  /**
   * Check section sizes
   */
  private checkSectionSizes(file: ContextFile): Violation[] {
    const violations: Violation[] = [];
    const sections = this.extractSections(file);

    for (const section of sections) {
      if (section.content.length > this.maxSectionSize) {
        violations.push(
          new Violation(
            this.id,
            `Section "${section.title}" is ${section.content.length} characters (recommended: <${this.maxSectionSize}). Consider breaking into subsections or using imports`,
            Severity.INFO,
            new Location(section.line, 1)
          )
        );
      }
    }

    return violations;
  }

  /**
   * Check for actionable content
   */
  private checkActionability(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    // Check for statements without actions
    const nonActionablePatterns = [
      /(?:remember|note|keep in mind|don't forget)(?!\s+to\s+)/i,
      /it'?s important(?!\s+to\s+)/i,
      /you should know(?!\s+that\s+)/i,
    ];

    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';

      for (const pattern of nonActionablePatterns) {
        if (pattern.test(line)) {
          violations.push(
            new Violation(
              this.id,
              'Statement is not actionable. Convert to specific instruction: "Run tests before commit" instead of "Remember to test"',
              Severity.INFO,
              new Location(i + 1, 1)
            )
          );
        }
      }
    }

    return violations;
  }

  /**
   * Extract sections from file
   */
  private extractSections(file: ContextFile): Section[] {
    const sections: Section[] = [];
    let currentSection: Section | null = null;

    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';
      const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);

      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          title: headerMatch[2] ?? '',
          line: i + 1,
          content: '',
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    // Save last section
    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }
}

interface Section {
  title: string;
  line: number;
  content: string;
}

export interface ContentAppropriatenessOptions {
  /** Maximum recommended file size in characters */
  maxFileSize?: number;
  /** Maximum recommended section size in characters */
  maxSectionSize?: number;
}
