import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { installPrePushHook } from '../../../scripts/install-pre-push-hook.js';

// Mock process.exit to prevent actual exit during tests
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Pre-push Hook Installation', () => {
  const testDir = join(process.cwd(), 'test-git-repo');
  const gitDir = join(testDir, '.git');
  const hooksDir = join(gitDir, 'hooks');
  const prePushPath = join(hooksDir, 'pre-push');
  const backupPath = join(hooksDir, 'pre-push.backup');

  beforeEach(() => {
    vi.clearAllMocks();
    // Create test git repository structure
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    mkdirSync(gitDir, { recursive: true });
    mkdirSync(hooksDir, { recursive: true });
    
    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(() => {
    // Change back to original directory
    process.chdir(join(testDir, '..'));
    
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('installPrePushHook', () => {
    it('should install pre-push hook when git repository exists', () => {
      installPrePushHook();

      expect(existsSync(prePushPath)).toBe(true);
      
      const hookContent = readFileSync(prePushPath, 'utf8');
      expect(hookContent).toContain('#!/bin/sh');
      expect(hookContent).toContain('cclint pre-push hook');
      expect(hookContent).toContain('npm run typecheck');
      expect(hookContent).toContain('npm run lint');
      expect(hookContent).toContain('npm run format:check');
      expect(hookContent).toContain('npm test');
      
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Pre-push hook installed successfully!');
    });

    it('should backup existing pre-push hook', () => {
      // Create existing pre-push hook
      const existingContent = '#!/bin/sh\necho "existing hook"';
      writeFileSync(prePushPath, existingContent);

      installPrePushHook();

      expect(existsSync(backupPath)).toBe(true);
      expect(readFileSync(backupPath, 'utf8')).toBe(existingContent);
      expect(mockConsoleLog).toHaveBeenCalledWith('⚠️  Pre-push hook already exists. Backing up...');
    });

    it('should create hooks directory if it does not exist', () => {
      // Remove hooks directory
      rmSync(hooksDir, { recursive: true, force: true });

      installPrePushHook();

      expect(existsSync(hooksDir)).toBe(true);
      expect(existsSync(prePushPath)).toBe(true);
    });

    it('should exit with error when not in git repository', () => {
      // Remove .git directory
      rmSync(gitDir, { recursive: true, force: true });

      expect(() => installPrePushHook()).toThrow('process.exit called');
      expect(mockConsoleError).toHaveBeenCalledWith('❌ Not a git repository. Run this script from the root of your git repository.');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should make hook file executable', () => {
      installPrePushHook();

      const stats = require('fs').statSync(prePushPath);
      // Check if file has execute permissions (user execute bit)
      expect(stats.mode & parseInt('100', 8)).toBeTruthy();
    });

    it('should include quality check instructions in output', () => {
      installPrePushHook();

      expect(mockConsoleLog).toHaveBeenCalledWith('The hook will run the following checks before each push:');
      expect(mockConsoleLog).toHaveBeenCalledWith('  📝 TypeScript type checking');
      expect(mockConsoleLog).toHaveBeenCalledWith('  🔍 ESLint linting');
      expect(mockConsoleLog).toHaveBeenCalledWith('  💅 Prettier formatting');
      expect(mockConsoleLog).toHaveBeenCalledWith('  🧪 Test suite');
      expect(mockConsoleLog).toHaveBeenCalledWith('To skip the checks for a specific push, use: git push --no-verify');
    });
  });

  describe('hook script content', () => {
    it('should contain proper script structure', () => {
      installPrePushHook();
      
      const hookContent = readFileSync(prePushPath, 'utf8');
      
      // Check for essential parts of the script
      expect(hookContent).toContain('#!/bin/sh');
      expect(hookContent).toContain('echo "🔍 Running pre-push checks..."');
      expect(hookContent).toContain('script_exists() {');
      expect(hookContent).toContain('FAILED=0');
      expect(hookContent).toContain('if [ $FAILED -eq 1 ]; then');
      expect(hookContent).toContain('exit 0');
    });

    it('should check for package.json existence', () => {
      installPrePushHook();
      
      const hookContent = readFileSync(prePushPath, 'utf8');
      expect(hookContent).toContain('if [ ! -f "package.json" ]; then');
      expect(hookContent).toContain('No package.json found, skipping pre-push checks');
    });

    it('should include bypass option', () => {
      installPrePushHook();
      
      const hookContent = readFileSync(prePushPath, 'utf8');
      expect(hookContent).toContain('git push --no-verify');
    });
  });
});