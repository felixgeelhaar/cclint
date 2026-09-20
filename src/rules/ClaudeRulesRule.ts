import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';
import { FrontmatterParser } from './support/FrontmatterParser.js';

const AT_START = new Location(1, 1);

/**
 * Validates `.claude/rules/*.md` instruction modules.
 *
 * @remarks
 * Rules without a `paths` frontmatter field load every session (same priority
 * as `.claude/CLAUDE.md`). Rules with `paths` are path-scoped and only enter
 * context when Claude reads a matching file. Both YAML-array and CSV `paths`
 * forms are accepted (Claude Code has historically been picky about YAML
 * arrays; CSV scalars are the more compatible shape).
 */
export class ClaudeRulesRule implements Rule {
  public readonly id = 'claude-rules';
  public readonly description =
    'Validates .claude/rules/*.md frontmatter and path-scoped paths globs';

  public appliesTo(file: ContextFile): boolean {
    return file.isClaudeRulesFile();
  }

  public lint(file: ContextFile): Violation[] {
    if (!file.isClaudeRulesFile()) {
      return [];
    }

    const violations: Violation[] = [];
    const frontmatter = FrontmatterParser.parse(file.lines);

    if (frontmatter.has('paths')) {
      const paths = frontmatter.getStringArray('paths');
      if (paths === undefined || paths.length === 0) {
        violations.push(
          new Violation(
            this.id,
            'Rule declares "paths" but the list is empty. Provide at least one glob (e.g. paths: "src/**/*.ts" or a YAML list), or remove the field for a global rule.',
            Severity.ERROR,
            AT_START
          )
        );
      } else {
        for (const pattern of paths) {
          if (pattern.trim() === '') {
            violations.push(
              new Violation(
                this.id,
                'Rule "paths" contains an empty pattern. Remove blanks or fix the glob list.',
                Severity.ERROR,
                AT_START
              )
            );
            break;
          }
        }
      }
    }

    const body = bodyWithoutFrontmatter(file.lines).trim();
    if (body.length === 0) {
      violations.push(
        new Violation(
          this.id,
          'Rule file has no instruction body. Add concrete guidance under the frontmatter (or remove an empty rule).',
          Severity.WARNING,
          AT_START
        )
      );
    }

    return violations;
  }
}

/** Strip the leading YAML frontmatter fence so body emptiness is meaningful. */
function bodyWithoutFrontmatter(lines: string[]): string {
  if (lines[0]?.trim() !== '---') {
    return lines.join('\n');
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      return lines.slice(i + 1).join('\n');
    }
  }
  return lines.join('\n');
}
