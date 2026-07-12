import { assertWithinContentLimits } from './ContentLimits.js';

export class ContextFile {
  public readonly path: string;
  public readonly content: string;
  public readonly lines: string[];

  constructor(path: string, content: string) {
    if (path.trim() === '') {
      throw new Error('File path cannot be empty');
    }

    // Split on all line-ending conventions (CRLF, lone CR, LF) so a `line`
    // never retains a trailing carriage return, which would break
    // line-anchored rule logic (regex `$`/`.`, `endsWith`, `trimEnd`). The raw
    // `content` is preserved intact — only the `lines` view is normalized.
    const lines = content.split(/\r\n|\r|\n/);

    // Enforce the DoS caps here so every entrypoint (CLI, GitHub Action, MCP)
    // is protected, regardless of how the content was obtained.
    assertWithinContentLimits(content, path, lines);

    this.path = path;
    this.content = content;
    this.lines = lines;
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

  /**
   * Whether this file is a Markdown document (`.md` / `.markdown`).
   *
   * @remarks
   * Used by rules that validate Markdown-document structure so they only run
   * on Markdown files, not on other linted config (e.g. `settings.json`).
   */
  public isMarkdown(): boolean {
    return /\.(md|markdown)$/i.test(this.path);
  }

  /**
   * Whether this file is a Claude Code settings file
   * (`settings.json` / `settings.local.json`).
   */
  public isSettingsFile(): boolean {
    return /(^|[\\/])settings(\.local)?\.json$/i.test(this.path);
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
