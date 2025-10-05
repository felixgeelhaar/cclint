import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

/**
 * Rule that validates CLAUDE.md content organization and quality
 *
 * @remarks
 * Enforces Anthropic's best practices for content organization:
 * - Be specific: "Use 2-space indentation" vs "Format code properly"
 * - Use structure: Bullet points and markdown headings
 * - Clear instructions: Avoid vague language
 * - Emphasis for critical items: IMPORTANT, YOU MUST, etc.
 *
 * This rule focuses on content quality rather than technology-specific patterns.
 *
 * @see {@link https://docs.claude.com/en/docs/claude-code/memory#memory-best-practices | Memory best practices}
 *
 * @category Rules
 */
export class ContentOrganizationRule implements Rule {
  public readonly id = 'content-organization';
  public readonly description =
    'Validates content organization and specificity following Anthropic best practices';

  private readonly vaguePhrases = new Set([
    'properly',
    'correctly',
    'appropriately',
    'well',
    'good',
    'bad',
    'better',
    'best',
    'nice',
    'clean',
    'neat',
  ]);

  private readonly emphasisMarkers = new Set([
    'IMPORTANT',
    'YOU MUST',
    'REQUIRED',
    'CRITICAL',
    'ALWAYS',
    'NEVER',
  ]);

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    this.checkHeadingHierarchy(file, violations);
    this.checkBulletPointUsage(file, violations);
    this.checkVagueLanguage(file, violations);
    this.checkEmphasisUsage(file, violations);
    this.checkEmphasisOveruse(file, violations);
    this.checkSpecificity(file, violations);

