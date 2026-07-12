import type { CodeBlock } from '../../../domain/CodeBlock.js';
import { Violation } from '../../../domain/Violation.js';
import { Location } from '../../../domain/Location.js';
import { Severity } from '../../../domain/Severity.js';
import type {
  LanguageValidator,
  ValidationContext,
} from '../LanguageValidator.js';

/** Third-party libraries whose presence implies imports should be shown. */
const COMMON_LIBRARIES = [
  'axios',
  'lodash',
  'express',
  'react',
  'vue',
  'angular',
  'moment',
  'date-fns',
  'rxjs',
  'redux',
  'mongoose',
];

/**
 * Validates JavaScript and TypeScript code blocks for common best-practice
 * issues (console usage, `var`, loose equality, unhandled async, missing
 * semicolons, undisclosed dependencies) and cross-block style consistency.
 */
export class JavaScriptValidator implements LanguageValidator {
  public validate(block: CodeBlock, context: ValidationContext): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNumber = block.location.line + i;

      // Check for console.log in production examples
      if (
        !block.metadata.isAntiPattern &&
        /console\.(log|error|warn)/.test(line)
      ) {
        violations.push(
          new Violation(
            context.ruleId,
            `Avoid console statements in example code (line ${lineNumber})`,
            Severity.INFO,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for var usage (prefer const/let)
      if (/\bvar\s+\w+/.test(line)) {
        violations.push(
          new Violation(
            context.ruleId,
            `Use 'const' or 'let' instead of 'var' (line ${lineNumber})`,
            context.strict ? Severity.ERROR : Severity.WARNING,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for == instead of ===
      if (/[^=!]==[^=]/.test(line) && !line.includes('null')) {
        violations.push(
          new Violation(
            context.ruleId,
            `Use '===' instead of '==' for strict equality (line ${lineNumber})`,
            Severity.WARNING,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for async without error handling
      if (/async\s+function|\basync\s*\(/.test(line)) {
        // Check if there's try-catch in the function
        const functionEnd = this.findFunctionEnd(lines, i);
        const functionBody = lines.slice(i, functionEnd + 1).join('\n');
        if (!functionBody.includes('try') && !functionBody.includes('catch')) {
          violations.push(
            new Violation(
              context.ruleId,
              `Async function should include error handling (line ${lineNumber})`,
              Severity.WARNING,
              new Location(lineNumber, 1)
            )
          );
        }
      }

      // Check for missing semicolons (if in strict mode)
      if (
        context.strict &&
        this.shouldHaveSemicolon(line) &&
        !line.trim().endsWith(';')
      ) {
        violations.push(
          new Violation(
            context.ruleId,
            `Missing semicolon (line ${lineNumber})`,
            Severity.INFO,
            new Location(lineNumber, line.length)
          )
        );
      }
    }

    // Check for missing imports when using external dependencies
    if (this.usesExternalDependencies(block) && !block.hasImports) {
      violations.push(
        new Violation(
          context.ruleId,
          `Code block uses external dependencies but doesn't show imports`,
          Severity.WARNING,
          block.location
        )
      );
    }

    return violations;
  }

  /**
   * Check for consistent code style across all JavaScript/TypeScript blocks in
   * a file.
   */
  public validateConsistency(
    blocks: CodeBlock[],
    context: ValidationContext
  ): Violation[] {
    const violations: Violation[] = [];

    // Check for consistent semicolon usage
    let withSemicolons = 0;
    let withoutSemicolons = 0;

    for (const block of blocks) {
      const hasSemicolons = block.content.includes(';');
      if (hasSemicolons) {
        withSemicolons++;
      } else {
        withoutSemicolons++;
      }
    }

    if (withSemicolons > 0 && withoutSemicolons > 0) {
      violations.push(
        new Violation(
          context.ruleId,
          'Inconsistent semicolon usage across JavaScript/TypeScript code blocks',
          Severity.INFO,
          new Location(1, 1)
        )
      );
    }

    return violations;
  }

  /** Find the end (closing brace) of a function starting at `startIndex`. */
  private findFunctionEnd(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let inFunction = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]!;

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inFunction = true;
        } else if (char === '}') {
          braceCount--;
          if (inFunction && braceCount === 0) {
            return i;
          }
        }
      }
    }

    return lines.length - 1;
  }

  /** Whether a line is a statement that should end with a semicolon. */
  private shouldHaveSemicolon(line: string): boolean {
    const trimmed = line.trim();

    // Skip empty lines, comments, and block statements
    if (
      !trimmed ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.endsWith('{') ||
      trimmed.endsWith('}') ||
      trimmed.startsWith('if') ||
      trimmed.startsWith('for') ||
      trimmed.startsWith('while') ||
      trimmed.startsWith('function') ||
      trimmed.startsWith('class') ||
      trimmed.startsWith('interface')
    ) {
      return false;
    }

    // Check if it's a statement that should end with semicolon
    return /^(const|let|var|return|throw|import|export)\s+/.test(trimmed);
  }

  /** Whether the block references a well-known external library. */
  private usesExternalDependencies(block: CodeBlock): boolean {
    for (const lib of COMMON_LIBRARIES) {
      if (block.content.includes(lib)) {
        return true;
      }
    }

    return false;
  }
}
