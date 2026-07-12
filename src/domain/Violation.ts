import { Location } from './Location.js';
import { Severity } from './Severity.js';
import type { Fix } from './AutoFix.js';

export class Violation {
  public readonly ruleId: string;
  public readonly message: string;
  public readonly severity: Severity;
  public readonly location: Location;
  /**
   * An optional, structured auto-fix for this violation.
   *
   * @remarks
   * The rule that detects a problem is best placed to describe how to fix it,
   * so it may attach the exact edit here. When present, tooling applies this
   * edit directly instead of re-deriving one by pattern-matching the message
   * (which is brittle and couples the fixer to human-readable wording).
   */
  public readonly fix?: Fix;

  constructor(
    ruleId: string,
    message: string,
    severity: Severity,
    location: Location,
    fix?: Fix
  ) {
    if (ruleId.trim() === '') {
      throw new Error('Rule ID cannot be empty');
    }
    if (message.trim() === '') {
      throw new Error('Message cannot be empty');
    }

    this.ruleId = ruleId;
    this.message = message;
    this.severity = severity;
    this.location = location;
    if (fix !== undefined) {
      this.fix = fix;
    }
  }

  public toString(): string {
    return `${this.severity.toString()}: ${this.message} at ${this.location.toString()} [${this.ruleId}]`;
  }

  public equals(other: Violation): boolean {
    return (
      this.ruleId === other.ruleId &&
      this.message === other.message &&
      this.severity === other.severity &&
      this.location.equals(other.location)
    );
  }
}
