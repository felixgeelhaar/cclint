import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';

/**
 * Rule that validates CLAUDE.md hierarchy in monorepos
 *
 * @remarks
 * Validates that multiple CLAUDE.md files:
 * - Don't create conflicting instructions
 * - Use proper hierarchy (parent/child relationships)
 * - Consider using imports instead of duplication
 * - Follow Anthropic's monorepo best practices
 *
 * @see {@link https://www.anthropic.com/engineering/claude-code-best-practices | Claude Code Best Practices}
 *
 * @category Rules
 */
export class MonorepoHierarchyRule implements Rule {
  public readonly id = 'monorepo-hierarchy';
  public readonly description =
    'Validates CLAUDE.md file hierarchy in monorepos';

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    // Only validate actual CLAUDE.md files
    const filename = basename(file.path);
    if (filename !== 'CLAUDE.md' && filename !== 'CLAUDE.local.md') {
      return violations;
    }

    // Find other CLAUDE.md files in hierarchy
    const hierarchyFiles = this.findHierarchyFiles(file.path);

    if (hierarchyFiles.parent.length > 0) {
      violations.push(
        ...this.checkParentConflicts(file, hierarchyFiles.parent)
      );
    }

    if (hierarchyFiles.children.length > 0) {
      violations.push(
        ...this.checkChildrenOrganization(file, hierarchyFiles.children)
      );
    }

    if (hierarchyFiles.siblings.length > 0) {
      violations.push(
        ...this.checkSiblingDuplication(file, hierarchyFiles.siblings)
      );
    }

    // Provide guidance for monorepo setup
    if (
      hierarchyFiles.parent.length > 0 ||
      hierarchyFiles.children.length > 0
    ) {
      violations.push(...this.provideMonorepoGuidance(hierarchyFiles));
    }

