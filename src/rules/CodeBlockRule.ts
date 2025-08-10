import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';
import { CodeBlockExtractor } from '../infrastructure/CodeBlockExtractor.js';
import { CodeBlock } from '../domain/CodeBlock.js';

/**
 * Rule that validates code blocks within CLAUDE.md files
 * Checks for syntax, completeness, and best practices
 */
export class CodeBlockRule implements Rule {
  public readonly id = 'code-blocks';
  public readonly description =
    'Validates code blocks for syntax and best practices';

  private extractor: CodeBlockExtractor;
  private enabledLanguages: Set<string>;
  private strictMode: boolean;

  constructor(options?: CodeBlockRuleOptions) {
    this.extractor = new CodeBlockExtractor();
    this.enabledLanguages = new Set(
      options?.languages || [
        'javascript',
        'typescript',
        'python',
        'go',
        'bash',
        'sql',
        'yaml',
        'json',
      ]
    );
    this.strictMode = options?.strict ?? true;
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];
    const codeBlocks = this.extractor.extractCodeBlocks(file);

    // Check for code blocks without language specification
    for (const block of codeBlocks) {
      if (block.language === 'text' || block.language === '') {
        violations.push(
          new Violation(
            this.id,
            `Code block at line ${block.location.line} should specify a language`,
            Severity.WARNING,
            block.location
          )
        );
      }
    }

    // Validate each code block based on its language
    for (const block of codeBlocks) {
      if (!this.enabledLanguages.has(block.language)) {
        continue;
      }

      // Check for incomplete code blocks
      if (!block.isComplete) {
        violations.push(
          new Violation(
            this.id,
            `Incomplete ${block.getLanguageDisplayName()} code block at line ${block.location.line} contains placeholder content`,
            Severity.WARNING,
            block.location
          )
        );
      }

      // Language-specific validation
      switch (block.language) {
        case 'javascript':
        case 'typescript':
          violations.push(...this.validateJavaScriptTypeScript(block));
          break;
        case 'python':
          violations.push(...this.validatePython(block));
          break;
        case 'go':
          violations.push(...this.validateGo(block));
          break;
        case 'bash':
          violations.push(...this.validateBash(block));
          break;
        case 'sql':
          violations.push(...this.validateSQL(block));
          break;
        case 'json':
          violations.push(...this.validateJSON(block));
          break;
        case 'yaml':
          violations.push(...this.validateYAML(block));
          break;
      }

      // Check for anti-patterns marked as examples
      if (
        block.metadata.isAntiPattern &&
        !block.context.toLowerCase().includes('bad') &&
        !block.context.toLowerCase().includes('wrong') &&
        !block.context.toLowerCase().includes('anti-pattern')
      ) {
        violations.push(
          new Violation(
            this.id,
            `Code block at line ${block.location.line} appears to be an anti-pattern but is not clearly marked as such`,
            Severity.WARNING,
            block.location
          )
        );
      }
    }

    // Check for consistent code style across blocks
    const jsBlocks = codeBlocks.filter(
      b => b.language === 'javascript' || b.language === 'typescript'
    );

    if (jsBlocks.length > 1) {
      violations.push(...this.checkConsistentStyle(jsBlocks));
    }

