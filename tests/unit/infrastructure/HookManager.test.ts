import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  unlinkSync,
} from 'fs';
import { HookManager } from '../../../src/infrastructure/HookManager.js';

vi.mock('fs');

describe('HookManager', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockChmodSync = vi.mocked(chmodSync);
  const mockUnlinkSync = vi.mocked(unlinkSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detect', () => {
    it('should detect Husky when .husky directory exists', () => {
      mockExistsSync.mockImplementation(p => {
        return String(p).includes('.husky');
      });

      const manager = new HookManager('/test/project');
      expect(manager.detect()).toBe('husky');
    });

    it('should detect Lefthook when lefthook.yml exists', () => {
      mockExistsSync.mockImplementation(p => {
        return String(p).includes('lefthook.yml');
      });

      const manager = new HookManager('/test/project');
      expect(manager.detect()).toBe('lefthook');
    });

    it('should detect Lefthook when lefthook.yaml exists', () => {
      mockExistsSync.mockImplementation(p => {
        return String(p).includes('lefthook.yaml');
      });

      const manager = new HookManager('/test/project');
      expect(manager.detect()).toBe('lefthook');
    });

    it('should detect pre-commit when .pre-commit-config.yaml exists', () => {
      mockExistsSync.mockImplementation(p => {
        return String(p).includes('.pre-commit-config.yaml');
      });

      const manager = new HookManager('/test/project');
      expect(manager.detect()).toBe('pre-commit');
    });

    it('should detect git when .git/hooks exists', () => {
      mockExistsSync.mockImplementation(p => {
        return String(p).includes('.git/hooks');
      });

      const manager = new HookManager('/test/project');
      expect(manager.detect()).toBe('git');
    });

    it('should return null when no hook manager detected', () => {
      mockExistsSync.mockReturnValue(false);

      const manager = new HookManager('/test/project');
      expect(manager.detect()).toBeNull();
    });

    it('should prioritize Husky over other managers', () => {
      mockExistsSync.mockReturnValue(true);

      const manager = new HookManager('/test/project');
      expect(manager.detect()).toBe('husky');
    });
  });

  describe('install', () => {
    describe('Husky', () => {
      it('should create pre-commit hook in .husky directory', () => {
        mockExistsSync.mockImplementation(p => {
          const path = String(p);
          if (path.includes('.husky') && !path.includes('pre-commit'))
            return true;
          return false;
        });

        const manager = new HookManager('/test/project');
        const result = manager.install({ manager: 'husky' });

        expect(result.success).toBe(true);
        expect(result.manager).toBe('husky');
        expect(mockWriteFileSync).toHaveBeenCalled();
        expect(mockChmodSync).toHaveBeenCalled();
      });

      it('should append to existing pre-commit hook', () => {
        const existingContent =
          '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\nnpm test';
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(existingContent);

        const manager = new HookManager('/test/project');
        const result = manager.install({ manager: 'husky' });

        expect(result.success).toBe(true);
        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('npm test');
        expect(writtenContent).toContain('cclint pre-commit hook');
      });

      it('should not duplicate if already installed', () => {
        const existingContent =
          '#!/usr/bin/env sh\n# cclint pre-commit hook\nnpx cclint lint';
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(existingContent);

        const manager = new HookManager('/test/project');
        const result = manager.install({ manager: 'husky' });

        expect(result.success).toBe(true);
        expect(result.message).toContain('already installed');
      });
    });

    describe('Git', () => {
      it('should create pre-commit hook in .git/hooks directory', () => {
        mockExistsSync.mockImplementation(p => {
          const path = String(p);
          if (path.includes('.git') && !path.includes('pre-commit'))
            return true;
          return false;
        });

        const manager = new HookManager('/test/project');
        const result = manager.install({ manager: 'git' });

        expect(result.success).toBe(true);
        expect(result.manager).toBe('git');
        expect(mockWriteFileSync).toHaveBeenCalled();
      });

      it('should fail if not a git repository', () => {
        mockExistsSync.mockReturnValue(false);

        const manager = new HookManager('/test/project');
        const result = manager.install({ manager: 'git' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('Not a git repository');
      });
    });

    describe('Lefthook', () => {
      it('should add cclint to lefthook.yml', () => {
        const existingContent =
          'pre-commit:\n  commands:\n    lint:\n      run: npm run lint';
        mockExistsSync.mockImplementation(p => {
          return String(p).includes('lefthook.yml');
        });
        mockReadFileSync.mockReturnValue(existingContent);

        const manager = new HookManager('/test/project');
        const result = manager.install({ manager: 'lefthook' });

        expect(result.success).toBe(true);
        expect(result.manager).toBe('lefthook');
        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('cclint');
      });

      it('should fail if lefthook.yml not found', () => {
        mockExistsSync.mockReturnValue(false);

        const manager = new HookManager('/test/project');
        const result = manager.install({ manager: 'lefthook' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('lefthook.yml not found');
      });
    });

    describe('pre-commit', () => {
      it('should add cclint to .pre-commit-config.yaml', () => {
        const existingContent =
          'repos:\n  - repo: https://github.com/pre-commit/pre-commit-hooks';
        mockExistsSync.mockImplementation(p => {
          return String(p).includes('.pre-commit-config.yaml');
        });
        mockReadFileSync.mockReturnValue(existingContent);

        const manager = new HookManager('/test/project');
        const result = manager.install({ manager: 'pre-commit' });

        expect(result.success).toBe(true);
        expect(result.manager).toBe('pre-commit');
        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('cclint');
      });

      it('should fail if .pre-commit-config.yaml not found', () => {
        mockExistsSync.mockReturnValue(false);

        const manager = new HookManager('/test/project');
        const result = manager.install({ manager: 'pre-commit' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('.pre-commit-config.yaml not found');
      });
    });

    describe('with options', () => {
      it('should include --fix flag when fix option is true', () => {
        mockExistsSync.mockImplementation(p => {
          const path = String(p);
          if (path.includes('.git') && !path.includes('pre-commit'))
            return true;
          return false;
        });

        const manager = new HookManager('/test/project');
        manager.install({ manager: 'git', fix: true });

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('--fix');
      });

      it('should use staged files command when staged option is true', () => {
        mockExistsSync.mockImplementation(p => {
          const path = String(p);
          if (path.includes('.git') && !path.includes('pre-commit'))
            return true;
          return false;
        });

        const manager = new HookManager('/test/project');
        manager.install({ manager: 'git', staged: true });

        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('git diff --cached');
      });
    });
  });

  describe('uninstall', () => {
    describe('Husky', () => {
      it('should remove cclint section from pre-commit hook', () => {
        const existingContent =
          '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n# cclint pre-commit hook\nnpx cclint lint\n# end cclint\n';
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(existingContent);

        const manager = new HookManager('/test/project');
        const result = manager.uninstall();

        expect(result.success).toBe(true);
        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).not.toContain('cclint');
      });

      it('should handle missing pre-commit hook', () => {
        mockExistsSync.mockImplementation(p => {
          if (String(p).includes('pre-commit')) return false;
          return String(p).includes('.husky');
        });

        const manager = new HookManager('/test/project');
        const result = manager.uninstall();

        expect(result.success).toBe(true);
        expect(result.message).toContain('No pre-commit hook found');
      });
    });

    describe('Git', () => {
      it('should remove cclint section from git hook', () => {
        const existingContent =
          '#!/usr/bin/env sh\n\n# cclint pre-commit hook\nnpx cclint lint\n# end cclint\n';
        mockExistsSync.mockImplementation(p => {
          const path = String(p);
          if (path.includes('.husky')) return false;
          if (path.includes('lefthook')) return false;
          if (path.includes('.pre-commit-config')) return false;
          return true;
        });
        mockReadFileSync.mockReturnValue(existingContent);

        const manager = new HookManager('/test/project');
        const result = manager.uninstall();

        expect(result.success).toBe(true);
        expect(mockUnlinkSync).toHaveBeenCalled();
      });

      it('should preserve other content in hook file', () => {
        const existingContent =
          '#!/usr/bin/env sh\n\nnpm test\n\n# cclint pre-commit hook\nnpx cclint lint\n# end cclint\n';
        mockExistsSync.mockImplementation(p => {
          const path = String(p);
          if (path.includes('.husky')) return false;
          if (path.includes('lefthook')) return false;
          if (path.includes('.pre-commit-config')) return false;
          return true;
        });
        mockReadFileSync.mockReturnValue(existingContent);

        const manager = new HookManager('/test/project');
        const result = manager.uninstall();

        expect(result.success).toBe(true);
        const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
        expect(writtenContent).toContain('npm test');
        expect(writtenContent).not.toContain('cclint');
      });
    });
  });

  describe('isInstalled', () => {
    it('should return true when cclint hook is installed in Husky', () => {
      const existingContent =
        '#!/usr/bin/env sh\n# cclint pre-commit hook\nnpx cclint lint';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingContent);

      const manager = new HookManager('/test/project');
      const result = manager.isInstalled();

      expect(result).toBe(true);
    });

    it('should return false when cclint hook is not installed', () => {
      const existingContent = '#!/usr/bin/env sh\nnpm test';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingContent);

      const manager = new HookManager('/test/project');
      const result = manager.isInstalled();

      expect(result).toBe(false);
    });

    it('should return false when no hook manager detected', () => {
      mockExistsSync.mockReturnValue(false);

      const manager = new HookManager('/test/project');
      const result = manager.isInstalled();

      expect(result).toBe(false);
    });
  });
});
