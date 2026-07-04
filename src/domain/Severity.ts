export class Severity {
  public static readonly ERROR = new Severity(2, 'error');
  public static readonly WARNING = new Severity(1, 'warning');
  public static readonly INFO = new Severity(0, 'info');

  public readonly level: number;
  public readonly name: string;

  private constructor(level: number, name: string) {
    this.level = level;
    this.name = name;
  }

  /**
   * Resolve a severity by its config name ('error' | 'warning' | 'info'),
   * or undefined for an unrecognised value.
   */
  public static fromName(name: string): Severity | undefined {
    switch (name) {
      case 'error':
        return Severity.ERROR;
      case 'warning':
        return Severity.WARNING;
      case 'info':
        return Severity.INFO;
      default:
        return undefined;
    }
  }

  public compareTo(other: Severity): number {
    return this.level - other.level;
  }

  public toString(): string {
    return this.name;
  }

  public isAtLeast(minimum: Severity): boolean {
    return this.level >= minimum.level;
  }
}
