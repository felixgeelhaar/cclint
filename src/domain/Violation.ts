import { Location } from './Location.js';
import { Severity } from './Severity.js';

export class Violation {
  public readonly ruleId: string;
  public readonly message: string;
  public readonly severity: Severity;
  public readonly location: Location;

  constructor(
    ruleId: string,
    message: string,
    severity: Severity,
    location: Location
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
