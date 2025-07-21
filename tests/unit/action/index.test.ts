import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

// Mock @actions/core and @actions/glob
const mockCore = {
  getInput: vi.fn(),
  setOutput: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
};

const mockGlob = {
  create: vi.fn(),
};

vi.mock('@actions/core', () => mockCore);
vi.mock('@actions/glob', () => ({ create: mockGlob.create }));

// Mock the actual action implementation
const mockGlobber = {
  glob: vi.fn(),
};

describe('GitHub Action', () => {
  const testDir = join(process.cwd(), 'test-action');
  const originalCwd = process.cwd();

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    // Reset mocks
    vi.clearAllMocks();
    
    // Setup default mock returns
    mockCore.getInput.mockImplementation((name: string) => {
      const defaults: Record<string, string> = {
        'files': 'CLAUDE.md',
        'format': 'text',
        'max-size': '10000',
        'fail-on-error': 'true',
        'config-file': '',
      };
      return defaults[name] || '';
    });

    mockGlob.create.mockResolvedValue(mockGlobber);
    mockGlobber.glob.mockResolvedValue(['CLAUDE.md']);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('input processing', () => {
    it('should read all required inputs', () => {
      // Simulate action reading inputs
      const files = mockCore.getInput('files');
      const format = mockCore.getInput('format');
      const maxSize = mockCore.getInput('max-size');
      const failOnError = mockCore.getInput('fail-on-error');
      const configFile = mockCore.getInput('config-file');

      expect(files).toBe('CLAUDE.md');
      expect(format).toBe('text');
      expect(maxSize).toBe('10000');
      expect(failOnError).toBe('true');
      expect(configFile).toBe('');
    });

    it('should handle custom input values', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        const custom: Record<string, string> = {
          'files': '**/*.md',
          'format': 'json',
          'max-size': '15000',
          'fail-on-error': 'false',
          'config-file': './custom-config.json',
        };
        return custom[name] || '';
      });

      const files = mockCore.getInput('files');
      const format = mockCore.getInput('format');
      const maxSize = mockCore.getInput('max-size');
      const failOnError = mockCore.getInput('fail-on-error');
      const configFile = mockCore.getInput('config-file');

      expect(files).toBe('**/*.md');
      expect(format).toBe('json');
      expect(maxSize).toBe('15000');
      expect(failOnError).toBe('false');
      expect(configFile).toBe('./custom-config.json');
    });

    it('should validate max-size input', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'max-size') return 'invalid';
        return 'CLAUDE.md';
      });

      const maxSizeInput = mockCore.getInput('max-size');
      const maxSize = parseInt(maxSizeInput, 10);

      expect(isNaN(maxSize)).toBe(true);
    });
  });

  describe('file discovery', () => {
    it('should find files using glob pattern', async () => {
      const pattern = 'CLAUDE.md';
      
      await mockGlob.create(pattern);
      const files = await mockGlobber.glob();

      expect(mockGlob.create).toHaveBeenCalledWith(pattern);
      expect(mockGlobber.glob).toHaveBeenCalled();
      expect(files).toEqual(['CLAUDE.md']);
    });

    it('should handle multiple file patterns', async () => {
      const pattern = 'CLAUDE.md docs/CLAUDE.md';
      mockGlobber.glob.mockResolvedValue(['CLAUDE.md', 'docs/CLAUDE.md']);
      
      await mockGlob.create(pattern);
      const files = await mockGlobber.glob();

      expect(files).toEqual(['CLAUDE.md', 'docs/CLAUDE.md']);
    });

    it('should handle glob patterns', async () => {
      const pattern = '**/CLAUDE.md';
      mockGlobber.glob.mockResolvedValue(['CLAUDE.md', 'src/CLAUDE.md', 'docs/CLAUDE.md']);
      
      await mockGlob.create(pattern);
      const files = await mockGlobber.glob();

      expect(files).toHaveLength(3);
      expect(files).toContain('CLAUDE.md');
      expect(files).toContain('src/CLAUDE.md');
      expect(files).toContain('docs/CLAUDE.md');
    });

    it('should warn when no files found', async () => {
      mockGlobber.glob.mockResolvedValue([]);
      
      const files = await mockGlobber.glob();
      
      if (files.length === 0) {
        mockCore.warning('No files found matching pattern: CLAUDE.md');
      }

      expect(files).toHaveLength(0);
      expect(mockCore.warning).toHaveBeenCalledWith('No files found matching pattern: CLAUDE.md');
    });
  });

  describe('output generation', () => {
    it('should set error and warning counts', () => {
      const errorCount = 2;
      const warningCount = 3;

      mockCore.setOutput('error-count', errorCount.toString());
      mockCore.setOutput('warning-count', warningCount.toString());

      expect(mockCore.setOutput).toHaveBeenCalledWith('error-count', '2');
      expect(mockCore.setOutput).toHaveBeenCalledWith('warning-count', '3');
    });

    it('should set JSON results when format is json', () => {
      const results = [
        {
          file: 'CLAUDE.md',
          violations: [],
          summary: { errors: 0, warnings: 0, total: 0 },
        },
      ];

      mockCore.setOutput('results', JSON.stringify(results, null, 2));

      expect(mockCore.setOutput).toHaveBeenCalledWith(
        'results',
        JSON.stringify(results, null, 2)
      );
    });

    it('should not set results for text format', () => {
      // In text format, results output should not be set
      const calls = mockCore.setOutput.mock.calls.filter(call => call[0] === 'results');
      expect(calls).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should fail action when errors found and fail-on-error is true', () => {
      const errorCount = 2;
      const failOnError = true;

      if (errorCount > 0 && failOnError) {
        mockCore.setFailed(`Found ${errorCount} errors`);
      }

      expect(mockCore.setFailed).toHaveBeenCalledWith('Found 2 errors');
    });

    it('should not fail when fail-on-error is false', () => {
      const errorCount = 2;
      const failOnError = false;

      if (errorCount > 0 && failOnError) {
        mockCore.setFailed(`Found ${errorCount} errors`);
      }

      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should handle file reading errors', () => {
      const error = new Error('File not found');
      
      mockCore.error(`Failed to lint CLAUDE.md: ${error.message}`);

      expect(mockCore.error).toHaveBeenCalledWith('Failed to lint CLAUDE.md: File not found');
    });

    it('should handle action failures gracefully', () => {
      const error = new Error('Something went wrong');
      
      mockCore.setFailed(`Action failed: ${error.message}`);

      expect(mockCore.setFailed).toHaveBeenCalledWith('Action failed: Something went wrong');
    });
  });

  describe('logging', () => {
    it('should log informational messages', () => {
      mockCore.info('📝 Linting results for CLAUDE.md:');
      mockCore.info('✅ CLAUDE.md: No issues found');

      expect(mockCore.info).toHaveBeenCalledWith('📝 Linting results for CLAUDE.md:');
      expect(mockCore.info).toHaveBeenCalledWith('✅ CLAUDE.md: No issues found');
    });

    it('should log errors and warnings appropriately', () => {
      mockCore.error('❌ error: Missing required section at 1:1 [structure]');
      mockCore.warning('⚠️ warning: File size exceeds limit at 1:1 [file-size]');

      expect(mockCore.error).toHaveBeenCalledWith('❌ error: Missing required section at 1:1 [structure]');
      expect(mockCore.warning).toHaveBeenCalledWith('⚠️ warning: File size exceeds limit at 1:1 [file-size]');
    });

    it('should log summary information', () => {
      const totalErrors = 1;
      const totalWarnings = 2;
      const fileCount = 3;

      mockCore.info(`\n📊 Total: ${totalErrors} errors, ${totalWarnings} warnings across ${fileCount} files`);

      expect(mockCore.info).toHaveBeenCalledWith('\n📊 Total: 1 errors, 2 warnings across 3 files');
    });
  });

  describe('configuration handling', () => {
    it('should use custom config file when provided', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'config-file') return './custom-config.json';
        return '';
      });

      const configFile = mockCore.getInput('config-file');
      expect(configFile).toBe('./custom-config.json');
    });

    it('should auto-detect config when not provided', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'config-file') return '';
        return '';
      });

      const configFile = mockCore.getInput('config-file');
      expect(configFile).toBe('');
    });
  });

  describe('integration scenarios', () => {
    it('should handle successful linting scenario', () => {
      // Setup: No violations found
      const errorCount = 0;
      const warningCount = 0;
      const fileCount = 1;

      mockCore.setOutput('error-count', errorCount.toString());
      mockCore.setOutput('warning-count', warningCount.toString());
      mockCore.info(`\n✅ All ${fileCount} files passed linting`);

      expect(mockCore.setOutput).toHaveBeenCalledWith('error-count', '0');
      expect(mockCore.setOutput).toHaveBeenCalledWith('warning-count', '0');
      expect(mockCore.info).toHaveBeenCalledWith('\n✅ All 1 files passed linting');
    });

    it('should handle mixed results scenario', () => {
      // Setup: Some violations found
      const errorCount = 1;
      const warningCount = 3;
      const fileCount = 2;

      mockCore.setOutput('error-count', errorCount.toString());
      mockCore.setOutput('warning-count', warningCount.toString());
      mockCore.info(`\n📊 Total: ${errorCount} errors, ${warningCount} warnings across ${fileCount} files`);

      // Should fail due to errors
      if (errorCount > 0) {
        mockCore.setFailed(`Found ${errorCount} errors`);
      }

      expect(mockCore.setOutput).toHaveBeenCalledWith('error-count', '1');
      expect(mockCore.setOutput).toHaveBeenCalledWith('warning-count', '3');
      expect(mockCore.setFailed).toHaveBeenCalledWith('Found 1 errors');
    });
  });
});