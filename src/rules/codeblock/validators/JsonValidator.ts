import type { CodeBlock } from '../../../domain/CodeBlock.js';
import { Violation } from '../../../domain/Violation.js';
import { Severity } from '../../../domain/Severity.js';
import type {
  LanguageValidator,
  ValidationContext,
} from '../LanguageValidator.js';

/**
 * Validates JSON code blocks by attempting to parse their content and reporting
 * any syntax error.
 */
export class JsonValidator implements LanguageValidator {
  public validate(block: CodeBlock, context: ValidationContext): Violation[] {
    const violations: Violation[] = [];

    try {
      JSON.parse(block.content);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Invalid JSON';
      violations.push(
        new Violation(
          context.ruleId,
          `Invalid JSON syntax: ${errorMessage}`,
          Severity.ERROR,
          block.location
        )
      );
    }

    return violations;
  }
}
