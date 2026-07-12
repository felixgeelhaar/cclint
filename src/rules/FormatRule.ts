import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';
import type { Fix } from '../domain/AutoFix.js';

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

  public appliesTo(file: ContextFile): boolean {
    return file.isMarkdown();
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    if (file.content.trim() === '') {
      return violations;
    }

    // Lines inside fenced code blocks are literal content — markdown
    // formatting rules (and their autofixes) must never touch them, or a
    // '#!/bin/bash' shebang, a YAML '- item', or intentional whitespace gets
    // rewritten and the code corrupted.
    const fenced = this.fencedLineIndices(file);

    this.checkHeaders(file, violations, fenced);
    this.checkEmptyLines(file, violations, fenced);
    this.checkTrailingWhitespace(file, violations, fenced);
    this.checkCodeBlocks(file, violations, fenced);
    this.checkListFormatting(file);
    this.checkEndOfFile(file, violations);

    return violations;
  }

  /**
   * Indices (0-based) of lines that sit INSIDE a fenced code block. The ```
   * delimiter lines themselves are excluded — they are markdown structure.
   */
  private fencedLineIndices(file: ContextFile): Set<number> {
    const fenced = new Set<number>();
    let inFence = false;
    for (let i = 0; i < file.lines.length; i++) {
      if ((file.lines[i] ?? '').trim().startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence) {
        fenced.add(i);
      }
    }
    return fenced;
  }

  private checkHeaders(
    file: ContextFile,
    violations: Violation[],
    fenced: Set<number>
  ): void {
    for (let i = 0; i < file.lines.length; i++) {
      if (fenced.has(i)) continue;
      const line = file.lines[i] ?? '';
      const headerMatch = line.match(/^(#{1,6})(.*)$/);

      if (headerMatch) {
        const [, hashes, content] = headerMatch;
        if (hashes && content && !content.startsWith(' ')) {
          const at = new Location(i + 1, hashes.length + 1);
          violations.push(
            new Violation(
              this.id,
              `Header missing space after ${hashes}`,
              Severity.ERROR,
              at,
              {
                range: { start: at, end: at },
                text: ' ',
                description: 'Add space after header #',
              }
            )
          );
        }
      }
    }
  }

  private checkEmptyLines(
    file: ContextFile,
    violations: Violation[],
    fenced: Set<number>
  ): void {
    let consecutiveEmpty = 0;
    let emptyLineStart = -1;

    for (let i = 0; i < file.lines.length; i++) {
      if (fenced.has(i)) {
        consecutiveEmpty = 0; // blank lines inside code are intentional
        continue;
      }
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
              new Location(emptyLineStart + 1, 1),
              {
                range: {
                  start: new Location(emptyLineStart + 1, 1),
                  end: new Location(emptyLineStart + 2, 1),
                },
                text: '',
                description: 'Remove extra empty line',
              }
            )
          );
        }
        consecutiveEmpty = 0;
      }
    }
  }

  private checkTrailingWhitespace(
    file: ContextFile,
    violations: Violation[],
    fenced: Set<number>
  ): void {
    for (let i = 0; i < file.lines.length; i++) {
      if (fenced.has(i)) continue; // trailing space inside code may be significant
      const line = file.lines[i] ?? '';

      if (line.length > 0 && line !== line.trimEnd()) {
        const startCol = line.trimEnd().length + 1;
        violations.push(
          new Violation(
            this.id,
            'Line has trailing whitespace',
            Severity.WARNING,
            new Location(i + 1, startCol),
            {
              range: {
                start: new Location(i + 1, startCol),
                end: new Location(i + 1, line.length + 1),
              },
              text: '',
              description: 'Remove trailing whitespace',
            }
          )
        );
      }
    }
  }

  private checkCodeBlocks(
    file: ContextFile,
    violations: Violation[],
    fenced: Set<number>
  ): void {
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
            const langStart = line.indexOf(language);
            const fix: Fix | undefined =
              langStart !== -1
                ? {
                    range: {
                      start: new Location(i + 1, langStart + 1),
                      end: new Location(i + 1, langStart + language.length + 1),
                    },
                    text: 'text',
                    description: 'Replace unknown language with "text"',
                  }
                : undefined;
            violations.push(
              new Violation(
                this.id,
                `Unknown code block language: "${language}"`,
                Severity.INFO,
                new Location(i + 1, line.indexOf('```') + 4),
                fix
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
      const lastLine = file.lines[file.lines.length - 1] ?? '';
      const endOfFile = new Location(file.lines.length, lastLine.length + 1);
      violations.push(
        new Violation(
          this.id,
          'Unclosed code block',
          Severity.ERROR,
          new Location(codeBlockStart + 1, 1),
          {
            range: { start: endOfFile, end: endOfFile },
            text: '\n```',
            description: 'Close unclosed code block',
          }
        )
      );
    }

    // Check list markers separately
    this.checkListConsistency(file, violations, fenced);
  }

  private checkListConsistency(
    file: ContextFile,
    violations: Violation[],
    fenced: Set<number>
  ): void {
    const listMarkers = new Set<string>();

    for (let i = 0; i < file.lines.length; i++) {
      if (fenced.has(i)) continue; // a YAML/Markdown '-' in a code sample is not a doc list
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
      const at = new Location(file.getLineCount(), lastLine.length + 1);
      violations.push(
        new Violation(
          this.id,
          'File should end with a newline',
          Severity.WARNING,
          at,
          {
            range: { start: at, end: at },
            text: '\n',
            description: 'Add final newline',
          }
        )
      );
    }
  }
}
