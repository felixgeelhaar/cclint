import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { GitDiffProvider } from '../../../src/infrastructure/GitDiffProvider.js';

vi.mock('child_process');
vi.mock('fs');

describe('GitDiffProvider', () => {
  const mockExecSync = vi.mocked(execSync);
  const mockExistsSync = vi.mocked(existsSync);

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true); // Default to git repo exists
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isGitRepository', () => {
    it('should return true when .git directory exists', () => {
      mockExistsSync.mockReturnValue(true);

      const provider = new GitDiffProvider('/test/project');
      expect(provider.isGitRepository()).toBe(true);
    });

    it('should return false when .git directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const provider = new GitDiffProvider('/test/project');
      expect(provider.isGitRepository()).toBe(false);
    });
  });

  describe('getChangedClaudeMdFiles', () => {
    it('should return changed CLAUDE.md files', () => {
      mockExecSync.mockReturnValue(
        'CLAUDE.md\npackages/api/CLAUDE.md\nREADME.md\n'
      );

      const provider = new GitDiffProvider('/test/project');
      const files = provider.getChangedClaudeMdFiles();

      expect(files).toEqual(['CLAUDE.md', 'packages/api/CLAUDE.md']);
    });

    it('should use --cached for staged files', () => {
      mockExecSync.mockReturnValue('CLAUDE.md\n');

      const provider = new GitDiffProvider('/test/project');
      provider.getChangedClaudeMdFiles({ staged: true });

      expect(mockExecSync).toHaveBeenCalledWith(
        'git diff --cached --name-only --diff-filter=ACM',
        expect.any(Object)
      );
    });

    it('should use specified ref', () => {
      mockExecSync.mockReturnValue('CLAUDE.md\n');

      const provider = new GitDiffProvider('/test/project');
      provider.getChangedClaudeMdFiles({ ref: 'main' });

      expect(mockExecSync).toHaveBeenCalledWith(
        'git diff --name-only --diff-filter=ACM main',
        expect.any(Object)
      );
    });

    it('should return empty array when not a git repo', () => {
      mockExistsSync.mockReturnValue(false);

      const provider = new GitDiffProvider('/test/project');
      const files = provider.getChangedClaudeMdFiles();

      expect(files).toEqual([]);
    });

    it('should handle errors gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('git error');
      });

      const provider = new GitDiffProvider('/test/project');
      const files = provider.getChangedClaudeMdFiles();

      expect(files).toEqual([]);
    });
  });

  describe('getFileDiffInfo', () => {
    it('should detect new files', () => {
      mockExecSync.mockReturnValue('diff --git\nnew file mode 100644\n');

      const provider = new GitDiffProvider('/test/project');
      const info = provider.getFileDiffInfo('CLAUDE.md');

      expect(info.isNew).toBe(true);
      expect(info.isDeleted).toBe(false);
    });

    it('should detect deleted files', () => {
      mockExecSync.mockReturnValue('diff --git\ndeleted file mode 100644\n');

      const provider = new GitDiffProvider('/test/project');
      const info = provider.getFileDiffInfo('CLAUDE.md');

      expect(info.isNew).toBe(false);
      expect(info.isDeleted).toBe(true);
    });

    it('should parse hunk headers for changed ranges', () => {
      mockExecSync.mockReturnValue(
        'diff --git\n@@ -1,5 +1,8 @@\n@@ -10,3 +12,5 @@\n'
      );

      const provider = new GitDiffProvider('/test/project');
      const info = provider.getFileDiffInfo('CLAUDE.md');

      expect(info.changedRanges).toEqual([
        { startLine: 1, endLine: 8 },
        { startLine: 12, endLine: 16 },
      ]);
    });

    it('should handle single-line changes', () => {
      mockExecSync.mockReturnValue('diff --git\n@@ -5 +5 @@\n');

      const provider = new GitDiffProvider('/test/project');
      const info = provider.getFileDiffInfo('CLAUDE.md');

      expect(info.changedRanges).toEqual([{ startLine: 5, endLine: 5 }]);
    });

    it('should return empty info when not a git repo', () => {
      mockExistsSync.mockReturnValue(false);

      const provider = new GitDiffProvider('/test/project');
      const info = provider.getFileDiffInfo('CLAUDE.md');

      expect(info.filePath).toBe('CLAUDE.md');
      expect(info.isNew).toBe(false);
      expect(info.changedRanges).toEqual([]);
    });
  });

  describe('isLineChanged', () => {
    it('should return true for new files', () => {
      const provider = new GitDiffProvider('/test/project');
      const diffInfo = {
        filePath: 'CLAUDE.md',
        isNew: true,
        isDeleted: false,
        changedRanges: [],
      };

      expect(provider.isLineChanged(1, diffInfo)).toBe(true);
      expect(provider.isLineChanged(100, diffInfo)).toBe(true);
    });

    it('should return false for deleted files', () => {
      const provider = new GitDiffProvider('/test/project');
      const diffInfo = {
        filePath: 'CLAUDE.md',
        isNew: false,
        isDeleted: true,
        changedRanges: [],
      };

      expect(provider.isLineChanged(1, diffInfo)).toBe(false);
    });

    it('should return true for lines in changed ranges', () => {
      const provider = new GitDiffProvider('/test/project');
      const diffInfo = {
        filePath: 'CLAUDE.md',
        isNew: false,
        isDeleted: false,
        changedRanges: [
          { startLine: 5, endLine: 10 },
          { startLine: 20, endLine: 25 },
        ],
      };

      expect(provider.isLineChanged(5, diffInfo)).toBe(true);
      expect(provider.isLineChanged(7, diffInfo)).toBe(true);
      expect(provider.isLineChanged(10, diffInfo)).toBe(true);
      expect(provider.isLineChanged(22, diffInfo)).toBe(true);
    });

    it('should return false for lines outside changed ranges', () => {
      const provider = new GitDiffProvider('/test/project');
      const diffInfo = {
        filePath: 'CLAUDE.md',
        isNew: false,
        isDeleted: false,
        changedRanges: [{ startLine: 5, endLine: 10 }],
      };

      expect(provider.isLineChanged(1, diffInfo)).toBe(false);
      expect(provider.isLineChanged(4, diffInfo)).toBe(false);
      expect(provider.isLineChanged(11, diffInfo)).toBe(false);
      expect(provider.isLineChanged(100, diffInfo)).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', () => {
      mockExecSync.mockReturnValue('feature/my-feature\n');

      const provider = new GitDiffProvider('/test/project');
      const branch = provider.getCurrentBranch();

      expect(branch).toBe('feature/my-feature');
    });

    it('should return null when not a git repo', () => {
      mockExistsSync.mockReturnValue(false);

      const provider = new GitDiffProvider('/test/project');
      const branch = provider.getCurrentBranch();

      expect(branch).toBeNull();
    });
  });

  describe('getMergeBase', () => {
    it('should return merge base with target branch', () => {
      mockExecSync.mockReturnValue('abc123def456\n');

      const provider = new GitDiffProvider('/test/project');
      const mergeBase = provider.getMergeBase('main');

      expect(mergeBase).toBe('abc123def456');
    });

    it('should try alternative branches if first fails', () => {
      let callCount = 0;
      mockExecSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('not found');
        return 'abc123\n';
      });

      const provider = new GitDiffProvider('/test/project');
      const mergeBase = provider.getMergeBase('develop');

      expect(mergeBase).toBe('abc123');
    });

    it('should return null when not a git repo', () => {
      mockExistsSync.mockReturnValue(false);

      const provider = new GitDiffProvider('/test/project');
      const mergeBase = provider.getMergeBase();

      expect(mergeBase).toBeNull();
    });
  });

  describe('getUntrackedClaudeMdFiles', () => {
    it('should return untracked CLAUDE.md files', () => {
      mockExecSync.mockReturnValue('CLAUDE.md\nREADME.md\nnew/CLAUDE.md\n');

      const provider = new GitDiffProvider('/test/project');
      const files = provider.getUntrackedClaudeMdFiles();

      expect(files).toEqual(['CLAUDE.md', 'new/CLAUDE.md']);
    });

    it('should return empty array when not a git repo', () => {
      mockExistsSync.mockReturnValue(false);

      const provider = new GitDiffProvider('/test/project');
      const files = provider.getUntrackedClaudeMdFiles();

      expect(files).toEqual([]);
    });
  });
});
