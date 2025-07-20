import { ContextFile } from './ContextFile.js';
import { Violation } from './Violation.js';
import { Severity } from './Severity.js';

export class LintingResult {
  public readonly file: ContextFile;
  private readonly _violations: Violation[] = [];

  constructor(file: ContextFile) {
    this.file = file;
  }

  public get violations(): readonly Violation[] {
    return this._violations;
  }

  public addViolation(violation: Violation): void {
    this._violations.push(violation);
  }

  public hasViolations(): boolean {
    return this._violations.length > 0;
  }

  public getViolationsByRule(ruleId: string): Violation[] {
    return this._violations.filter(violation => violation.ruleId === ruleId);
  }

  public getViolationsBySeverity(severity: Severity): Violation[] {
    return this._violations.filter(
      violation => violation.severity === severity
    );
  }

  public getErrorCount(): number {
    return this.getViolationsBySeverity(Severity.ERROR).length;
  }

  public getWarningCount(): number {
    return this.getViolationsBySeverity(Severity.WARNING).length;
  }

  public getInfoCount(): number {
    return this.getViolationsBySeverity(Severity.INFO).length;
  }

  public getHighestSeverity(): Severity {
    if (this._violations.length === 0) {
      return Severity.INFO;
    }

    return this._violations.reduce((highest, violation) => {
      return violation.severity.compareTo(highest) > 0
        ? violation.severity
        : highest;
    }, Severity.INFO);
  }
}
