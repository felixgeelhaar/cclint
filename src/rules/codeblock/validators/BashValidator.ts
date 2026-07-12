import type { CodeBlock } from '../../../domain/CodeBlock.js';
import { Violation } from '../../../domain/Violation.js';
import { Location } from '../../../domain/Location.js';
import { Severity } from '../../../domain/Severity.js';
import type {
  LanguageValidator,
  ValidationContext,
} from '../LanguageValidator.js';

/**
 * Validates Bash/shell code blocks for unquoted variables, dangerous
 * `rm -rf` usage, and unchecked `cd` commands.
 */
export class BashValidator implements LanguageValidator {
  public validate(block: CodeBlock, context: ValidationContext): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNumber = block.location.line + i;

      // Check for unquoted variables
      if (
        /\$\w+(?!["\w])/.test(line) &&
        !line.includes('$@') &&
        !line.includes('$*')
      ) {
        violations.push(
          new Violation(
            context.ruleId,
            `Quote variables to prevent word splitting (line ${lineNumber})`,
            Severity.WARNING,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for rm -rf without safeguards
      if (/rm\s+-rf/.test(line) && !block.metadata.isAntiPattern) {
        violations.push(
          new Violation(
            context.ruleId,
            `Dangerous 'rm -rf' command in example (line ${lineNumber})`,
            Severity.ERROR,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for missing error handling
      if (/^\s*cd\s+/.test(line) && !lines[i + 1]?.includes('||')) {
        violations.push(
          new Violation(
            context.ruleId,
            `Check for cd command success (line ${lineNumber})`,
            Severity.INFO,
            new Location(lineNumber, 1)
          )
        );
      }
    }

    return violations;
  }
}