    return violations;
  }

  /**
   * Check heading hierarchy (h1 → h2 → h3, no skipping levels)
   */
  private checkHeadingHierarchy(
    file: ContextFile,
    violations: Violation[]
  ): void {
    let previousLevel = 0;
    let lineNumber = 0;

    for (const line of file.lines) {
      lineNumber++;
      const match = line.match(/^(#{1,6})\s/);

      if (match) {
        const hashes = match[1];
        if (!hashes) continue;

        const currentLevel = hashes.length;

        // Check if we're skipping heading levels (e.g., h1 → h3)
        if (previousLevel > 0 && currentLevel > previousLevel + 1) {
          violations.push(
            new Violation(
              this.id,
              `Heading hierarchy skips from h${previousLevel} to h${currentLevel}. Use h${previousLevel + 1} instead.`,
              Severity.WARNING,
              new Location(lineNumber, 1)
            )
          );
        }

        previousLevel = currentLevel;
      }
    }
  }

  /**
   * Check that sections use bullet points for organization
   */
  private checkBulletPointUsage(
    file: ContextFile,
    violations: Violation[]
  ): void {
    let currentSection = '';
    let sectionStart = 0;
    let hasBullets = false;
    let contentLines = 0;

    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';

      // Track section headings
      const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headerMatch) {
        // Check previous section
        if (
          currentSection &&
          contentLines > 3 &&
          !hasBullets &&
          !this.isCodeBlockSection(file.lines, sectionStart, i)
        ) {
          violations.push(
            new Violation(
              this.id,
              `Section "${currentSection}" has ${contentLines} lines but no bullet points. Use bullet points for better organization.`,
              Severity.INFO,
              new Location(sectionStart, 1)
            )
          );
        }

        // Start new section
        currentSection = headerMatch[2] ?? '';
        sectionStart = i + 1;
        hasBullets = false;
        contentLines = 0;
        continue;
      }

      // Check for bullet points
      if (/^\s*[-*+]\s/.test(line)) {
        hasBullets = true;
      }

      // Count non-empty lines
      if (line.trim() !== '') {
        contentLines++;
      }
    }
  }

  /**
   * Detect vague language that should be more specific
   */
  private checkVagueLanguage(file: ContextFile, violations: Violation[]): void {
    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';

      // Skip code blocks
      if (line.trim().startsWith('```')) {
        continue;
      }

      for (const vague of this.vaguePhrases) {
        const regex = new RegExp(`\\b${vague}\\b`, 'i');
        if (regex.test(line)) {
          const suggestion = this.getSuggestionForVagueTerm(vague, line);
          violations.push(
            new Violation(
              this.id,
              `Vague term "${vague}" detected. ${suggestion}`,
              Severity.INFO,
              new Location(
                i + 1,
                line.toLowerCase().indexOf(vague.toLowerCase()) + 1
              )
            )
          );
        }
      }
    }
  }

  /**
   * Check for proper use of emphasis markers
   */
  private checkEmphasisUsage(file: ContextFile, violations: Violation[]): void {
    let hasEmphasis = false;
    const criticalKeywords = [
      'must',
      'always',
      'never',
      'required',
      'critical',
    ];

    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';

      // Check if line has emphasis markers
      for (const marker of this.emphasisMarkers) {
        if (line.includes(marker)) {
          hasEmphasis = true;
          break;
        }
      }

      // Check if line contains critical keywords without emphasis
      const lowerLine = line.toLowerCase();
      for (const keyword of criticalKeywords) {
        if (lowerLine.includes(keyword)) {
          // Check if it's already emphasized (uppercase or bold)
          const isEmphasized =
            line.includes(keyword.toUpperCase()) ||
            line.includes(`**${keyword}**`) ||
            line.includes(`*${keyword}*`);

          if (!isEmphasized && !line.trim().startsWith('#')) {
            violations.push(
              new Violation(
                this.id,
                `Critical instruction contains "${keyword}" but lacks emphasis. Consider using "${keyword.toUpperCase()}" or **${keyword}** for important requirements.`,
                Severity.INFO,
                new Location(i + 1, 1)
              )
            );
          }
        }
      }
    }

    // Suggest adding emphasis if file has no emphasis markers
    if (!hasEmphasis && file.lines.length > 20) {
      violations.push(
        new Violation(
          this.id,
          'File contains no emphasis markers (IMPORTANT, YOU MUST, etc.). Consider adding emphasis to critical instructions.',
          Severity.INFO,
          new Location(1, 1)
        )
      );
    }
  }

  /**
   * Check for overuse of emphasis markers (reduces effectiveness)
   */
  private checkEmphasisOveruse(
    file: ContextFile,
    violations: Violation[]
  ): void {
    const emphasisLines: number[] = [];
    const totalLines = file.lines.length;

    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';

      // Check if line has emphasis markers
      for (const marker of this.emphasisMarkers) {
        if (line.includes(marker)) {
          emphasisLines.push(i + 1);
          break;
        }
      }
    }

    // Calculate emphasis ratio
    const emphasisRatio = emphasisLines.length / totalLines;

    // Warn if >20% of lines have emphasis
    if (emphasisRatio > 0.2) {
      violations.push(
        new Violation(
          this.id,
          `${Math.round(emphasisRatio * 100)}% of lines use emphasis markers (${emphasisLines.length}/${totalLines}). Overuse reduces effectiveness - reserve emphasis for truly critical instructions`,
          Severity.WARNING,
          new Location(1, 1)
        )
      );
    }

    // Check for consecutive emphasis (reduces impact)
    for (let i = 1; i < emphasisLines.length; i++) {
      const currentLine = emphasisLines[i] ?? 0;
      const previousLine = emphasisLines[i - 1] ?? 0;

      if (currentLine - previousLine <= 2) {
        violations.push(
          new Violation(
            this.id,
            `Consecutive lines with emphasis detected (lines ${previousLine}-${currentLine}). Space out emphasis to maintain impact`,
            Severity.INFO,
            new Location(currentLine, 1)
          )
        );
      }
    }
  }

  /**
   * Check for specific, measurable guidelines
   */
  private checkSpecificity(file: ContextFile, violations: Violation[]): void {
    const formatInstructions = [
      'format',
      'indent',
      'spacing',
      'style',
      'convention',
    ];

    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i] ?? '';
      const lowerLine = line.toLowerCase();

      for (const instruction of formatInstructions) {
        if (lowerLine.includes(instruction)) {
          // Check if it has specific measurements
          const hasSpecifics =
            /\d+/.test(line) || // Has numbers
            /spaces|tabs|characters|lines/.test(lowerLine) || // Has units
            /eslint|prettier|format/.test(lowerLine); // Has tool names

          if (!hasSpecifics && !line.trim().startsWith('#')) {
            violations.push(
              new Violation(
                this.id,
                `Instruction about "${instruction}" lacks specifics. Add measurements (e.g., "2-space", "80 characters") or tool names (e.g., "Prettier", "ESLint").`,
                Severity.INFO,
                new Location(i + 1, 1)
              )
            );
          }
        }
      }
    }
  }

  /**
   * Check if a section is primarily code blocks
   */
  private isCodeBlockSection(
    lines: string[],
    start: number,
    end: number
  ): boolean {
    let codeBlockLines = 0;
    let inCodeBlock = false;

    for (let i = start; i < end && i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
      }
      if (inCodeBlock) {
        codeBlockLines++;
      }
    }

    const totalLines = end - start;
    return codeBlockLines / totalLines > 0.5; // More than 50% code blocks
  }

  /**
   * Get suggestion for vague term based on context
   */
  private getSuggestionForVagueTerm(term: string, line: string): string {
    const lowerLine = line.toLowerCase();

    if (term === 'properly' || term === 'correctly') {
      return 'Be specific about the expected format or standard (e.g., "Use 2-space indentation" instead of "Format properly").';
    }

    if (term === 'well' || term === 'good') {
      return 'Define what "good" means with measurable criteria.';
    }

    if (term === 'bad' || term === 'wrong') {
      return "Explain why it's problematic and what the correct approach is.";
    }

    if (lowerLine.includes('format') || lowerLine.includes('style')) {
      return 'Specify the exact format or style guide (e.g., "Follow Prettier defaults" or "Use 80-character line limit").';
    }

    return 'Be more specific about expectations and requirements.';
  }
}