    return violations;
  }

  /**
   * Find CLAUDE.md files in hierarchy
   */
  private findHierarchyFiles(currentPath: string): HierarchyFiles {
    const currentDir = dirname(currentPath);
    const parent: string[] = [];
    const children: string[] = [];
    const siblings: string[] = [];

    // Search up the directory tree for parent CLAUDE.md files
    let searchDir = dirname(currentDir);
    while (searchDir !== dirname(searchDir)) {
      const claudeFiles = [
        join(searchDir, 'CLAUDE.md'),
        join(searchDir, '.claude', 'CLAUDE.md'),
      ];

      for (const claudeFile of claudeFiles) {
        if (existsSync(claudeFile) && claudeFile !== currentPath) {
          parent.push(claudeFile);
        }
      }

      searchDir = dirname(searchDir);
    }

    // Search down for child CLAUDE.md files
    this.searchChildren(currentDir, children, currentPath);

    // Search for siblings
    const parentDir = dirname(currentDir);
    if (existsSync(parentDir)) {
      try {
        const entries = readdirSync(parentDir);
        for (const entry of entries) {
          const entryPath = join(parentDir, entry);
          if (
            statSync(entryPath).isDirectory() &&
            entry !== basename(currentDir)
          ) {
            const siblingClaude = join(entryPath, 'CLAUDE.md');
            if (existsSync(siblingClaude)) {
              siblings.push(siblingClaude);
            }
          }
        }
      } catch (error) {
        // Ignore read errors
      }
    }

    return { parent, children, siblings };
  }

  /**
   * Recursively search for child CLAUDE.md files
   */
  private searchChildren(
    dir: string,
    results: string[],
    currentPath: string,
    depth: number = 0
  ): void {
    if (depth > 3) return; // Limit search depth

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const entryPath = join(dir, entry);
        const stat = statSync(entryPath);

        if (stat.isDirectory()) {
          const claudeFile = join(entryPath, 'CLAUDE.md');
          if (existsSync(claudeFile) && claudeFile !== currentPath) {
            results.push(claudeFile);
          }
          this.searchChildren(entryPath, results, currentPath, depth + 1);
        }
      }
    } catch (error) {
      // Ignore read errors
    }
  }

  /**
   * Check for conflicts with parent CLAUDE.md files
   */
  private checkParentConflicts(
    file: ContextFile,
    parentFiles: string[]
  ): Violation[] {
    const violations: Violation[] = [];

    // Check for potentially conflicting instructions
    const currentInstructions = this.extractInstructions(file);

    for (const parentPath of parentFiles) {
      try {
        const parentFile = ContextFile.fromFile(parentPath);
        const parentInstructions = this.extractInstructions(parentFile);

        // Check for topic overlap
        const overlap = this.findTopicOverlap(
          currentInstructions,
          parentInstructions
        );

        if (overlap.length > 0) {
          violations.push(
            new Violation(
              this.id,
              `Parent CLAUDE.md at "${parentPath}" also defines: ${overlap.join(', ')}. Consider using imports to avoid duplication: @${parentPath}`,
              Severity.WARNING,
              new Location(1, 1)
            )
          );
        }
      } catch (error) {
        // Ignore read errors
      }
    }

    return violations;
  }

  /**
   * Check children organization
   */
  private checkChildrenOrganization(
    _file: ContextFile,
    childFiles: string[]
  ): Violation[] {
    const violations: Violation[] = [];

    if (childFiles.length > 3) {
      violations.push(
        new Violation(
          this.id,
          `Found ${childFiles.length} child CLAUDE.md files. Consider consolidating common instructions in parent and using imports`,
          Severity.INFO,
          new Location(1, 1)
        )
      );
    }

    return violations;
  }

  /**
   * Check for duplication across siblings
   */
  private checkSiblingDuplication(
    file: ContextFile,
    siblingFiles: string[]
  ): Violation[] {
    const violations: Violation[] = [];
    const currentInstructions = this.extractInstructions(file);

    for (const siblingPath of siblingFiles) {
      try {
        const siblingFile = ContextFile.fromFile(siblingPath);
        const siblingInstructions = this.extractInstructions(siblingFile);

        const overlap = this.findTopicOverlap(
          currentInstructions,
          siblingInstructions
        );

        if (overlap.length >= 3) {
          violations.push(
            new Violation(
              this.id,
              `Sibling CLAUDE.md at "${siblingPath}" has ${overlap.length} overlapping topics. Move shared instructions to parent CLAUDE.md`,
              Severity.WARNING,
              new Location(1, 1)
            )
          );
        }
      } catch (error) {
        // Ignore read errors
      }
    }

    return violations;
  }

  /**
   * Provide monorepo guidance
   */
  private provideMonorepoGuidance(hierarchy: HierarchyFiles): Violation[] {
    const violations: Violation[] = [];

    if (hierarchy.parent.length === 0 && hierarchy.children.length > 0) {
      violations.push(
        new Violation(
          this.id,
          'Monorepo detected. Consider creating a parent CLAUDE.md for shared instructions that apply to all packages',
          Severity.INFO,
          new Location(1, 1)
        )
      );
    }

    return violations;
  }

  /**
   * Extract instruction topics from file
   */
  private extractInstructions(file: ContextFile): string[] {
    const instructions: string[] = [];
    const headerRegex = /^#{2,3}\s+(.+)$/;

    for (const line of file.lines) {
      const match = line.match(headerRegex);
      if (match) {
        const topic = match[1]?.toLowerCase().trim() ?? '';
        if (topic) {
          instructions.push(topic);
        }
      }
    }

    return instructions;
  }

  /**
   * Find overlapping topics between two sets of instructions
   */
  private findTopicOverlap(topics1: string[], topics2: string[]): string[] {
    const overlap: string[] = [];

    for (const topic1 of topics1) {
      for (const topic2 of topics2) {
        // Simple similarity check - could be enhanced
        if (
          topic1 === topic2 ||
          topic1.includes(topic2) ||
          topic2.includes(topic1)
        ) {
          if (!overlap.includes(topic1)) {
            overlap.push(topic1);
          }
        }
      }
    }

    return overlap;
  }
}

interface HierarchyFiles {
  parent: string[];
  children: string[];
  siblings: string[];
}
