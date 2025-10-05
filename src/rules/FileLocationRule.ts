import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';
import { basename, dirname } from 'path';

/**
 * Rule that validates CLAUDE.md file location and naming
 *
 * @remarks
 * Validates proper file placement according to Anthropic's hierarchy:
 * - Enterprise: /Library/Application Support/ClaudeCode/CLAUDE.md (macOS)
 * - User: ~/.claude/CLAUDE.md
 * - Project: ./CLAUDE.md or ./.claude/CLAUDE.md
 * - Local: CLAUDE.local.md (DEPRECATED - use imports instead)
 *
 * @see {@link https://docs.claude.com/en/docs/claude-code/memory#determine-memory-type | Memory types}
 *
 * @category Rules
 */
export class FileLocationRule implements Rule {
  public readonly id = 'file-location';
  public readonly description =
    'Validates CLAUDE.md file location and naming conventions';

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    const filename = basename(file.path);
    const directory = dirname(file.path);

    // Only validate files that are attempting to be Claude memory files
    const isClaudeFile =
      filename === 'CLAUDE.md' || filename === 'CLAUDE.local.md';

    if (!isClaudeFile) {
      // Skip validation for non-Claude memory files
      return violations;
    }

    // Check for deprecated CLAUDE.local.md
    if (filename === 'CLAUDE.local.md') {
      violations.push(
        new Violation(
          this.id,
          'CLAUDE.local.md is deprecated. Use imports instead: create a file like ~/.claude/my-local-preferences.md and import it with @~/.claude/my-local-preferences.md',
          Severity.WARNING,
          new Location(1, 1)
        )
      );
      return violations; // Early return for deprecated file
    }

    // Validate location recommendations
    this.checkLocationRecommendations(file, directory, violations);

    // Check for .gitignore configuration if in project
    if (this.isProjectLocation(directory)) {
      violations.push(...this.checkGitIgnoreGuidance(file));
    }

    return violations;
  }

  /**
   * Check location against Anthropic's recommendations
   */
  private checkLocationRecommendations(
    _file: ContextFile,
    directory: string,
    violations: Violation[]
  ): void {
    const isUserLocation =
      directory.includes('.claude') && directory.includes(this.getHomeDir());
    const isProjectRoot = !directory.includes('.claude');
    const isProjectClaudeDir = directory.endsWith('.claude');

    // Provide guidance based on location
    if (isUserLocation) {
      violations.push(
        new Violation(
          this.id,
          'User memory location detected (~/.claude/CLAUDE.md). This file applies to ALL projects. Consider using project-specific CLAUDE.md for project-specific instructions.',
          Severity.INFO,
          new Location(1, 1)
        )
      );
    } else if (isProjectClaudeDir) {
      violations.push(
        new Violation(
          this.id,
          'Project-specific location detected (./.claude/CLAUDE.md). This is ideal for team-shared instructions. Consider checking into git for team collaboration.',
          Severity.INFO,
          new Location(1, 1)
        )
      );
    } else if (isProjectRoot) {
      violations.push(
        new Violation(
          this.id,
          'Project root location detected (./CLAUDE.md). Consider moving to ./.claude/CLAUDE.md for better organization, or keep here if you prefer simplicity.',
          Severity.INFO,
          new Location(1, 1)
        )
      );
    }
  }

  /**
   * Check if file should be in .gitignore
   */
  private checkGitIgnoreGuidance(contextFile: ContextFile): Violation[] {
    const violations: Violation[] = [];

    // Check if file contains personal/sensitive information keywords
    const personalKeywords = [
      'personal',
      'local',
      'my ',
      'private',
      'api key',
      'token',
      'password',
      'secret',
    ];

    const hasPersonalContent = personalKeywords.some(keyword =>
      contextFile.content.toLowerCase().includes(keyword)
    );

    if (hasPersonalContent) {
      violations.push(
        new Violation(
          this.id,
          'File may contain personal information. If so, add to .gitignore or use imports from ~/.claude/ instead.',
          Severity.WARNING,
          new Location(1, 1)
        )
      );
    }

    // Check if content suggests it's team-shared
    const teamKeywords = [
      'team',
      'everyone',
      'all developers',
      'project',
      'repository',
      'codebase',
    ];

    const hasTeamContent = teamKeywords.some(keyword =>
      contextFile.content.toLowerCase().includes(keyword)
    );

    if (hasTeamContent) {
      violations.push(
        new Violation(
          this.id,
          "File contains team-shared instructions. Ensure it's committed to git for team collaboration.",
          Severity.INFO,
          new Location(1, 1)
        )
      );
    }

    return violations;
  }

  /**
   * Check if directory is a project location (not user home)
   */
  private isProjectLocation(directory: string): boolean {
    const homeDir = this.getHomeDir();
    const isInUserClaudeDir = directory.includes(`${homeDir}/.claude`);
    return !isInUserClaudeDir;
  }

  /**
   * Get home directory (cross-platform)
   */
  private getHomeDir(): string {
    return process.env['HOME'] ?? process.env['USERPROFILE'] ?? '~';
  }
}
