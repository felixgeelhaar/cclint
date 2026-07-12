import type { CodeBlock } from '../../../domain/CodeBlock.js';
import { Violation } from '../../../domain/Violation.js';
import { Severity } from '../../../domain/Severity.js';
import type {
  LanguageValidator,
  ValidationContext,
} from '../LanguageValidator.js';

/**
 * Validates SQL code blocks for `SELECT *` usage and string-interpolation
 * patterns that indicate potential SQL injection.
 */
export class SqlValidator implements LanguageValidator {
  public validate(block: CodeBlock, context: ValidationContext): Violation[] {
    const violations: Violation[] = [];
    const content = block.content.toUpperCase();

    // Check for SELECT * in examples
    if (!block.metadata.isAntiPattern && content.includes('SELECT *')) {
      violations.push(
        new Violation(
          context.ruleId,
          `Avoid SELECT * in examples, specify columns explicitly`,
          Severity.WARNING,
          block.location
        )
      );
    }

    // Check for potential SQL injection patterns
    if (/\$\{.*\}/.test(block.content) || /\+\s*["']/.test(block.content)) {
      violations.push(
        new Violation(
          context.ruleId,
          `Potential SQL injection vulnerability - use parameterized queries`,
          Severity.ERROR,
          block.location
        )
      );
    }

    return violations;
  }
}