    return violations;
  }

  /**
   * Validate JavaScript/TypeScript code blocks
   */
  private validateJavaScriptTypeScript(block: CodeBlock): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    // Check for common bad practices
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNumber = block.location.line + i;

      // Check for console.log in production examples
      if (
        !block.metadata.isAntiPattern &&
        /console\.(log|error|warn)/.test(line)
      ) {
        violations.push(
          new Violation(
            this.id,
            `Avoid console statements in example code (line ${lineNumber})`,
            Severity.INFO,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for var usage (prefer const/let)
      if (/\bvar\s+\w+/.test(line)) {
        violations.push(
          new Violation(
            this.id,
            `Use 'const' or 'let' instead of 'var' (line ${lineNumber})`,
            this.strictMode ? Severity.ERROR : Severity.WARNING,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for == instead of ===
      if (/[^=!]==[^=]/.test(line) && !line.includes('null')) {
        violations.push(
          new Violation(
            this.id,
            `Use '===' instead of '==' for strict equality (line ${lineNumber})`,
            Severity.WARNING,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for async without error handling
      if (/async\s+function|\basync\s*\(/.test(line)) {
        // Check if there's try-catch in the function
        const functionEnd = this.findFunctionEnd(lines, i);
        const functionBody = lines.slice(i, functionEnd + 1).join('\n');
        if (!functionBody.includes('try') && !functionBody.includes('catch')) {
          violations.push(
            new Violation(
              this.id,
              `Async function should include error handling (line ${lineNumber})`,
              Severity.WARNING,
              new Location(lineNumber, 1)
            )
          );
        }
      }

      // Check for missing semicolons (if in strict mode)
      if (
        this.strictMode &&
        this.shouldHaveSemicolon(line) &&
        !line.trim().endsWith(';')
      ) {
        violations.push(
          new Violation(
            this.id,
            `Missing semicolon (line ${lineNumber})`,
            Severity.INFO,
            new Location(lineNumber, line.length)
          )
        );
      }
    }

    // Check for missing imports when using external dependencies
    if (this.usesExternalDependencies(block) && !block.hasImports) {
      violations.push(
        new Violation(
          this.id,
          `Code block uses external dependencies but doesn't show imports`,
          Severity.WARNING,
          block.location
        )
      );
    }

    return violations;
  }

  /**
   * Validate Python code blocks
   */
  private validatePython(block: CodeBlock): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNumber = block.location.line + i;

      // Check for print statements in non-example code
      if (!block.metadata.isExample && /\bprint\s*\(/.test(line)) {
        violations.push(
          new Violation(
            this.id,
            `Consider using logging instead of print() (line ${lineNumber})`,
            Severity.INFO,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for bare except clauses
      if (/except\s*:/.test(line)) {
        violations.push(
          new Violation(
            this.id,
            `Avoid bare 'except:' clauses, specify exception type (line ${lineNumber})`,
            Severity.WARNING,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for type hints in function definitions
      if (/def\s+\w+\s*\([^)]*\)\s*:/.test(line) && !line.includes('->')) {
        violations.push(
          new Violation(
            this.id,
            `Consider adding type hints to function (line ${lineNumber})`,
            Severity.INFO,
            new Location(lineNumber, 1)
          )
        );
      }
    }

    return violations;
  }

  /**
   * Validate Go code blocks
   */
  private validateGo(block: CodeBlock): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNumber = block.location.line + i;

      // Check for error handling
      if (/err\s*:=/.test(line)) {
        // Check if error is handled in next few lines
        const nextLines = lines.slice(i + 1, i + 5).join('\n');
        if (!nextLines.includes('if err != nil')) {
          violations.push(
            new Violation(
              this.id,
              `Error not handled after assignment (line ${lineNumber})`,
              Severity.ERROR,
              new Location(lineNumber, 1)
            )
          );
        }
      }

      // Check for panic in example code
      if (!block.metadata.isAntiPattern && /\bpanic\s*\(/.test(line)) {
        violations.push(
          new Violation(
            this.id,
            `Avoid using panic() in example code (line ${lineNumber})`,
            Severity.WARNING,
            new Location(lineNumber, 1)
          )
        );
      }
    }

    return violations;
  }

  /**
   * Validate Bash/Shell code blocks
   */
  private validateBash(block: CodeBlock): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNumber = block.location.line + i;

      // Check for unquoted variables
      if (
        /\$\w+(?!["\w])/.test(line) &&
        !line.includes('$@') &&
        !line.includes('$*')
      ) {
        violations.push(
          new Violation(
            this.id,
            `Quote variables to prevent word splitting (line ${lineNumber})`,
            Severity.WARNING,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for rm -rf without safeguards
      if (/rm\s+-rf/.test(line) && !block.metadata.isAntiPattern) {
        violations.push(
          new Violation(
            this.id,
            `Dangerous 'rm -rf' command in example (line ${lineNumber})`,
            Severity.ERROR,
            new Location(lineNumber, 1)
          )
        );
      }

      // Check for missing error handling
      if (/^\s*cd\s+/.test(line) && !lines[i + 1]?.includes('||')) {
        violations.push(
          new Violation(
            this.id,
            `Check for cd command success (line ${lineNumber})`,
            Severity.INFO,
            new Location(lineNumber, 1)
          )
        );
      }
    }

    return violations;
  }

  /**
   * Validate SQL code blocks
   */
  private validateSQL(block: CodeBlock): Violation[] {
    const violations: Violation[] = [];
    const content = block.content.toUpperCase();

    // Check for SELECT * in examples
    if (!block.metadata.isAntiPattern && content.includes('SELECT *')) {
      violations.push(
        new Violation(
          this.id,
          `Avoid SELECT * in examples, specify columns explicitly`,
          Severity.WARNING,
          block.location
        )
      );
    }

    // Check for potential SQL injection patterns
    if (/\$\{.*\}/.test(block.content) || /\+\s*["']/.test(block.content)) {
      violations.push(
        new Violation(
          this.id,
          `Potential SQL injection vulnerability - use parameterized queries`,
          Severity.ERROR,
          block.location
        )
      );
    }

    return violations;
  }

  /**
   * Validate JSON code blocks
   */
  private validateJSON(block: CodeBlock): Violation[] {
    const violations: Violation[] = [];

    try {
      JSON.parse(block.content);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Invalid JSON';
      violations.push(
        new Violation(
          this.id,
          `Invalid JSON syntax: ${errorMessage}`,
          Severity.ERROR,
          block.location
        )
      );
    }

    return violations;
  }

  /**
   * Validate YAML code blocks
   */
  private validateYAML(block: CodeBlock): Violation[] {
    const violations: Violation[] = [];
    const lines = block.getLines();

    // Basic YAML validation
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNumber = block.location.line + i;

      // Check for tabs (YAML requires spaces)
      if (line.includes('\t')) {
        violations.push(
          new Violation(
            this.id,
            `YAML files should use spaces, not tabs (line ${lineNumber})`,
            Severity.ERROR,
            new Location(lineNumber, 1)
          )
        );
      }
    }

    return violations;
  }

  /**
   * Check for consistent code style across blocks
   */
  private checkConsistentStyle(blocks: CodeBlock[]): Violation[] {
    const violations: Violation[] = [];

    // Check for consistent semicolon usage
    let withSemicolons = 0;
    let withoutSemicolons = 0;

    for (const block of blocks) {
      const hasSemicolons = block.content.includes(';');
      if (hasSemicolons) {
        withSemicolons++;
      } else {
        withoutSemicolons++;
      }
    }

    if (withSemicolons > 0 && withoutSemicolons > 0) {
      violations.push(
        new Violation(
          this.id,
          'Inconsistent semicolon usage across JavaScript/TypeScript code blocks',
          Severity.INFO,
          new Location(1, 1)
        )
      );
    }

    return violations;
  }

  /**
   * Helper: Find the end of a function
   */
  private findFunctionEnd(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let inFunction = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]!;

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inFunction = true;
        } else if (char === '}') {
          braceCount--;
          if (inFunction && braceCount === 0) {
            return i;
          }
        }
      }
    }

    return lines.length - 1;
  }

  /**
   * Helper: Check if a line should have a semicolon
   */
  private shouldHaveSemicolon(line: string): boolean {
    const trimmed = line.trim();

    // Skip empty lines, comments, and block statements
    if (
      !trimmed ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.endsWith('{') ||
      trimmed.endsWith('}') ||
      trimmed.startsWith('if') ||
      trimmed.startsWith('for') ||
      trimmed.startsWith('while') ||
      trimmed.startsWith('function') ||
      trimmed.startsWith('class') ||
      trimmed.startsWith('interface')
    ) {
      return false;
    }

    // Check if it's a statement that should end with semicolon
    return /^(const|let|var|return|throw|import|export)\s+/.test(trimmed);
  }

  /**
   * Helper: Check if code uses external dependencies
   */
  private usesExternalDependencies(block: CodeBlock): boolean {
    const commonLibraries = [
      'axios',
      'lodash',
      'express',
      'react',
      'vue',
      'angular',
      'moment',
      'date-fns',
      'rxjs',
      'redux',
      'mongoose',
    ];

    for (const lib of commonLibraries) {
      if (block.content.includes(lib)) {
        return true;
      }
    }

    return false;
  }
}

export interface CodeBlockRuleOptions {
  /** Languages to validate */
  languages?: string[];
  /** Enable strict mode checks */
  strict?: boolean;
}
