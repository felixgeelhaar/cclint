import type { CodeBlock } from '../../../domain/CodeBlock.js';
import { Violation } from '../../../domain/Violation.js';
import { Location } from '../../../domain/Location.js';
import { Severity } from '../../../domain/Severity.js';
import type {
  LanguageValidator,
  ValidationContext,
} from '../LanguageValidator.js';

/**
 * Validates Python code blocks for `print()` in non-example code, bare
 * `except:` clauses, and functions missing type hints.
 */
export class PythonValidator implements LanguageValidator {
  public validate(block: CodeBlock, context: ValidationContext): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNumber = block.location.line + i;

      // Check for print statements in non-example code
      if (!block.metadata.isExample && /\bprint\s*\(/.test(line)) {
        violations.push(
          new Violation(
            context.ruleId,
            `Consider using logging instead of print() (line ${lineNumber})`,
            Severity.INFO,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for bare except clauses
      if (/except\s*:/.test(line)) {
        violations.push(
          new Violation(
            context.ruleId,
            `Avoid bare 'except:' clauses, specify exception type (line ${lineNumber})`,
            Severity.WARNING,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for type hints in function definitions
      if (/def\s+\w+\s*\([^)]*\)\s*:/.test(line) && !line.includes('->')) {
        violations.push(
          new Violation(
            context.ruleId,
            `Consider adding type hints to function (line ${lineNumber})`,
            Severity.INFO,
            new Location(lineNumber, 1)
          )
        );
      }
    }

    return violations;
  }
}
