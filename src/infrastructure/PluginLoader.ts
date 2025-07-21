import type { Plugin, PluginModule } from '../domain/CustomRule.js';
import type { RuleRegistry } from './RuleRegistry.js';
import type { PluginConfig } from '../domain/Config.js';

/**
 * Result of plugin loading operation
 */
export interface PluginLoadResult {
  loaded: string[];
  failed: Array<{
    name: string;
    error: Error;
  }>;
}

/**
 * Handles dynamic loading and management of custom rule plugins
 */
export class PluginLoader {
  private loadedPlugins: Map<string, Plugin> = new Map();
  private registry: RuleRegistry;

  constructor(registry: RuleRegistry) {
    this.registry = registry;
  }

  /**
   * Dynamic import wrapper for testing
   */
  protected async importPlugin(pluginName: string): Promise<PluginModule> {
    return import(pluginName);
  }

  /**
   * Load a single plugin by name
   * @param pluginName The name/path of the plugin to load
   * @param options Optional configuration for the plugin
   */
  public async loadPlugin(pluginName: string, options?: Record<string, unknown>): Promise<void> {
    try {
      // Dynamic import of the plugin module
      const pluginModule: PluginModule = await this.importPlugin(pluginName);
      const plugin = pluginModule.default;

      if (!plugin) {
        throw new Error(`Plugin "${pluginName}" does not export a default plugin object`);
      }

      this.validatePlugin(plugin, pluginName);

      // Register all rules from the plugin
      for (const rule of plugin.rules) {
        this.registry.registerRule(rule, plugin.name);
      }

      // Store the loaded plugin
      this.loadedPlugins.set(plugin.name, plugin);

      console.log(`✅ Loaded plugin: ${plugin.name} (${plugin.rules.length} rules)`);
    } catch (error) {
      console.error(`❌ Failed to load plugin "${pluginName}":`, error);
      throw error;
    }
  }

  /**
   * Load multiple plugins from configuration
   * @param pluginConfigs Array of plugin configurations
   * @returns Result object with loaded and failed plugins
   */
  public async loadPluginsFromConfig(pluginConfigs: PluginConfig[]): Promise<PluginLoadResult> {
    const result: PluginLoadResult = {
      loaded: [],
      failed: [],
    };

    const enabledPlugins = pluginConfigs.filter(config => config.enabled);

    for (const config of enabledPlugins) {
      try {
        await this.loadPlugin(config.name, config.options);
        result.loaded.push(config.name);
      } catch (error) {
        result.failed.push({
          name: config.name,
          error: error as Error,
        });
      }
    }

    return result;
  }

  /**
   * Unload a plugin and all its rules
   * @param pluginName The name of the plugin to unload
   */
  public unloadPlugin(pluginName: string): void {
    if (!this.loadedPlugins.has(pluginName)) {
      console.warn(`Plugin "${pluginName}" is not loaded`);
      return;
    }

    // Unregister all rules from this plugin
    this.registry.unregisterPlugin(pluginName);

    // Remove from loaded plugins
    this.loadedPlugins.delete(pluginName);

    console.log(`🗑️ Unloaded plugin: ${pluginName}`);
  }

  /**
   * Check if a plugin is currently loaded
   * @param pluginName The name of the plugin to check
   * @returns True if the plugin is loaded
   */
  public isPluginLoaded(pluginName: string): boolean {
    return this.loadedPlugins.has(pluginName);
  }

  /**
   * Get information about a loaded plugin
   * @param pluginName The name of the plugin
   * @returns Plugin information or undefined if not loaded
   */
  public getPluginInfo(pluginName: string): Plugin | undefined {
    return this.loadedPlugins.get(pluginName);
  }

  /**
   * Get all loaded plugin names
   * @returns Array of loaded plugin names
   */
  public getLoadedPlugins(): string[] {
    return Array.from(this.loadedPlugins.keys());
  }

  /**
   * Reload a plugin (unload and load again)
   * @param pluginName The name of the plugin to reload
   * @param options Optional new configuration
   */
  public async reloadPlugin(pluginName: string, options?: Record<string, unknown>): Promise<void> {
    if (this.isPluginLoaded(pluginName)) {
      this.unloadPlugin(pluginName);
    }
    await this.loadPlugin(pluginName, options);
  }

  /**
   * Validate plugin structure and requirements
   * @param plugin The plugin to validate
   * @param pluginName The name of the plugin for error messages
   */
  private validatePlugin(plugin: Plugin, pluginName: string): void {
    if (!plugin.name) {
      throw new Error(`Plugin "${pluginName}" must have a name property`);
    }

    if (!plugin.version) {
      throw new Error(`Plugin "${pluginName}" must have a version property`);
    }

    if (!Array.isArray(plugin.rules)) {
      throw new Error(`Plugin "${pluginName}" must export a rules array`);
    }

    if (plugin.rules.length === 0) {
      throw new Error(`Plugin "${pluginName}" must provide at least one rule`);
    }

    // Validate each rule
    for (const rule of plugin.rules) {
      if (!rule.id) {
        throw new Error(`Rule in plugin "${pluginName}" must have an id property`);
      }

      if (!rule.description) {
        throw new Error(`Rule "${rule.id}" in plugin "${pluginName}" must have a description`);
      }

      if (typeof rule.lint !== 'function') {
        throw new Error(`Rule "${rule.id}" in plugin "${pluginName}" must implement lint() method`);
      }

      if (typeof rule.generateFixes !== 'function') {
        throw new Error(`Rule "${rule.id}" in plugin "${pluginName}" must implement generateFixes() method`);
      }
    }

    // Check for duplicate rule IDs within the plugin
    const ruleIds = new Set<string>();
    for (const rule of plugin.rules) {
      if (ruleIds.has(rule.id)) {
        throw new Error(`Plugin "${pluginName}" has duplicate rule ID: ${rule.id}`);
      }
      ruleIds.add(rule.id);
    }
  }

  /**
   * Get statistics about loaded plugins
   */
  public getStats(): {
    loadedPlugins: number;
    totalRulesFromPlugins: number;
    pluginDetails: Array<{
      name: string;
      version: string;
      rules: number;
    }>;
  } {
    const pluginDetails = Array.from(this.loadedPlugins.entries()).map(([name, plugin]) => ({
      name,
      version: plugin.version,
      rules: plugin.rules.length,
    }));

    return {
      loadedPlugins: this.loadedPlugins.size,
      totalRulesFromPlugins: pluginDetails.reduce((sum, plugin) => sum + plugin.rules, 0),
      pluginDetails,
    };
  }
}