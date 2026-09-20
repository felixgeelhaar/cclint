import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

const AT_START = new Location(1, 1);

/** Matches bare @path imports (same shape as ImportSyntaxRule). */
const IMPORT_PATTERN = /@([\w\-~/.]+)/g;

/**
 * Warns that `@path` imports still enter the context window at session start.
 *
 * @remarks
 * Anthropic's memory docs: splitting into imports helps organization but does
 * **not** reduce context — imported files load at launch. This rule surfaces
 * that cost when a project instruction file pulls in many or large imports.
 */
export class ImportContextCostRule implements Rule {
  public readonly id = 'import-context-cost';
  public readonly description =
    'Warns that @imports expand into context at launch and do not reduce token cost';

  /** Soft threshold: more than this many unique imports → WARNING. */
  private readonly softImportCount: number;

  constructor(options: { softImportCount?: number } = {}) {
    this.softImportCount = options.softImportCount ?? 5;
  }

  public appliesTo(file: ContextFile): boolean {
    return file.isProjectInstructionFile();
  }

  public lint(file: ContextFile): Violation[] {
    if (!this.appliesTo(file)) {
      return [];
    }

    const imports = this.collectImports(file);
    if (imports.length === 0) {
      return [];
    }

    const violations: Violation[] = [];

    violations.push(
      new Violation(
        this.id,
        `@imports expand into the context window at session start — they organize files but do not save tokens. Prefer .claude/rules/ (path-scoped) or skills for content that should not load every session.`,
        Severity.INFO,
        AT_START
      )
    );

    if (imports.length >= this.softImportCount) {
      violations.push(
        new Violation(
          this.id,
          `File declares ${imports.length} @imports (threshold: ${this.softImportCount}). Large import sets inflate every session — trim, or move path-specific detail into .claude/rules/.`,
          Severity.WARNING,
          AT_START
        )
      );
    }

    return violations;
  }

  private collectImports(file: ContextFile): string[] {
    const found = new Set<string>();
    let inFence = false;

    for (const line of file.lines) {
      if (line.trimStart().startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence) {
        continue;
      }

      IMPORT_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = IMPORT_PATTERN.exec(line)) !== null) {
        const raw = match[1];
        if (raw) {
          found.add(raw);
        }
      }
    }

    return [...found];
  }
}
