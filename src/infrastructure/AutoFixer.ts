import type { Fix, AutoFixResult } from '../domain/AutoFix.js';
import type { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';

export class AutoFixer {
  static applyFixes(content: string, fixes: Fix[]): AutoFixResult {
    if (fixes.length === 0) {
      return {
        fixed: false,
        content,
        appliedFixes: [],
      };
    }

    // Sort fixes by position (start from end to avoid offset issues)
    const sortedFixes = [...fixes].sort((a, b) => {
      if (a.range.start.line !== b.range.start.line) {
        return b.range.start.line - a.range.start.line;
      }
      return b.range.start.column - a.range.start.column;
    });

    let modifiedContent = content;
    const lines = content.split('\n');
    const appliedFixes: Fix[] = [];

    for (const fix of sortedFixes) {
      try {
        const startLine = fix.range.start.line - 1; // Convert to 0-based
        const endLine = fix.range.end.line - 1;
        const startCol = fix.range.start.column - 1;
        const endCol = fix.range.end.column - 1;

        if (startLine === endLine) {
          // Single line replacement
          const line = lines[startLine];
          if (line) {
            lines[startLine] =
              line.substring(0, startCol) + fix.text + line.substring(endCol);
            appliedFixes.push(fix);
          }
        } else {
          // Multi-line replacement
          const startLineText = lines[startLine];
          const endLineText = lines[endLine];

          if (startLineText && endLineText) {
            const newText =
              startLineText.substring(0, startCol) +
              fix.text +
              endLineText.substring(endCol);

            lines.splice(startLine, endLine - startLine + 1, newText);
            appliedFixes.push(fix);
          }
        }
      } catch (error) {
        console.warn(`Failed to apply fix: ${fix.description}`, error);
      }
    }

    modifiedContent = lines.join('\n');

    return {
      fixed: appliedFixes.length > 0,
      content: modifiedContent,
      appliedFixes,
    };
  }

  static generateFixesForViolations(
    violations: Violation[],
    content: string
  ): Fix[] {
    const fixes: Fix[] = [];

    for (const violation of violations) {
      const fix = this.generateFixForViolation(violation, content);
      if (fix) {
        fixes.push(fix);
      }
    }

    return fixes;
  }

  private static generateFixForViolation(
    violation: Violation,
    content: string
  ): Fix | null {
    const lines = content.split('\n');
    const line = lines[violation.location.line - 1];

    // For empty line violations, we don't need the line content check
    if (!line && !violation.message.includes('consecutive empty lines'))
      return null;

    switch (violation.ruleId) {
      case 'format':
        return this.generateFormatFix(
          violation,
          line || '',
          violation.location
        );
      default:
        return null;
    }
  }

  private static generateFormatFix(
    violation: Violation,
    line: string,
    location: { line: number; column: number }
  ): Fix | null {
    // Fix header spacing issues - matches "Header missing space after ###"
    if (violation.message.includes('Header missing space after')) {
      const match = line.match(/^(#+)([^#\s])/);
      if (match && match[1]) {
        return {
          range: {
            start: new Location(location.line, match[1].length + 1),
            end: new Location(location.line, match[1].length + 1),
          },
          text: ' ',
          description: 'Add space after header #',
        };
      }
    }

    // Fix trailing whitespace - matches "Line has trailing whitespace"
    if (violation.message.includes('Line has trailing whitespace')) {
      const trailingMatch = line.match(/\s+$/);
      if (trailingMatch) {
        const startCol = line.length - trailingMatch[0].length + 1;
        return {
          range: {
            start: new Location(location.line, startCol),
            end: new Location(location.line, line.length + 1),
          },
          text: '',
          description: 'Remove trailing whitespace',
        };
      }
    }

    // Fix multiple consecutive empty lines - matches "Too many consecutive empty lines"
    if (violation.message.includes('Too many consecutive empty lines')) {
      return {
        range: {
          start: new Location(location.line, 1),
          end: new Location(location.line + 1, 1),
        },
        text: '',
        description: 'Remove extra empty line',
      };
    }

    return null;
  }
}
