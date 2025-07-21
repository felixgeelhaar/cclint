import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginLoader } from '../../../src/infrastructure/PluginLoader.js';
import { RuleRegistry } from '../../../src/infrastructure/RuleRegistry.js';
import { CustomRule } from '../../../src/domain/CustomRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Violation } from '../../../src/domain/Violation.js';
import type { Fix } from '../../../src/domain/AutoFix.js';
import type { PluginConfig } from '../../../src/domain/Config.js';

class MockPluginRule extends CustomRule {
  constructor(id: string = 'plugin-rule') {
    super(id, 'Rule from plugin');
  }

  protected validateInternal(_file: ContextFile): Violation[] {
    return [];
  }

  generateFixes(_violations: Violation[], _content: string): Fix[] {
    return [];
  }
}

describe('PluginLoader', () => {
  let loader: PluginLoader;
  let registry: RuleRegistry;

  beforeEach(() => {
    registry = new RuleRegistry();
    loader = new PluginLoader(registry);
    // Clear any existing mocks
    vi.clearAllMocks();
  });

  describe('loadPlugin', () => {
    it('should load plugin from valid module', async () => {
      const mockPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        rules: [new MockPluginRule()],
      };

      // Mock the importPlugin method
      vi.spyOn(loader as any, 'importPlugin').mockResolvedValue({ default: mockPlugin });

      await loader.loadPlugin('test-plugin');

      expect(registry.hasRule('plugin-rule')).toBe(true);
    });

    it('should throw error for invalid plugin module', async () => {
      // Mock importPlugin method failure
      vi.spyOn(loader as any, 'importPlugin').mockRejectedValue(new Error('Module not found'));

      await expect(loader.loadPlugin('invalid-plugin')).rejects.toThrow();
    });

    it('should throw error for plugin without required exports', async () => {
      const invalidPlugin = {
        name: 'invalid-plugin',
        version: '1.0.0',
        // Missing rules array
      };

      vi.spyOn(loader as any, 'importPlugin').mockResolvedValue({ default: invalidPlugin });

      await expect(loader.loadPlugin('invalid-plugin')).rejects.toThrow(
        'Plugin "invalid-plugin" must export a rules array'
      );
    });
  });

  describe('loadPluginsFromConfig', () => {
    it('should load multiple plugins from configuration', async () => {
      const config: PluginConfig[] = [
        { name: 'plugin-1', enabled: true },
        { name: 'plugin-2', enabled: true },
        { name: 'plugin-3', enabled: false }, // Should be skipped
      ];

      const rule1 = new MockPluginRule('plugin-1-rule');
      const rule2 = new MockPluginRule('plugin-2-rule');
      
      const mockPlugin1 = {
        name: 'plugin-1',
        version: '1.0.0',
        rules: [rule1],
      };

      const mockPlugin2 = {
        name: 'plugin-2',
        version: '1.0.0',
        rules: [rule2],
      };

      vi.spyOn(loader as any, 'importPlugin')
        .mockImplementation((moduleName: string) => {
          if (moduleName === 'plugin-1') return Promise.resolve({ default: mockPlugin1 });
          if (moduleName === 'plugin-2') return Promise.resolve({ default: mockPlugin2 });
          return Promise.reject(new Error('Module not found'));
        });

      const results = await loader.loadPluginsFromConfig(config);

      expect(results.loaded).toHaveLength(2);
      expect(results.failed).toHaveLength(0);
      expect(results.loaded).toContain('plugin-1');
      expect(results.loaded).toContain('plugin-2');
    });

    it('should handle mix of successful and failed plugin loads', async () => {
      const config: PluginConfig[] = [
        { name: 'valid-plugin', enabled: true },
        { name: 'invalid-plugin', enabled: true },
      ];

      const mockPlugin = {
        name: 'valid-plugin',
        version: '1.0.0',
        rules: [new MockPluginRule()],
      };

      vi.spyOn(loader as any, 'importPlugin')
        .mockImplementation((moduleName: string) => {
          if (moduleName === 'valid-plugin') return Promise.resolve({ default: mockPlugin });
          return Promise.reject(new Error('Module not found'));
        });

      const results = await loader.loadPluginsFromConfig(config);

      expect(results.loaded).toHaveLength(1);
      expect(results.failed).toHaveLength(1);
      expect(results.loaded[0]).toBe('valid-plugin');
      expect(results.failed[0]).toEqual({
        name: 'invalid-plugin',
        error: expect.any(Error),
      });
    });
  });

  describe('isPluginLoaded', () => {
    it('should return true for loaded plugin', async () => {
      const mockPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        rules: [new MockPluginRule()],
      };

      vi.spyOn(loader as any, 'importPlugin').mockResolvedValue({ default: mockPlugin });

      await loader.loadPlugin('test-plugin');

      expect(loader.isPluginLoaded('test-plugin')).toBe(true);
    });

    it('should return false for unloaded plugin', () => {
      expect(loader.isPluginLoaded('non-existent')).toBe(false);
    });
  });
});