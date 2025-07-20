import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import type { CclintConfig } from '../domain/Config.js';
import { defaultConfig } from '../domain/Config.js';

export class ConfigLoader {
  private static readonly CONFIG_FILES = [
    '.cclintrc.json',
    '.cclintrc.js',
    'cclint.config.js',
    'package.json',
  ];

  static load(startDir: string = process.cwd()): CclintConfig {
    const configPath = this.findConfigFile(startDir);
    
    if (!configPath) {
      return defaultConfig;
    }

    try {
      const config = this.loadConfigFile(configPath);
      return this.mergeWithDefaults(config);
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${configPath}:`, error instanceof Error ? error.message : error);
      return defaultConfig;
    }
  }

  private static findConfigFile(startDir: string): string | null {
    let currentDir = startDir;

    while (currentDir !== dirname(currentDir)) {
      for (const configFile of this.CONFIG_FILES) {
        const configPath = join(currentDir, configFile);
        if (existsSync(configPath)) {
          return configPath;
        }
      }
      currentDir = dirname(currentDir);
    }

    return null;
  }

  private static loadConfigFile(configPath: string): Partial<CclintConfig> {
    if (configPath.endsWith('package.json')) {
      const packageJson = JSON.parse(readFileSync(configPath, 'utf8'));
      return packageJson.cclint || {};
    }

    if (configPath.endsWith('.json')) {
      return JSON.parse(readFileSync(configPath, 'utf8'));
    }

    // For .js files, we'd need dynamic import, but keeping it simple for now
    throw new Error('JavaScript config files not yet supported');
  }

  private static mergeWithDefaults(config: Partial<CclintConfig>): CclintConfig {
    const merged: CclintConfig = {
      ...defaultConfig,
      ...config,
      rules: {
        ...defaultConfig.rules,
        ...config.rules,
      },
    };

    // Deep merge rule options
    if (config.rules) {
      for (const [ruleName, ruleConfig] of Object.entries(config.rules)) {
        if (ruleConfig && defaultConfig.rules[ruleName as keyof typeof defaultConfig.rules]) {
          merged.rules[ruleName as keyof typeof merged.rules] = {
            ...defaultConfig.rules[ruleName as keyof typeof defaultConfig.rules],
            ...ruleConfig,
            options: {
              ...((defaultConfig.rules[ruleName as keyof typeof defaultConfig.rules]?.options) || {}),
              ...((ruleConfig.options) || {}),
            },
          };
        }
      }
    }

    return merged;
  }
}