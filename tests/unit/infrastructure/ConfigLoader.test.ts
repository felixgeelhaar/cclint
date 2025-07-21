import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { ConfigLoader } from '../../../src/infrastructure/ConfigLoader.js';
import type { CclintConfig } from '../../../src/domain/Config.js';

describe('ConfigLoader', () => {
  const testDir = join(process.cwd(), 'test-config');
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

  describe('load', () => {
    it('should return default config when no config file exists', () => {
      const config = ConfigLoader.load();
      
      expect(config.rules['file-size']?.enabled).toBe(true);
      expect(config.rules['structure']?.enabled).toBe(true);
      expect(config.rules['content']?.enabled).toBe(true);
      expect(config.rules['format']?.enabled).toBe(true);
      expect(config.rules['file-size']?.options?.maxSize).toBe(10000);
    });

    it('should load config from .cclintrc.json', () => {
      const configContent = {
        rules: {
          'file-size': {
            enabled: true,
            severity: 'error' as const,
            options: {
              maxSize: 15000,
            },
          },
          'structure': {
            enabled: false,
          },
        },
        ignore: ['*.backup.md'],
      };

      writeFileSync('.cclintrc.json', JSON.stringify(configContent, null, 2));

      const config = ConfigLoader.load();

      expect(config.rules['file-size']?.options?.maxSize).toBe(15000);
      expect(config.rules['file-size']?.severity).toBe('error');
      expect(config.rules['structure']?.enabled).toBe(false);
      expect(config.ignore).toEqual(['*.backup.md']);
    });

    it('should load config from package.json', () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        cclint: {
          rules: {
            'file-size': {
              enabled: true,
              options: {
                maxSize: 8000,
              },
            },
          },
        },
      };

      writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

      const config = ConfigLoader.load();

      expect(config.rules['file-size']?.options?.maxSize).toBe(8000);
      expect(config.rules['structure']?.enabled).toBe(true); // Should merge with defaults
    });

    it('should prioritize .cclintrc.json over package.json', () => {
      const cclintrcContent = {
        rules: {
          'file-size': {
            options: {
              maxSize: 12000,
            },
          },
        },
      };

      const packageJson = {
        name: 'test-project',
        cclint: {
          rules: {
            'file-size': {
              options: {
                maxSize: 5000,
              },
            },
          },
        },
      };

      writeFileSync('.cclintrc.json', JSON.stringify(cclintrcContent, null, 2));
      writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

      const config = ConfigLoader.load();

      expect(config.rules['file-size']?.options?.maxSize).toBe(12000);
    });

    it('should traverse up directory tree to find config', () => {
      const subDir = join(testDir, 'src', 'components');
      mkdirSync(subDir, { recursive: true });

      const configContent = {
        rules: {
          'file-size': {
            options: {
              maxSize: 20000,
            },
          },
        },
      };

      writeFileSync('.cclintrc.json', JSON.stringify(configContent, null, 2));
      process.chdir(subDir);

      const config = ConfigLoader.load();

      expect(config.rules['file-size']?.options?.maxSize).toBe(20000);
    });

    it('should merge custom config with defaults', () => {
      const configContent = {
        rules: {
          'file-size': {
            options: {
              maxSize: 7000,
            },
          },
          // Only configure file-size, others should use defaults
        },
      };

      writeFileSync('.cclintrc.json', JSON.stringify(configContent, null, 2));

      const config = ConfigLoader.load();

      expect(config.rules['file-size']?.options?.maxSize).toBe(7000);
      expect(config.rules['structure']?.enabled).toBe(true); // Default
      expect(config.rules['content']?.enabled).toBe(true); // Default
      expect(config.rules['format']?.enabled).toBe(true); // Default
    });

    it('should handle malformed JSON gracefully', () => {
      writeFileSync('.cclintrc.json', '{ invalid json }');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config = ConfigLoader.load();

      expect(config).toEqual(expect.objectContaining({
        rules: expect.objectContaining({
          'file-size': expect.objectContaining({ enabled: true }),
        }),
      }));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load config'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    it('should handle missing cclint property in package.json', () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        // No cclint property
      };

      writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

      const config = ConfigLoader.load();

      expect(config.rules['file-size']?.enabled).toBe(true);
      expect(config.rules['file-size']?.options?.maxSize).toBe(10000);
    });

    it('should deep merge rule options', () => {
      const configContent = {
        rules: {
          'structure': {
            enabled: true,
            severity: 'warning' as const,
            options: {
              requiredSections: ['Custom Section'],
            },
          },
        },
      };

      writeFileSync('.cclintrc.json', JSON.stringify(configContent, null, 2));

      const config = ConfigLoader.load();

      expect(config.rules['structure']?.enabled).toBe(true);
      expect(config.rules['structure']?.severity).toBe('warning');
      expect(config.rules['structure']?.options?.requiredSections).toEqual(['Custom Section']);
    });

    it('should load config from specific directory', () => {
      const configDir = join(testDir, 'config');
      mkdirSync(configDir, { recursive: true });

      const configContent = {
        rules: {
          'file-size': {
            options: {
              maxSize: 25000,
            },
          },
        },
      };

      writeFileSync(join(configDir, '.cclintrc.json'), JSON.stringify(configContent, null, 2));

      const config = ConfigLoader.load(configDir);

      expect(config.rules['file-size']?.options?.maxSize).toBe(25000);
    });

    it('should handle empty config file', () => {
      writeFileSync('.cclintrc.json', '{}');

      const config = ConfigLoader.load();

      expect(config.rules['file-size']?.enabled).toBe(true);
      expect(config.rules['file-size']?.options?.maxSize).toBe(10000);
    });

    it('should handle partial rule configuration', () => {
      const configContent = {
        rules: {
          'file-size': {
            enabled: false,
            // No severity or options specified
          },
        },
      };

      writeFileSync('.cclintrc.json', JSON.stringify(configContent, null, 2));

      const config = ConfigLoader.load();

      expect(config.rules['file-size']?.enabled).toBe(false);
      expect(config.rules['file-size']?.severity).toBe('warning'); // Default
      expect(config.rules['file-size']?.options?.maxSize).toBe(10000); // Default
    });
  });
});