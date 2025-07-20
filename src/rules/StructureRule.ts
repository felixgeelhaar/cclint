import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

export class StructureRule implements Rule {
  public readonly id = 'structure';
  public readonly description: string;

  private readonly requiredSections: string[];

  constructor(
    requiredSections: string[] = [
      'Project Overview',
      'Development Commands',
      'Architecture',
    ]
  ) {
    this.requiredSections = requiredSections;
    this.description = `File must contain required sections: ${requiredSections.join(', ')}`;
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    for (const requiredSection of this.requiredSections) {
      if (!file.hasSection(requiredSection)) {
        violations.push(
          new Violation(
            this.id,
            `Missing required section: "${requiredSection}"`,
            Severity.ERROR,
            new Location(1, 1)
          )
        );
      }
    }

    return violations;
  }
}
