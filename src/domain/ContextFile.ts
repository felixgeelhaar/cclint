export class ContextFile {
  public readonly path: string;
  public readonly content: string;
  public readonly lines: string[];

  constructor(path: string, content: string) {
    if (path.trim() === '') {
      throw new Error('File path cannot be empty');
    }

    this.path = path;
    this.content = content;
    this.lines = content.split('\n');
  }

  public static fromFile(filePath: string): ContextFile {
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf-8');
    return new ContextFile(filePath, content);
  }

  public getLineCount(): number {
    return this.lines.length;
  }

  public getCharacterCount(): number {
    return this.content.length;
  }

  public getLine(lineNumber: number): string {
    if (lineNumber <= 0) {
      throw new Error('Line number must be positive');
    }
    if (lineNumber > this.lines.length) {
      throw new Error(`Line number ${lineNumber} is out of range`);
    }

    return this.lines[lineNumber - 1] ?? '';
  }

  public hasSection(sectionTitle: string): boolean {
    const headerRegex = new RegExp(
      `^#{1,6}\\s+${this.escapeRegExp(sectionTitle)}\\s*$`,
      'm'
    );
    return headerRegex.test(this.content);
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
