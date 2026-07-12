import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import type { CclintConfig, RuleConfig } from '../domain/Config.js';
import { defaultConfig } from '../domain/Config.js';
import { getPreset, type PresetConfig } from '../domain/presets.js';

type RuleMap = CclintConfig['rules'];

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
      return this.resolveConfig(config);
    } catch (error) {
      console.warn(
        `Warning: Failed to load config from ${configPath}:`,
        error instanceof Error ? error.message : error
      );
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
      const packageJson = JSON.parse(
        readFileSync(configPath, 'utf8')
      ) as Record<string, unknown>;
      return (packageJson['cclint'] as Partial<CclintConfig>) ?? {};
    }

    if (configPath.endsWith('.json')) {
      return JSON.parse(
        readFileSync(configPath, 'utf8')
      ) as Partial<CclintConfig>;
    }

    // For .js files, we'd need dynamic import, but keeping it simple for now
    throw new Error('JavaScript config files not yet supported');
  }

  /**
   * Resolve a user config into a fully merged {@link CclintConfig}.
   *
   * @remarks
   * Layering is defaults ← preset(s) in `extends` order ← user config, so the
   * user's own settings always win and presets closer to the end of an
   * `extends` array override earlier ones. `rules` are deep-merged per rule
   * (enabled/severity/options); other fields (`ignore`, `plugins`) are
   * replaced by the more specific layer. `extends` is consumed here and never
   * appears in the resolved result.
   */
  private static resolveConfig(
    userConfig: Partial<CclintConfig>
  ): CclintConfig {
    let resolved: CclintConfig = defaultConfig;

    for (const preset of this.resolveExtends(userConfig.extends)) {
      resolved = this.mergeConfigs(resolved, preset);
    }

    resolved = this.mergeConfigs(resolved, userConfig);

    // `extends` is a resolution-time directive, not runtime config: it has been
    // consumed above, so it must not leak into the merged result. `resolved` is
    // always a fresh object from mergeConfigs, so deleting here is safe.
    delete resolved.extends;
    return resolved;
  }

  /**
   * Turn an `extends` value into the ordered list of preset configs to apply.
   * Only built-in named presets are supported; an unknown name is warned about
   * and skipped so a typo degrades gracefully rather than aborting the lint.
   */
  private static resolveExtends(
    ext: string | string[] | undefined
  ): PresetConfig[] {
    if (!ext) {
      return [];
    }

    const names = Array.isArray(ext) ? ext : [ext];
    const presets: PresetConfig[] = [];

    for (const name of names) {
      const preset = getPreset(name);
      if (!preset) {
        console.warn(
          `Warning: Unknown preset "${name}" in "extends". Ignoring.`
        );
        continue;
      }
      presets.push(preset);
    }

    return presets;
  }

  /** Merge an override layer over a base config; the override always wins. */
  private static mergeConfigs(
    base: CclintConfig,
    override: Partial<CclintConfig>
  ): CclintConfig {
    return {
      ...base,
      ...override,
      rules: this.mergeRules(base.rules, override.rules),
    };
  }

  /**
   * Deep-merge two rule maps. For each rule present in either layer, the
   * override's fields win, and `options` are themselves shallow-merged so a
   * layer can tweak a single option without dropping the others.
   */
  private static mergeRules(
    base: RuleMap,
    override: RuleMap | undefined
  ): RuleMap {
    if (!override) {
      return { ...base };
    }

    const merged: RuleMap = { ...base };

    for (const [ruleId, overrideRule] of Object.entries(override)) {
      if (!overrideRule) {
        continue;
      }

      const baseRule = base[ruleId];
      const mergedRule: RuleConfig = {
        ...baseRule,
        ...overrideRule,
      };

      if (baseRule?.options || overrideRule.options) {
        mergedRule.options = {
          ...(baseRule?.options ?? {}),
          ...(overrideRule.options ?? {}),
        };
      }

      merged[ruleId] = mergedRule;
    }

    return merged;
  }
}
