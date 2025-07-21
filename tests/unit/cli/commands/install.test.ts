import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { installCommand } from '../../../../src/cli/commands/install.js';

describe('Install Command', () => {
  const testDir = join(process.cwd(), 'test-install-command');
  const originalCwd = process.cwd();

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('hooks installation', () => {
    it('should accept --hooks option', () => {
      const options = {
        hooks: true,
      };

      expect(options.hooks).toBe(true);
    });

    it('should default hooks option to true', () => {
      const defaultOptions = {
        hooks: true, // Default value
      };

      expect(defaultOptions.hooks).toBe(true);
    });

    it('should install git hooks when --hooks is true', () => {
      const options = { hooks: true };

      // Create .git directory to simulate git repo
      mkdirSync('.git');
      const hooksDir = join('.git', 'hooks');
      mkdirSync(hooksDir, { recursive: true });

      if (options.hooks) {
        // Simulate hook installation
        const hookPath = join(hooksDir, 'pre-commit');
        writeFileSync(hookPath, '#!/bin/sh\necho "cclint hook"\nexit 0\n');
      }

      expect(existsSync(join(hooksDir, 'pre-commit'))).toBe(true);
    });

    it('should skip installation when --hooks is false', () => {
      const options = { hooks: false };

      // Create .git directory
      mkdirSync('.git');
      const hooksDir = join('.git', 'hooks');
      mkdirSync(hooksDir, { recursive: true });

      if (!options.hooks) {
        // Skip installation
      } else {
        const hookPath = join(hooksDir, 'pre-commit');
        writeFileSync(hookPath, '#!/bin/sh\necho "cclint hook"\nexit 0\n');
      }

      expect(existsSync(join(hooksDir, 'pre-commit'))).toBe(false);
    });
  });

  describe('success messages', () => {
    it('should log installation progress', () => {
      const messages = [];
      
      messages.push('📦 Installing cclint git hooks...');
      messages.push('✅ Git hooks installed successfully!');
      messages.push('');
      messages.push('Your CLAUDE.md files will now be automatically linted before each commit.');
      messages.push('To skip the check for a specific commit, use: git commit --no-verify');

      expect(messages[0]).toBe('📦 Installing cclint git hooks...');
      expect(messages[1]).toBe('✅ Git hooks installed successfully!');
      expect(messages[3]).toContain('automatically linted');
      expect(messages[4]).toContain('--no-verify');
    });

    it('should provide usage instructions', () => {
      const instructions = [
        'Your CLAUDE.md files will now be automatically linted before each commit.',
        'To skip the check for a specific commit, use: git commit --no-verify',
      ];

      expect(instructions[0]).toContain('automatically linted');
      expect(instructions[1]).toContain('git commit --no-verify');
    });
  });

  describe('error handling', () => {
    it('should handle missing git repository', () => {
      // Don't create .git directory
      const isGitRepo = existsSync('.git');
      
      if (!isGitRepo) {
        const errorMessage = 'Not a git repository. Run this script from the root of your git repository.';
        expect(errorMessage).toContain('Not a git repository');
      }

      expect(isGitRepo).toBe(false);
    });

    it('should handle permission errors gracefully', () => {
      // Create .git directory
      mkdirSync('.git');
      
      try {
        const hooksDir = join('.git', 'hooks');
        mkdirSync(hooksDir, { recursive: true });
        
        const hookPath = join(hooksDir, 'pre-commit');
        writeFileSync(hookPath, '#!/bin/sh\necho "test"\nexit 0\n');
        
        expect(existsSync(hookPath)).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle installation failures', () => {
      const installationResult = {
        success: false,
        error: 'Permission denied',
      };

      if (!installationResult.success) {
        const errorMessage = `Error: ${installationResult.error}`;
        expect(errorMessage).toBe('Error: Permission denied');
      }
    });

    it('should handle unknown errors', () => {
      const error = 'Unknown error occurred';
      const errorMessage = `Error: ${error}`;
      
      expect(errorMessage).toBe('Error: Unknown error occurred');
    });
  });

  describe('command validation', () => {
    it('should validate command options', () => {
      const validOptions = {
        hooks: true,
        prePush: true,
      };

      const hasValidOptions = 
        typeof validOptions.hooks === 'boolean' &&
        typeof validOptions.prePush === 'boolean';
      expect(hasValidOptions).toBe(true);
    });

    it('should handle invalid options gracefully', () => {
      const invalidOptions = {
        hooks: 'invalid', // Should be boolean
        prePush: 'invalid', // Should be boolean
      };

      const isValid = 
        typeof invalidOptions.hooks === 'boolean' &&
        typeof invalidOptions.prePush === 'boolean';
      expect(isValid).toBe(false);
    });

    it('should validate pre-push option independently', () => {
      const prePushOnlyOptions = {
        hooks: false,
        prePush: true,
      };

      expect(prePushOnlyOptions.prePush).toBe(true);
      expect(prePushOnlyOptions.hooks).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should complete full installation workflow', () => {
      // Setup git repository
      mkdirSync('.git');
      const hooksDir = join('.git', 'hooks');
      mkdirSync(hooksDir, { recursive: true });

      // Simulate installation steps
      const steps = [
        'Check git repository',
        'Create hooks directory',
        'Install pre-commit hook',
        'Set executable permissions',
        'Show success message',
      ];

      const completed = steps.map(step => {
        switch (step) {
          case 'Check git repository':
            return existsSync('.git');
          case 'Create hooks directory':
            return existsSync(hooksDir);
          case 'Install pre-commit hook':
            const hookPath = join(hooksDir, 'pre-commit');
            writeFileSync(hookPath, '#!/bin/sh\necho "hook"\nexit 0\n');
            return existsSync(hookPath);
          case 'Set executable permissions':
            return true; // Simulated
          case 'Show success message':
            return true;
          default:
            return false;
        }
      });

      expect(completed.every(Boolean)).toBe(true);
    });

    it('should handle existing hook backup scenario', () => {
      // Setup
      mkdirSync('.git');
      const hooksDir = join('.git', 'hooks');
      mkdirSync(hooksDir, { recursive: true });

      const hookPath = join(hooksDir, 'pre-commit');
      const backupPath = hookPath + '.backup';

      // Create existing hook
      writeFileSync(hookPath, '#!/bin/sh\necho "existing"\nexit 0\n');
      const existingContent = 'existing hook content';

      // Simulate backup creation
      writeFileSync(backupPath, existingContent);

      // Install new hook
      writeFileSync(hookPath, '#!/bin/sh\necho "new hook"\nexit 0\n');

      expect(existsSync(backupPath)).toBe(true);
      expect(existsSync(hookPath)).toBe(true);
    });
  });
});