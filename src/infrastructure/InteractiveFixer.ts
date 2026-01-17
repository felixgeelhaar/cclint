import * as readline from 'readline';
import type { Fix } from '../domain/AutoFix.js';
import type { Violation } from '../domain/Violation.js';
import type { CustomRule } from '../domain/CustomRule.js';
import { AutoFixer } from './AutoFixer.js';

/**
 * User action choices for interactive fixing
 */
export type FixAction = 'yes' | 'no' | 'all' | 'quit';

/**
 * Result of an interactive fix session
 */
export interface InteractiveFixResult {
  /** Whether any fixes were applied */
  fixed: boolean;
  /** Updated content after fixes */
  content: string;
  /** Number of fixes applied */
  appliedCount: number;
  /** Number of fixes skipped */
  skippedCount: number;
  /** Whether the session was quit early */
  quitEarly: boolean;
}

/**
 * Options for interactive fixing
 */
export interface InteractiveFixOptions {
  /** Custom prompt function (for testing) */
  promptFn?: (question: string) => Promise<string>;
  /** Custom output function (for testing) */
  outputFn?: (message: string) => void;
  /** Number of context lines to show in diff */
  contextLines?: number;
}

/**
 * Interactive fixer that prompts user for each fix.
 */
export class InteractiveFixer {
  private promptFn: (question: string) => Promise<string>;
  private outputFn: (message: string) => void;
  private contextLines: number;

  constructor(options: InteractiveFixOptions = {}) {
    this.promptFn = options.promptFn ?? this.createDefaultPrompt();
    this.outputFn = options.outputFn ?? console.log;
    this.contextLines = options.contextLines ?? 3;
  }

  /**
   * Run interactive fix session for violations
   */
  async fix(
    content: string,
    violations: Violation[],
    customRules: CustomRule[] = []
  ): Promise<InteractiveFixResult> {
    const fixes = AutoFixer.generateFixesForViolations(
      violations,
      content,
      customRules
    );

    if (fixes.length === 0) {
      this.outputFn('No fixes available.');
      return {
        fixed: false,
        content,
        appliedCount: 0,
        skippedCount: 0,
        quitEarly: false,
      };
    }

    // Sort fixes by position (start from beginning for display)
    const sortedFixes = [...fixes].sort((a, b) => {
      if (a.range.start.line !== b.range.start.line) {
        return a.range.start.line - b.range.start.line;
      }
      return a.range.start.column - b.range.start.column;
    });

    this.outputFn(`\n📝 Found ${sortedFixes.length} fixable issue(s)\n`);

    let currentContent = content;
    let appliedCount = 0;
    let skippedCount = 0;
    let applyAll = false;
    let quitEarly = false;

    for (let i = 0; i < sortedFixes.length; i++) {
      const fix = sortedFixes[i];
      if (!fix) continue;

      // Recalculate fix position based on current content
      const adjustedFix = this.adjustFixForContent(
        fix,
        content,
        currentContent
      );
      if (!adjustedFix) {
        skippedCount++;
        continue;
      }

      if (!applyAll) {
        this.showFixPreview(
          currentContent,
          adjustedFix,
          i + 1,
          sortedFixes.length
        );
        const action = await this.promptForAction();

        switch (action) {
          case 'yes':
            break;
          case 'no':
            skippedCount++;
            this.outputFn('⏭️  Skipped\n');
            continue;
          case 'all':
            applyAll = true;
            break;
          case 'quit':
            quitEarly = true;
            skippedCount += sortedFixes.length - i;
            this.outputFn('\n🛑 Quit interactive mode\n');
            break;
        }

        if (quitEarly) break;
      }

      // Apply the fix
      const result = AutoFixer.applyFixes(currentContent, [adjustedFix]);
      if (result.fixed) {
        currentContent = result.content;
        appliedCount++;
        this.outputFn('✅ Applied\n');
      } else {
        skippedCount++;
        this.outputFn('⚠️  Could not apply fix\n');
      }
    }

    this.showSummary(appliedCount, skippedCount, quitEarly);

    return {
      fixed: appliedCount > 0,
      content: currentContent,
      appliedCount,
      skippedCount,
      quitEarly,
    };
  }

