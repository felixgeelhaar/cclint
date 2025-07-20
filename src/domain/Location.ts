export class Location {
  public readonly line: number;
  public readonly column: number;

  constructor(line: number, column: number) {
    if (line <= 0) {
      throw new Error('Line number must be positive');
    }
    if (column < 0) {
      throw new Error('Column number must be non-negative');
    }

    this.line = line;
    this.column = column;
  }

  public toString(): string {
    return `${this.line}:${this.column}`;
  }

  public equals(other: Location): boolean {
    return this.line === other.line && this.column === other.column;
  }
}
