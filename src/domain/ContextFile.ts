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

  /**
   * Whether this file is a Claude Code plugin manifest — either a plugin
   * descriptor (`plugin.json`, conventionally under `.claude-plugin/`) or a
   * marketplace listing (`marketplace.json`).
   *
   * @remarks
   * Matched by basename so both the plugin and marketplace manifests are
   * covered wherever they live, while ordinary `package.json` / `tsconfig.json`
   * files are left untouched.
   */
  public isPluginManifest(): boolean {
    return /(^|[\\/])(plugin|marketplace)\.json$/i.test(this.path);
  }

  /**
   * Whether this file is a Claude Code MCP server configuration (`.mcp.json`).
   *
   * @remarks
   * Matches the dotfile `.mcp.json` and any `*.mcp.json`, but not a plain
   * `mcp.json` without the leading dot or a generic `*.json`.
   */
  public isMcpConfig(): boolean {
    return /\.mcp\.json$/i.test(this.path);
  }

  /**
   * Whether this file is a Claude Code output style
   * (a Markdown file under an `output-styles/` directory).
   */
  public isOutputStyle(): boolean {
    return /(^|[\\/])output-styles[\\/].+\.(md|markdown)$/i.test(this.path);
  }

  /**
   * Whether this file is a Claude Code skill (a Markdown file under a
   * `.claude/skills/` directory).
   */
  public isSkillFile(): boolean {
    return /(^|[\\/])\.claude[\\/]skills[\\/].+\.(md|markdown)$/i.test(
      this.path
    );
  }

  /**
   * Whether this file is a Claude Code subagent (a Markdown file under a
   * `.claude/agents/` directory).
   */
  public isAgentFile(): boolean {
    return /(^|[\\/])\.claude[\\/]agents[\\/].+\.(md|markdown)$/i.test(
      this.path
    );
  }

  /**
   * Whether this file is a CLAUDE.md-style context document — a Markdown file
   * that is NOT a skill, subagent, or output-style.
   *
   * @remarks
   * Used by rules that validate CLAUDE.md *document* structure (required
   * sections, monorepo hierarchy, file location, opinionated guidance). Those
   * rules must not fire on skill / subagent / output-style Markdown, which are
   * Markdown but not CLAUDE.md documents — otherwise a project-wide lint spams
   * "missing section" false positives on every skill and agent file.
   */
  public isClaudeMarkdown(): boolean {
    return (
      this.isMarkdown() &&
      !this.isSkillFile() &&
      !this.isAgentFile() &&
      !this.isOutputStyle()
    );
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
