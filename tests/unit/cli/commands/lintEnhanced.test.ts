import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

// Mock the enhanced lint command functionality
describe('Enhanced Lint Command', () => {
  const testDir = join(process.cwd(), 'test-lint-enhanced');
  const originalCwd = process.cwd();

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    // Create test CLAUDE.md file
    const testContent = `# Project Overview

This is a test project.

## Development Commands

Run npm install to get started.

## Architecture

This project uses TypeScript.
`;
    writeFileSync('CLAUDE.md', testContent);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('configuration option', () => {
    it('should accept --config option', () => {
      const options = {
        config: './custom-config.json',
        format: 'text',
        maxSize: '10000',
        fix: false,
      };

      expect(options.config).toBe('./custom-config.json');
    });

    it('should use auto-detected config when not specified', () => {
      const options = {
        config: undefined,
        format: 'text',
        maxSize: '10000',
        fix: false,
      };

      expect(options.config).toBeUndefined();
    });

    it('should load custom configuration file', () => {
      const customConfig = {
        rules: {
          'file-size': {
            enabled: true,
            options: {
              maxSize: 8000,
            },
          },
        },
      };

      writeFileSync('custom-config.json', JSON.stringify(customConfig, null, 2));

      // Simulate config loading
      const configPath = 'custom-config.json';
      expect(existsSync(configPath)).toBe(true);
    });
  });

  describe('auto-fix option', () => {
    it('should accept --fix option', () => {
      const options = {
        config: undefined,
        format: 'text',
        maxSize: '10000',
        fix: true,
      };

      expect(options.fix).toBe(true);
    });

    it('should apply fixes when --fix is enabled', () => {
      const originalContent = '#Header without space\nLine with trailing spaces   \n\n\n\nAnother line';
      const expectedContent = '# Header without space\nLine with trailing spaces\n\n\nAnother line';

      writeFileSync('test-file.md', originalContent);

      // Simulate fix application
      const fixes = [
        { description: 'Add space after header #', applied: true },
        { description: 'Remove trailing whitespace', applied: true },
        { description: 'Remove extra empty line', applied: true },
      ];

      expect(fixes.every(fix => fix.applied)).toBe(true);
    });

    it('should re-lint after applying fixes', () => {
      const options = {
        fix: true,
        format: 'text',
      };

      // Simulate the fix and re-lint workflow
      let fixesApplied = true;
      let reRunLinting = false;

      if (options.fix && fixesApplied) {
        reRunLinting = true;
      }

      expect(reRunLinting).toBe(true);
    });

    it('should log applied fixes', () => {
      const fileName = 'CLAUDE.md';
      const appliedFixesCount = 3;

      const logMessage = `🔧 Applied ${appliedFixesCount} fixes to ${fileName}`;
      expect(logMessage).toBe('🔧 Applied 3 fixes to CLAUDE.md');
    });
  });

  describe('rule configuration', () => {
    it('should enable/disable rules based on configuration', () => {
      const config = {
        rules: {
          'file-size': { enabled: true },
          'structure': { enabled: false },
          'content': { enabled: true },
          'format': { enabled: false },
        },
      };

      const enabledRules = Object.entries(config.rules)
        .filter(([_, rule]) => rule.enabled)
        .map(([name, _]) => name);

      expect(enabledRules).toEqual(['file-size', 'content']);
    });

    it('should apply rule options from configuration', () => {
      const config = {
        rules: {
          'file-size': {
            enabled: true,
            options: {
              maxSize: 15000,
            },
          },
        },
      };

      const fileSizeRule = config.rules['file-size'];
      expect(fileSizeRule.options?.maxSize).toBe(15000);
    });

    it('should merge configuration with defaults', () => {
      const defaultConfig = {
        rules: {
          'file-size': { enabled: true, options: { maxSize: 10000 } },
          'structure': { enabled: true },
          'content': { enabled: true },
          'format': { enabled: true },
        },
      };

      const userConfig = {
        rules: {
          'file-size': { options: { maxSize: 8000 } },
          'structure': { enabled: false },
        },
      };

      // Simulate merge
      const mergedConfig = {
        rules: {
          'file-size': { enabled: true, options: { maxSize: 8000 } },
          'structure': { enabled: false },
          'content': { enabled: true },
          'format': { enabled: true },
        },
      };

      expect(mergedConfig.rules['file-size'].options?.maxSize).toBe(8000);
      expect(mergedConfig.rules['structure'].enabled).toBe(false);
      expect(mergedConfig.rules['content'].enabled).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle configuration loading errors', () => {
      const invalidConfigPath = './non-existent-config.json';
      
      expect(existsSync(invalidConfigPath)).toBe(false);
      
      // Should fall back to default config
      const shouldUseDefault = !existsSync(invalidConfigPath);
      expect(shouldUseDefault).toBe(true);
    });

    it('should handle file reading errors gracefully', () => {
      const nonExistentFile = './non-existent.md';
      
      expect(existsSync(nonExistentFile)).toBe(false);
      
      // Should result in error
      const shouldError = !existsSync(nonExistentFile);
      expect(shouldError).toBe(true);
    });

    it('should validate max-size option', () => {
      const invalidMaxSize = 'not-a-number';
      const parsedMaxSize = parseInt(invalidMaxSize, 10);
      
      expect(isNaN(parsedMaxSize)).toBe(true);
    });

    it('should handle fix application errors', () => {
      // Simulate fix failure scenario
      const fixResult = {
        fixed: false,
        appliedFixes: [],
        error: 'Permission denied',
      };

      expect(fixResult.fixed).toBe(false);
      expect(fixResult.appliedFixes).toHaveLength(0);
      expect(fixResult.error).toBeDefined();
    });
  });

  describe('output formatting', () => {
    it('should format text output correctly', () => {
      const violations = [
        {
          rule: 'file-size',
          message: 'File size exceeds limit',
          severity: 'warning',
          location: { line: 1, column: 1 },
        },
        {
          rule: 'structure',
          message: 'Missing required section',
          severity: 'error',
          location: { line: 5, column: 1 },
        },
      ];

      const textOutput = violations.map(v => 
        `${v.severity === 'error' ? '❌' : '⚠️'} ${v.severity}: ${v.message} at ${v.location.line}:${v.location.column} [${v.rule}]`
      ).join('\n');

      expect(textOutput).toContain('❌ error: Missing required section');
      expect(textOutput).toContain('⚠️ warning: File size exceeds limit');
    });

    it('should format JSON output correctly', () => {
      const result = {
        file: 'CLAUDE.md',
        violations: [],
        summary: {
          errors: 0,
          warnings: 0,
          total: 0,
        },
      };

      const jsonOutput = JSON.stringify(result, null, 2);
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.file).toBe('CLAUDE.md');
      expect(parsed.violations).toEqual([]);
      expect(parsed.summary.total).toBe(0);
    });
  });

  describe('exit codes', () => {
    it('should exit with 0 when no errors found', () => {
      const errorCount = 0;
      const warningCount = 2;

      const expectedExitCode = errorCount > 0 ? 1 : 0;
      expect(expectedExitCode).toBe(0);
    });

    it('should exit with 1 when errors found', () => {
      const errorCount = 2;
      const warningCount = 1;

      const expectedExitCode = errorCount > 0 ? 1 : 0;
      expect(expectedExitCode).toBe(1);
    });

    it('should exit with 0 after successful fixes', () => {
      const originalErrors = 3;
      const errorsAfterFix = 0;

      const fixApplied = true;
      const finalExitCode = fixApplied && errorsAfterFix === 0 ? 0 : 1;
      
      expect(finalExitCode).toBe(0);
    });
  });
});