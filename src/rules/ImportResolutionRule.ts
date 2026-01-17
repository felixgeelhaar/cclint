import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';
import { existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';

/**
 * Rule that validates import resolution and detects circular dependencies
 *
 * @remarks
 * Validates that @path/to/file imports:
 * - Point to files that actually exist
 * - Don't create circular dependency chains
 * - Respect the 5-hop maximum depth limit
 * - Resolve correctly in the directory hierarchy
 *
 * @see {@link https://docs.claude.com/en/docs/claude-code/memory#claude-md-imports | CLAUDE.md import documentation}
 *
 * @category Rules
 */
export class ImportResolutionRule implements Rule {
  public readonly id = 'import-resolution';
  public readonly description =
    'Validates that imports resolve to existing files and detects circular dependencies';

  private readonly maxDepth: number;

  constructor(maxDepth: number = 5) {
    this.maxDepth = maxDepth;
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];
    const imports = this.extractImports(file);

    // Track import chain for circular dependency detection
    const importChain: string[] = [file.path];
    const visited = new Set<string>([file.path]);

    for (const imp of imports) {
      const resolvedPath = this.resolvePath(imp.path, file.path);

      // Check if file exists
      if (!existsSync(resolvedPath)) {
        violations.push(
          new Violation(
            this.id,
            `Import "@${imp.path}" resolves to "${resolvedPath}" which does not exist`,
            Severity.ERROR,
            new Location(imp.line, imp.column)
          )
        );
        continue;
      }

      // Check for circular dependencies
      if (visited.has(resolvedPath)) {
        const cycle = [...importChain, resolvedPath].join(' → ');
        violations.push(
          new Violation(
            this.id,
            `Circular import detected: ${cycle}`,
            Severity.ERROR,
            new Location(imp.line, imp.column)
          )
        );
        continue;
      }

      // Validate import depth recursively
      const depthViolations = this.validateImportDepth(
        resolvedPath,
        1,
        [...importChain],
        new Set(visited)
      );
      violations.push(...depthViolations);
    }

    return violations;
  }

  /**
   * Extract all imports from a file
   */
  private extractImports(file: ContextFile): ImportInfo[] {
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

      // Find all imports in this line
      const regex = /@([\w\-~/.]+)/g;
      let match;

      while ((match = regex.exec(line)) !== null) {
        const path = match[1];
        if (path && !this.isInCodeSpan(line, match.index)) {
          imports.push({
            path,
            line: lineNumber,
            column: match.index,
          });
        }
      }
    }

    return imports;
  }

  /**
   * Check if position is inside a code span
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
   * Resolve import path to absolute file path
   */
  private resolvePath(importPath: string, currentFilePath: string): string {
    const currentDir = currentFilePath.includes('/')
      ? currentFilePath.substring(0, currentFilePath.lastIndexOf('/'))
      : '.';

    // Handle home directory paths
    if (importPath.startsWith('~/')) {
      const homeDir = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '~';
      return resolve(homeDir, importPath.substring(2));
    }

    // Handle absolute paths
    if (isAbsolute(importPath)) {
      return resolve(importPath);
    }

    // Handle relative paths
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      return resolve(currentDir, importPath);
    }

    // Default: relative to current file
    return resolve(currentDir, importPath);
  }

  /**
   * Validate import depth recursively
   */
  private validateImportDepth(
    filePath: string,
    currentDepth: number,
    importChain: string[],
    visited: Set<string>
  ): Violation[] {
    const violations: Violation[] = [];

    // Check max depth
    if (currentDepth > this.maxDepth) {
      const chain = [...importChain, filePath].join(' → ');
      violations.push(
        new Violation(
          this.id,
          `Import chain exceeds maximum depth of ${this.maxDepth} hops: ${chain}`,
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      return violations;
    }

    // Try to read the imported file
    let importedFile: ContextFile;
    try {
      importedFile = ContextFile.fromFile(filePath);
    } catch (_error) {
      // File might not be a text file or readable
      return violations;
    }

    const nestedImports = this.extractImports(importedFile);
    const newChain = [...importChain, filePath];
    const newVisited = new Set(visited);
    newVisited.add(filePath);

    for (const imp of nestedImports) {
      const resolvedPath = this.resolvePath(imp.path, filePath);

      // Check for circular dependencies
      if (newVisited.has(resolvedPath)) {
        const cycle = [...newChain, resolvedPath].join(' → ');
        violations.push(
          new Violation(
            this.id,
            `Circular import detected in nested imports: ${cycle}`,
            Severity.ERROR,
            new Location(1, 1)
          )
        );
        continue;
      }

      // Recursively validate nested imports
      const nestedViolations = this.validateImportDepth(
        resolvedPath,
        currentDepth + 1,
        newChain,
        newVisited
      );
      violations.push(...nestedViolations);
    }

    return violations;
  }
}

interface ImportInfo {
  path: string;
  line: number;
  column: number;
}
