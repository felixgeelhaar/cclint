import type { CodeBlock } from '../../../domain/CodeBlock.js';
import { Violation } from '../../../domain/Violation.js';
import { Location } from '../../../domain/Location.js';
import { Severity } from '../../../domain/Severity.js';
import type {
  LanguageValidator,
  ValidationContext,
} from '../LanguageValidator.js';

/**
 * Validates Go code blocks for unhandled errors after `:=` assignments and
 * `panic()` usage in example code.
 */
export class GoValidator implements LanguageValidator {
  public validate(block: CodeBlock, context: ValidationContext): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNumber = block.location.line + i;

      // Check for error handling
      if (/err\s*:=/.test(line)) {
        // Check if error is handled in next few lines
        const nextLines = lines.slice(i + 1, i + 5).join('\n');
        if (!nextLines.includes('if err != nil')) {
          violations.push(
            new Violation(
              context.ruleId,
              `Error not handled after assignment (line ${lineNumber})`,
              Severity.ERROR,
              new Location(lineNumber, 1)
            )
          );
        }
      }

      // Check for panic in example code
      if (!block.metadata.isAntiPattern && /\bpanic\s*\(/.test(line)) {
        violations.push(
          new Violation(
            context.ruleId,
            `Avoid using panic() in example code (line ${lineNumber})`,
            Severity.WARNING,
            new Location(lineNumber, 1)
          )
        );
      }
    }

    return violations;
  }
}