  /**
   * Show a preview of the fix with diff
   */
  private showFixPreview(
    content: string,
    fix: Fix,
    current: number,
    total: number
  ): void {
    const lines = content.split('\n');
    const startLine = fix.range.start.line;
    const endLine = fix.range.end.line;

    this.outputFn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.outputFn(`Fix ${current}/${total}: ${fix.description}`);
    this.outputFn(
      `Location: Line ${startLine}${endLine !== startLine ? `-${endLine}` : ''}`
    );
    this.outputFn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Calculate context range
    const contextStart = Math.max(0, startLine - 1 - this.contextLines);
    const contextEnd = Math.min(lines.length, endLine + this.contextLines);

    // Show before context
    for (let i = contextStart; i < startLine - 1; i++) {
      this.outputFn(`  ${this.padLineNumber(i + 1)} │ ${lines[i]}`);
    }

    // Show affected lines (to be removed)
    for (let i = startLine - 1; i < endLine; i++) {
      const line = lines[i] ?? '';
      this.outputFn(
        `\x1b[31m- ${this.padLineNumber(i + 1)} │ ${this.visualizeWhitespace(line)}\x1b[0m`
      );
    }

    // Show replacement (to be added)
    if (fix.text) {
      const newLines = fix.text.split('\n');
      newLines.forEach((newLine, idx) => {
        const lineNum = idx === 0 ? startLine : '+';
        this.outputFn(
          `\x1b[32m+ ${this.padLineNumber(lineNum)} │ ${this.visualizeWhitespace(newLine)}\x1b[0m`
        );
      });
    }

    // Show after context
    for (let i = endLine; i < contextEnd; i++) {
      this.outputFn(`  ${this.padLineNumber(i + 1)} │ ${lines[i]}`);
    }

    this.outputFn('');
  }

  /**
   * Prompt user for action
   */
  private async promptForAction(): Promise<FixAction> {
    const response = await this.promptFn(
      'Apply this fix? [y]es / [n]o / [a]ll / [q]uit: '
    );

    const normalized = response.toLowerCase().trim();

    switch (normalized) {
      case 'y':
      case 'yes':
        return 'yes';
      case 'n':
      case 'no':
        return 'no';
      case 'a':
      case 'all':
        return 'all';
      case 'q':
      case 'quit':
        return 'quit';
      default:
        this.outputFn('Invalid choice. Please enter y, n, a, or q.');
        return this.promptForAction();
    }
  }

  /**
   * Show summary of the fix session
   */
  private showSummary(
    applied: number,
    skipped: number,
    quitEarly: boolean
  ): void {
    this.outputFn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.outputFn('Summary:');
    this.outputFn(`  ✅ Applied: ${applied}`);
    this.outputFn(`  ⏭️  Skipped: ${skipped}`);
    if (quitEarly) {
      this.outputFn('  🛑 Session ended early');
    }
    this.outputFn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  /**
   * Pad line number for consistent display
   */
  private padLineNumber(num: number | string): string {
    return String(num).padStart(4, ' ');
  }

  /**
   * Visualize whitespace characters for clarity
   */
  private visualizeWhitespace(line: string): string {
    // Show trailing spaces as dots
    return line.replace(/( +)$/, match => '·'.repeat(match.length));
  }

  /**
   * Adjust fix position for content changes
   */
  private adjustFixForContent(
    fix: Fix,
    originalContent: string,
    currentContent: string
  ): Fix | null {
    // Simple implementation: if content hasn't changed, return as-is
    if (originalContent === currentContent) {
      return fix;
    }

    // For now, return the fix as-is
    // A more sophisticated implementation would track line changes
    return fix;
  }

  /**
   * Create default readline prompt
   */
  private createDefaultPrompt(): (question: string) => Promise<string> {
    return (question: string) => {
      return new Promise(resolve => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        rl.question(question, answer => {
          rl.close();
          resolve(answer);
        });
      });
    };
  }
}
