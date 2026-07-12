import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';
import { FrontmatterParser, Frontmatter } from './support/FrontmatterParser.js';

export class SkillStructureRule implements Rule {
  public readonly id = 'skill-structure';
  public readonly description =
    'Validates Claude Code skill structure and frontmatter';

  private readonly requireDescription: boolean;
  private readonly maxDescriptionLength: number;
  private readonly minDescriptionLength = 10;

  constructor(options?: {
    requireDescription?: boolean;
    maxDescriptionLength?: number;
  }) {
    this.requireDescription = options?.requireDescription ?? true;
    this.maxDescriptionLength = options?.maxDescriptionLength ?? 200;
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    if (!this.isSkillFile(file.path)) {
      return violations;
    }

    const frontmatter = FrontmatterParser.parse(file.lines);

    violations.push(...this.validateFrontmatter(frontmatter));

    violations.push(...this.validateStructure(file.lines));

    return violations;
  }

  private isSkillFile(path: string): boolean {
    return path.includes('.claude/skills/') && path.endsWith('.md');
  }

  private validateFrontmatter(frontmatter: Frontmatter): Violation[] {
    const violations: Violation[] = [];

    const name = frontmatter.getString('name');
    const description = frontmatter.getString('description');

    if (!frontmatter.hasFence) {
      violations.push(
        new Violation(
          this.id,
          'Skill file is missing frontmatter. Add --- at the start with name and description.',
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      return violations;
    }

    if (!name) {
      violations.push(
        new Violation(
          this.id,
          'Skill frontmatter is missing required "name" field.',
          Severity.ERROR,
          new Location(1, 1)
        )
      );
    } else if (!this.isValidSkillName(name)) {
      violations.push(
        new Violation(
          this.id,
          `Skill name "${name}" should use kebab-case (lowercase with hyphens).`,
          Severity.ERROR,
          new Location(1, 1)
        )
      );
    }

    if (!description) {
      if (this.requireDescription) {
        violations.push(
          new Violation(
            this.id,
            'Skill frontmatter is missing required "description" field.',
            Severity.ERROR,
            new Location(1, 1)
          )
        );
      }
    } else {
      const descLength = description.length;

      if (descLength < this.minDescriptionLength) {
        violations.push(
          new Violation(
            this.id,
            `Skill description is too short (${descLength} chars). Minimum is ${this.minDescriptionLength} characters.`,
            Severity.WARNING,
            new Location(1, 1)
          )
        );
      }

      if (descLength > this.maxDescriptionLength) {
        violations.push(
          new Violation(
            this.id,
            `Skill description is too long (${descLength} chars). Maximum is ${this.maxDescriptionLength} characters.`,
            Severity.WARNING,
            new Location(1, 1)
          )
        );
      }
    }

    return violations;
  }

  private isValidSkillName(name: string): boolean {
    return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
  }

  private validateStructure(lines: string[]): Violation[] {
    const violations: Violation[] = [];

    let lineNumber = 0;
    let foundContent = false;

    for (const line of lines) {
      lineNumber++;
      const trimmed = line.trim();

      if (trimmed === '---') {
        continue;
      }

      if (trimmed.length > 0 && !trimmed.startsWith('#')) {
        foundContent = true;
        break;
      }
    }

    if (!foundContent) {
      violations.push(
        new Violation(
          this.id,
          'Skill file appears empty after frontmatter. Add content describing the skill.',
          Severity.WARNING,
          new Location(lineNumber, 1)
        )
      );
    }

    return violations;
  }
}
