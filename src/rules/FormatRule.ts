import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

export class FormatRule implements Rule {
  public readonly id = 'format';
  public readonly description =
    'Markdown format validation for proper syntax and style';

  private readonly validLanguages = new Set([
    'bash',
    'sh',
    'shell',
    'javascript',
    'js',
    'typescript',
    'ts',
    'python',
    'py',
    'java',
    'c',
    'cpp',
    'csharp',
    'c#',
    'go',
    'rust',
    'php',
    'ruby',
    'swift',
    'kotlin',
    'html',
    'css',
    'scss',
    'sass',
    'less',
    'json',
    'xml',
    'yaml',
    'yml',
    'toml',
    'sql',
    'dockerfile',
    'makefile',
    'markdown',
    'md',
    'text',
    'txt',
  ]);

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    if (file.content.trim() === '') {
      return violations;
    }

    this.checkHeaders(file, violations);
    this.checkEmptyLines(file, violations);
    this.checkTrailingWhitespace(file, violations);
    this.checkCodeBlocks(file, violations);
    this.checkListFormatting(file);
    this.checkEndOfFile(file, violations);

    return violations;
  }

  private checkHeaders(file: ContextFile, violations: Violation[]): void {
    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';
      const headerMatch = line.match(/^(#{1,6})(.*)$/);

      if (headerMatch) {
        const [, hashes, content] = headerMatch;
        if (hashes && content && !content.startsWith(' ')) {
          violations.push(
            new Violation(
              this.id,
              `Header missing space after ${hashes}`,
              Severity.ERROR,
              new Location(i + 1, hashes.length + 1)
            )
          );
        }
      }
    }
  }

  private checkEmptyLines(file: ContextFile, violations: Violation[]): void {
    let consecutiveEmpty = 0;
    let emptyLineStart = -1;

    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';

      if (line.trim() === '') {
        if (consecutiveEmpty === 0) {
          emptyLineStart = i;
        }
        consecutiveEmpty++;
      } else {
        if (consecutiveEmpty > 2) {
          violations.push(
            new Violation(
              this.id,
              `Too many consecutive empty lines (${consecutiveEmpty}), maximum 2 allowed`,
              Severity.WARNING,
              new Location(emptyLineStart + 1, 1)
            )
          );
        }
        consecutiveEmpty = 0;
      }
    }
  }

  private checkTrailingWhitespace(
    file: ContextFile,
    violations: Violation[]
  ): void {
    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';

      if (line.length > 0 && line !== line.trimEnd()) {
        violations.push(
          new Violation(
            this.id,
            'Line has trailing whitespace',
            Severity.WARNING,
            new Location(i + 1, line.trimEnd().length + 1)
          )
        );
      }
    }
  }

  private checkCodeBlocks(file: ContextFile, violations: Violation[]): void {
    let inCodeBlock = false;
    let codeBlockStart = -1;

    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';

      // Check for code block start/end
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockStart = i;

          // Check language specification
          const language = line
            .slice(line.indexOf('```') + 3)
            .trim()
            .toLowerCase();
          if (language && !this.validLanguages.has(language)) {
            violations.push(
              new Violation(
                this.id,
                `Unknown code block language: "${language}"`,
                Severity.INFO,
                new Location(i + 1, line.indexOf('```') + 4)
              )
            );
          }
        } else {
          inCodeBlock = false;
        }
      }
    }

    // Check for unclosed code blocks
    if (inCodeBlock) {
      violations.push(
        new Violation(
          this.id,
          'Unclosed code block',
          Severity.ERROR,
          new Location(codeBlockStart + 1, 1)
        )
      );
    }

    // Check list markers separately
    this.checkListConsistency(file, violations);
  }

  private checkListConsistency(
    file: ContextFile,
    violations: Violation[]
  ): void {
    const listMarkers = new Set<string>();

    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';

      // Check for list markers
      const listMatch = line.match(/^\s*([-*+]|\d+[.)])\s+/);
      if (listMatch) {
        const marker = listMatch[1];
        if (marker) {
          const normalizedMarker = marker.match(/\d/)
            ? 'numbered'
            : marker.charAt(0);
          listMarkers.add(normalizedMarker);
        }
      }
    }

    // Check for consistent list markers
    const bulletMarkers = Array.from(listMarkers).filter(m => m !== 'numbered');
    if (bulletMarkers.length > 1) {
      violations.push(
        new Violation(
          this.id,
          `Inconsistent list markers found: ${bulletMarkers.join(', ')}. Use consistent markers throughout.`,
          Severity.WARNING,
          new Location(1, 1)
        )
      );
    }
  }

  private checkListFormatting(file: ContextFile): void {
    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';

      // Check numbered list formatting - placeholder for future enhancements
      const numberedMatch = line.match(/^\s*(\d+)([.)])\s*/);
      if (numberedMatch) {
        // This could be extended to check for consistent separator usage
      }
    }
  }

  private checkEndOfFile(file: ContextFile, violations: Violation[]): void {
    if (file.content.length > 0 && !file.content.endsWith('\n')) {
      const lastLineIndex = file.getLineCount() - 1;
      const lastLine = file.lines[lastLineIndex] ?? '';
      violations.push(
        new Violation(
          this.id,
          'File should end with a newline',
          Severity.WARNING,
          new Location(file.getLineCount(), lastLine.length + 1)
        )
      );
    }
  }
}
