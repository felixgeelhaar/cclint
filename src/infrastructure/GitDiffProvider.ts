import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Represents a changed line range in a file
 */
export interface ChangedRange {
  startLine: number;
  endLine: number;
}

/**
 * Information about a file's git diff status
 */
export interface FileDiffInfo {
  /** File path relative to repository root */
  filePath: string;
  /** Whether the file is new (untracked or newly added) */
  isNew: boolean;
  /** Whether the file was deleted */
  isDeleted: boolean;
  /** Changed line ranges (for modified files) */
  changedRanges: ChangedRange[];
}

/**
 * Options for diff detection
 */
export interface DiffOptions {
  /** Compare against a specific git ref (branch, commit, tag) */
  ref?: string;
  /** Include staged files only */
  staged?: boolean;
  /** Root directory to search from */
  rootDir?: string;
}

/**
 * Provides git diff information for linting only changed files/lines.
 */
export class GitDiffProvider {
  private rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir ?? process.cwd();
  }

  /**
   * Check if the directory is a git repository
   */
  isGitRepository(): boolean {
    return existsSync(join(this.rootDir, '.git'));
  }

  /**
   * Get list of changed CLAUDE.md files
   */
  getChangedClaudeMdFiles(options: DiffOptions = {}): string[] {
    if (!this.isGitRepository()) {
      return [];
    }

    try {
      const ref = options.ref ?? 'HEAD';
      let command: string;

      if (options.staged) {
        // Get staged files
        command = 'git diff --cached --name-only --diff-filter=ACM';
      } else {
        // Get files changed since ref
        command = `git diff --name-only --diff-filter=ACM ${ref}`;
      }

      const output = this.execGit(command);
      const files = output
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0);

      // Filter to only CLAUDE.md files
      return files.filter(f => f.endsWith('CLAUDE.md'));
    } catch {
      return [];
    }
  }

  /**
   * Get detailed diff information for a file
   */
  getFileDiffInfo(filePath: string, options: DiffOptions = {}): FileDiffInfo {
    const info: FileDiffInfo = {
      filePath,
      isNew: false,
      isDeleted: false,
      changedRanges: [],
    };

    if (!this.isGitRepository()) {
      return info;
    }

    try {
      const ref = options.ref ?? 'HEAD';
      let command: string;

      if (options.staged) {
        command = `git diff --cached --unified=0 -- "${filePath}"`;
      } else {
        command = `git diff --unified=0 ${ref} -- "${filePath}"`;
      }

      const output = this.execGit(command);

      // Check if file is new
      if (output.includes('new file mode')) {
        info.isNew = true;
        return info;
      }

      // Check if file is deleted
      if (output.includes('deleted file mode')) {
        info.isDeleted = true;
        return info;
      }

      // Parse hunk headers to get changed line ranges
      // Format: @@ -start,count +start,count @@
      const hunkRegex = /@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/g;
      let match;

      while ((match = hunkRegex.exec(output)) !== null) {
        const startLine = parseInt(match[2] ?? '1', 10);
        const count = parseInt(match[3] ?? '1', 10);
        const endLine = startLine + count - 1;

        if (count > 0) {
          info.changedRanges.push({
            startLine,
            endLine: Math.max(startLine, endLine),
          });
        }
      }

      return info;
    } catch {
      return info;
    }
  }

  /**
   * Check if a line number is within changed ranges
   */
  isLineChanged(line: number, diffInfo: FileDiffInfo): boolean {
    // New files have all lines "changed"
    if (diffInfo.isNew) {
      return true;
    }

    // Deleted files have no lines
    if (diffInfo.isDeleted) {
      return false;
    }

    // Check if line is in any changed range
    return diffInfo.changedRanges.some(
      range => line >= range.startLine && line <= range.endLine
    );
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): string | null {
    if (!this.isGitRepository()) {
      return null;
    }

    try {
      const output = this.execGit('git rev-parse --abbrev-ref HEAD');
      return output.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Get the merge base with a target branch
   */
  getMergeBase(targetBranch: string = 'main'): string | null {
    if (!this.isGitRepository()) {
      return null;
    }

    try {
      // Try with the specified branch, fall back to alternatives
      const branches = [targetBranch, 'main', 'master'];

      for (const branch of branches) {
        try {
          const output = this.execGit(`git merge-base HEAD ${branch}`);
          const sha = output.trim();
          if (sha) return sha;
        } catch {
          continue;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get untracked CLAUDE.md files
   */
  getUntrackedClaudeMdFiles(): string[] {
    if (!this.isGitRepository()) {
      return [];
    }

    try {
      const output = this.execGit('git ls-files --others --exclude-standard');
      const files = output
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0);

      return files.filter(f => f.endsWith('CLAUDE.md'));
    } catch {
      return [];
    }
  }

  /**
   * Execute a git command and return output
   */
  private execGit(command: string): string {
    return execSync(command, {
      cwd: this.rootDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }
}
