import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';
import { FrontmatterParser, Frontmatter } from './support/FrontmatterParser.js';

const AT_START = new Location(1, 1);

/** Frontmatter keys an output style is expected to declare. */
const KNOWN_KEYS = new Set(['name', 'description']);

/**
 * Validates Claude Code output-style definitions (`.claude/output-styles/*.md`).
 *
 * @remarks
 * An output style is a Markdown file whose YAML frontmatter declares a `name`
 * and `description`; Claude Code lists it by those fields, so a style missing
 * them is undiscoverable. This rule reuses the shared {@link FrontmatterParser}
 * to require both fields and warns on unrecognized keys (usually typos). It is
 * a pure rule and performs no IO.
 */
export class OutputStyleRule implements Rule {
  public readonly id = 'output-style';
  public readonly description =
    'Validates Claude Code output-style frontmatter (.claude/output-styles/*.md)';

  public appliesTo(file: ContextFile): boolean {
    return file.isOutputStyle();
  }

  public lint(file: ContextFile): Violation[] {
    if (!file.isOutputStyle()) {
      return [];
    }

    const frontmatter = FrontmatterParser.parse(file.lines);

    if (!frontmatter.hasFence) {
      return [
        new Violation(
          this.id,
          'Output style is missing frontmatter. Add --- at the start with name and description.',
          Severity.ERROR,
          AT_START
        ),
      ];
    }

    const violations: Violation[] = [];
    violations.push(...this.validateRequired(frontmatter));
    violations.push(...this.validateUnknownKeys(file.lines));
    return violations;
  }

  private validateRequired(frontmatter: Frontmatter): Violation[] {
    const violations: Violation[] = [];

    if (!frontmatter.getString('name')) {
      violations.push(
        new Violation(
          this.id,
          'Output style frontmatter is missing required "name" field.',
          Severity.ERROR,
          AT_START
        )
      );
    }

    if (!frontmatter.getString('description')) {
      violations.push(
        new Violation(
          this.id,
          'Output style frontmatter is missing required "description" field.',
          Severity.ERROR,
          AT_START
        )
      );
    }

    return violations;
  }

  /**
   * Warn on frontmatter keys outside the known set. Keys are read straight from
   * the fence lines (matching the parser's own `key:` grammar) so the warning
   * lists exactly what the author typed.
   */
  private validateUnknownKeys(lines: string[]): Violation[] {
    const violations: Violation[] = [];

    for (const key of topLevelKeys(lines)) {
      if (!KNOWN_KEYS.has(key)) {
        violations.push(
          new Violation(
            this.id,
            `Unknown output-style frontmatter key "${key}". Recognized keys: ${[
              ...KNOWN_KEYS,
            ].join(', ')}.`,
            Severity.WARNING,
            AT_START
          )
        );
      }
    }

    return violations;
  }
}

/**
 * Extract the top-level `key:` names declared inside the first frontmatter
 * fence, mirroring {@link FrontmatterParser}'s key grammar (a `\w+:` at column
 * zero). List items and indented continuations are ignored.
 */
function topLevelKeys(lines: string[]): string[] {
  const keys: string[] = [];
  let inFrontmatter = false;

  for (const line of lines) {
    if (line.trim() === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
        continue;
      }
      break;
    }
    if (!inFrontmatter) {
      continue;
    }
    const match = /^(\w+):/.exec(line);
    if (match?.[1] !== undefined) {
      keys.push(match[1]);
    }
  }

  return keys;
}
