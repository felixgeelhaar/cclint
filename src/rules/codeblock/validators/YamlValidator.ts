import type { CodeBlock } from '../../../domain/CodeBlock.js';
import { Violation } from '../../../domain/Violation.js';
import { Location } from '../../../domain/Location.js';
import { Severity } from '../../../domain/Severity.js';
import type {
  LanguageValidator,
  ValidationContext,
} from '../LanguageValidator.js';

/**
 * Validates YAML code blocks, flagging tab indentation (YAML requires spaces).
 */
export class YamlValidator implements LanguageValidator {
  public validate(block: CodeBlock, context: ValidationContext): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    // Basic YAML validation
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNumber = block.location.line + i;

      // Check for tabs (YAML requires spaces)
      if (line.includes('\t')) {
        violations.push(
          new Violation(
            context.ruleId,
            `YAML files should use spaces, not tabs (line ${lineNumber})`,
            Severity.ERROR,
            new Location(lineNumber, 1)
          )
        );
      }
    }

    return violations;
  }
}
