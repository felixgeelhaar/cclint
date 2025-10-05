import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

/**
 * Rule that validates CLAUDE.md import syntax
 *
 * @remarks
 * Validates the @path/to/file import syntax introduced by Anthropic.
 * - Imports should not appear in code blocks or code spans
 * - Warns about potential circular dependencies
 * - Validates path formats (relative, absolute, home directory)
 *
 * @see {@link https://docs.claude.com/en/docs/claude-code/memory#claude-md-imports | CLAUDE.md imports documentation}
 *
 * @category Rules
 */
export class ImportSyntaxRule implements Rule {
  public readonly id = 'import-syntax';
  public readonly description =
    'Validates CLAUDE.md import syntax (@path/to/file)';

  private readonly maxDepth: number;

  constructor(maxDepth: number = 5) {
    this.maxDepth = maxDepth;
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];
    const imports: ImportInfo[] = [];

    let inCodeBlock = false;
    let lineNumber = 0;

    for (const line of file.lines) {
      lineNumber++;

      // Track code block state
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      // Skip lines inside code blocks
      if (inCodeBlock) {
        continue;
      }

      // Find all imports in this line (can have multiple)
      const importMatches = this.findImports(line);

      for (const match of importMatches) {
        // Check if import is inside a code span (backticks)
        if (this.isInCodeSpan(line, match.index)) {
          continue; // Valid - imports in code spans are ignored per Anthropic docs
        }

        // Validate import path
        const pathViolations = this.validateImportPath(
          match.path,
          lineNumber,
          match.index
        );
        violations.push(...pathViolations);

        // Track import for circular dependency detection
        imports.push({
          path: match.path,
          line: lineNumber,
          column: match.index,
        });
      }
    }

    // Check for potential issues with imports
    violations.push(...this.checkImportPatterns(imports));

    return violations;
  }

  /**
   * Find all import patterns in a line
   */
  private findImports(line: string): ImportMatch[] {
    const imports: ImportMatch[] = [];
    // Match @path patterns that are not in backticks
    const regex = /@([\w\-~/.]+)/g;
    let match;

    while ((match = regex.exec(line)) !== null) {
      const path = match[1];
      if (path) {
        imports.push({
          path,
          index: match.index,
        });
      }
    }

    return imports;
  }

  /**
   * Check if import is inside a code span (backticks)
   */
  private isInCodeSpan(line: string, position: number): boolean {
    let inSpan = false;
    let escapeNext = false;

    for (let i = 0; i < position; i++) {
      const char = line[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '`') {
        inSpan = !inSpan;
      }
    }

    return inSpan;
  }

  /**
   * Validate import path format and provide helpful suggestions
   */
  private validateImportPath(
    path: string,
    line: number,
    column: number
  ): Violation[] {
    const violations: Violation[] = [];

    // Check for common mistakes

    // 1. Package name pattern (should not be used for imports)
    if (path.includes('@') && !path.startsWith('~')) {
      violations.push(
        new Violation(
          this.id,
          `Import path "@${path}" appears to be a package name. CLAUDE.md imports use file paths, not package names.`,
          Severity.WARNING,
          new Location(line, column)
        )
      );
      return violations;
    }

    // 2. Absolute path validation (should start with / or ~/)
    if (path.startsWith('/') && !path.startsWith('//')) {
      // Valid absolute path
      return violations;
    }

    // 3. Home directory path validation
    if (path.startsWith('~/')) {
      // Valid home directory path
      return violations;
    }

    // 4. Relative path validation
    if (
      path.startsWith('./') ||
      path.startsWith('../') ||
      !path.includes('/')
    ) {
      // Valid relative path
      return violations;
    }

    // 5. Check for Windows-style paths
    if (path.includes('\\')) {
      violations.push(
        new Violation(
          this.id,
          `Import path "@${path}" uses Windows-style backslashes. Use forward slashes (/) instead.`,
          Severity.ERROR,
          new Location(line, column)
        )
      );
    }

    // 6. Check for spaces in path (likely an error)
    if (path.includes(' ')) {
      violations.push(
        new Violation(
          this.id,
          `Import path "@${path}" contains spaces. Paths should not have spaces or should be properly escaped.`,
          Severity.ERROR,
          new Location(line, column)
        )
      );
    }

    return violations;
  }

  /**
   * Check for patterns and potential issues across all imports
   */
  private checkImportPatterns(imports: ImportInfo[]): Violation[] {
    const violations: Violation[] = [];

    // Check for duplicate imports
    const pathCounts = new Map<string, number>();
    for (const imp of imports) {
      const count = pathCounts.get(imp.path) ?? 0;
      pathCounts.set(imp.path, count + 1);
    }

    for (const [path, count] of pathCounts) {
      if (count > 1) {
        violations.push(
          new Violation(
            this.id,
            `Import "@${path}" is referenced ${count} times. Consider consolidating duplicate imports.`,
            Severity.INFO,
            new Location(1, 1)
          )
        );
      }
    }

    // Warn if approaching max depth limit (can't fully validate without file system access)
    if (imports.length > 10) {
      violations.push(
        new Violation(
          this.id,
          `File contains ${imports.length} imports. Claude supports recursive imports with max depth of ${this.maxDepth} hops. Ensure import chains don't exceed this limit.`,
          Severity.WARNING,
          new Location(1, 1)
        )
      );
    }

    return violations;
  }
}

interface ImportMatch {
  path: string;
  index: number;
}

interface ImportInfo {
  path: string;
  line: number;
  column: number;
}
