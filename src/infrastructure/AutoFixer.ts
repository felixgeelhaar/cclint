import type { Fix, AutoFixResult } from '../domain/AutoFix.js';
import type { Violation } from '../domain/Violation.js';
import type { CustomRule } from '../domain/CustomRule.js';
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
    content: string,
    customRules: CustomRule[] = []
  ): Fix[] {
    const fixes: Fix[] = [];

    // Create a map of custom rules by ID for quick lookup
    const customRuleMap = new Map<string, CustomRule>();
    customRules.forEach(rule => {
      customRuleMap.set(rule.id, rule);
    });

    for (const violation of violations) {
      // Check if this violation is from a custom rule
      const customRule = customRuleMap.get(violation.ruleId);
      if (customRule) {
        // Use custom rule's generateFixes method
        const customFixes = customRule.generateFixes([violation], content);
        fixes.push(...customFixes);
      } else {
        // Use built-in fix generation
        const generatedFixes = this.generateFixForViolation(violation, content);
        if (Array.isArray(generatedFixes)) {
          fixes.push(...generatedFixes);
        } else if (generatedFixes) {
          fixes.push(generatedFixes);
        }
      }
    }

    return fixes;
  }

  private static generateFixForViolation(
    violation: Violation,
    content: string
  ): Fix | Fix[] | null {
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
          violation.location,
          content
        );
      default:
        return null;
    }
  }

  private static generateFormatFix(
    violation: Violation,
    line: string,
    location: { line: number; column: number },
    content: string
  ): Fix | Fix[] | null {
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

    // Fix missing final newline - matches "File should end with a newline"
    if (violation.message.includes('File should end with a newline')) {
      return {
        range: {
          start: new Location(location.line, location.column),
          end: new Location(location.line, location.column),
        },
        text: '\n',
        description: 'Add final newline',
      };
    }

    // Fix unclosed code block - matches "Unclosed code block"
    if (violation.message.includes('Unclosed code block')) {
      const lines = content.split('\n');
      const lastLine = lines[lines.length - 1] || '';
      return {
        range: {
          start: new Location(lines.length, lastLine.length + 1),
          end: new Location(lines.length, lastLine.length + 1),
        },
        text: '\n```',
        description: 'Close unclosed code block',
      };
    }

    // Fix unknown code block language - matches "Unknown code block language"
    if (violation.message.includes('Unknown code block language:')) {
      const langMatch = violation.message.match(/Unknown code block language: "([^"]+)"/);
      if (langMatch && langMatch[1]) {
        const lineText = line;
        const langStart = lineText.indexOf(langMatch[1]);
        if (langStart !== -1) {
          return {
            range: {
              start: new Location(location.line, langStart + 1),
              end: new Location(location.line, langStart + langMatch[1].length + 1),
            },
            text: 'text',
            description: 'Replace unknown language with "text"',
          };
        }
      }
    }

    // Fix inconsistent list markers - matches "Inconsistent list markers found"
    if (violation.message.includes('Inconsistent list markers found:')) {
      return this.generateListMarkerFixes(content);
    }

    return null;
  }

  private static generateListMarkerFixes(content: string): Fix[] {
    const fixes: Fix[] = [];
    const lines = content.split('\n');
    
    // Find all list markers and standardize to the first one found
    let standardMarker = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const listMatch = line.match(/^\s*([-*+])\s+/);
      if (listMatch && listMatch[1]) {
        if (!standardMarker) {
          standardMarker = listMatch[1];
        } else if (listMatch[1] !== standardMarker) {
          // Generate fix for inconsistent marker
          const markerStart = line.indexOf(listMatch[1]);
          fixes.push({
            range: {
              start: new Location(i + 1, markerStart + 1),
              end: new Location(i + 1, markerStart + 2),
            },
            text: standardMarker,
            description: `Standardize list marker to "${standardMarker}"`,
          });
        }
      }
    }
    
    return fixes;
  }
}
