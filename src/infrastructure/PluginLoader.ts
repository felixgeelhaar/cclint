import type { Plugin, PluginModule } from '../domain/CustomRule.js';
import type { RuleRegistry } from './RuleRegistry.js';
import type { PluginConfig } from '../domain/Config.js';
import { PluginSandbox } from './security/PluginSandbox.js';
import { PathValidator } from './security/PathValidator.js';

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
  private sandbox: PluginSandbox;
  private pathValidator: PathValidator;
  private trustedPlugins: Set<string>;

  constructor(registry: RuleRegistry) {
    this.registry = registry;
    this.sandbox = new PluginSandbox({
      timeout: 5000,
      maxMemory: 128,
      allowNetwork: false,
      allowFileSystem: false,
    });
    this.pathValidator = new PathValidator(['.js', '.mjs', '.cjs', '.ts']);
    this.trustedPlugins = new Set([
      '@cclint/core-rules',
      '@cclint/typescript-rules',
      '@cclint/python-rules',
    ]);
  }

  /**
   * Dynamic import wrapper with security checks
   */
  protected async importPlugin(pluginName: string): Promise<PluginModule> {
    // Check if plugin is from trusted source
    const isTrusted = this.isPluginTrusted(pluginName);
    
    if (!isTrusted) {
      // For untrusted plugins, validate the import path
      if (pluginName.startsWith('.') || pluginName.startsWith('/')) {
        // Local file import - validate path
        try {
          const safePath = this.pathValidator.validatePath(pluginName);
          if (!this.pathValidator.isValidFile(safePath)) {
            throw new Error(`Plugin file not found: ${pluginName}`);
          }
        } catch (error) {
          throw new Error(`Invalid plugin path: ${pluginName}`);
        }
      } else if (!pluginName.startsWith('@cclint/')) {
        // Third-party plugin - require explicit trust
        console.warn(`⚠️  Loading untrusted plugin: ${pluginName}`);
        console.warn('Consider adding it to trusted plugins if from a known source');
      }
    }

    try {
      return await import(pluginName);
    } catch (error) {
      throw new Error(`Failed to import plugin ${pluginName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a plugin is from a trusted source
   */
  private isPluginTrusted(pluginName: string): boolean {
    // Check explicit trust list
    if (this.trustedPlugins.has(pluginName)) {
      return true;
    }

    // Check if it's an official @cclint plugin
    if (pluginName.startsWith('@cclint/') || pluginName.startsWith('@felixgeelhaar/cclint-')) {
      return true;
    }

    return false;
  }

  /**
   * Load a single plugin by name
   * @param pluginName The name/path of the plugin to load
   * @param options Optional configuration for the plugin
   */
  public async loadPlugin(
    pluginName: string,
    _options?: Record<string, unknown>
  ): Promise<void> {
    // Check if plugin is already loaded
    if (this.isPluginNameLoaded(pluginName)) {
      console.warn(`Plugin "${pluginName}" is already loaded`);
      return;
    }

    let plugin: Plugin | undefined;
    
    try {
      // Dynamic import of the plugin module with security checks
      const pluginModule: PluginModule = await this.importPlugin(pluginName);
      
      if (!pluginModule || typeof pluginModule !== 'object') {
        throw new Error(`Invalid plugin module structure`);
      }

      plugin = pluginModule.default;

      if (!plugin) {
        throw new Error(`Plugin does not export a default plugin object`);
      }

      // Validate plugin structure and security
      this.validatePlugin(plugin, pluginName);

      // Check for malicious patterns in plugin code
      this.checkPluginSecurity(plugin);

      // Register all rules from the plugin with error handling
      let registeredRules = 0;
      const failedRules: string[] = [];

      for (const rule of plugin.rules) {
        try {
          this.registry.registerRule(rule, plugin.name);
          registeredRules++;
        } catch (ruleError) {
          failedRules.push(rule.id);
          console.error(`Failed to register rule "${rule.id}":`, ruleError);
        }
      }

      if (registeredRules === 0) {
        throw new Error(`No rules could be registered from plugin`);
      }

      // Store the loaded plugin
      this.loadedPlugins.set(plugin.name, plugin);

      // Log success with details
      if (failedRules.length > 0) {
        console.warn(
          `⚠️  Loaded plugin: ${plugin.name} (${registeredRules}/${plugin.rules.length} rules registered)`
        );
        console.warn(`   Failed rules: ${failedRules.join(', ')}`);
      } else {
        console.log(
          `✅ Loaded plugin: ${plugin.name} (${registeredRules} rules)`
        );
      }
    } catch (error) {
      // Provide detailed error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const detailedError = new Error(
        `Failed to load plugin "${pluginName}": ${errorMessage}`
      );
      
      // Add plugin name to error for better debugging
      (detailedError as any).pluginName = pluginName;
      (detailedError as any).originalError = error;

      console.error(`❌ ${detailedError.message}`);
      
      // Clean up any partial registration
      if (plugin?.name) {
        this.registry.unregisterPlugin(plugin.name);
      }
      
      throw detailedError;
    }
  }

  /**
   * Check if a plugin name is already loaded
   */
  private isPluginNameLoaded(pluginName: string): boolean {
    // Check if the exact plugin name is loaded
    for (const [name, _] of this.loadedPlugins) {
      if (name === pluginName) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check plugin for potential security issues
   */
  private checkPluginSecurity(plugin: Plugin): void {
    // Check for suspicious rule patterns
    for (const rule of plugin.rules) {
      // Check if rule tries to access dangerous globals
      const ruleCode = rule.lint.toString();
      const dangerousPatterns = [
        /eval\s*\(/,
        /Function\s*\(/,
        /require\s*\(\s*['"`]child_process/,
        /require\s*\(\s*['"`]fs/,
        /process\s*\.\s*exit/,
        /__dirname/,
        /__filename/,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(ruleCode)) {
          console.warn(
            `⚠️  Security Warning: Rule "${rule.id}" contains potentially dangerous pattern: ${pattern}`
          );
        }
      }
    }
  }

  /**
   * Load multiple plugins from configuration
   * @param pluginConfigs Array of plugin configurations
   * @returns Result object with loaded and failed plugins
   */
  public async loadPluginsFromConfig(
    pluginConfigs: PluginConfig[]
  ): Promise<PluginLoadResult> {
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
  public async reloadPlugin(
    pluginName: string,
    _options?: Record<string, unknown>
  ): Promise<void> {
    if (this.isPluginLoaded(pluginName)) {
      this.unloadPlugin(pluginName);
    }
    await this.loadPlugin(pluginName, _options);
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
        throw new Error(
          `Rule in plugin "${pluginName}" must have an id property`
        );
      }

      if (!rule.description) {
        throw new Error(
          `Rule "${rule.id}" in plugin "${pluginName}" must have a description`
        );
      }

      if (typeof rule.lint !== 'function') {
        throw new Error(
          `Rule "${rule.id}" in plugin "${pluginName}" must implement lint() method`
        );
      }

      if (typeof rule.generateFixes !== 'function') {
        throw new Error(
          `Rule "${rule.id}" in plugin "${pluginName}" must implement generateFixes() method`
        );
      }
    }

    // Check for duplicate rule IDs within the plugin
    const ruleIds = new Set<string>();
    for (const rule of plugin.rules) {
      if (ruleIds.has(rule.id)) {
        throw new Error(
          `Plugin "${pluginName}" has duplicate rule ID: ${rule.id}`
        );
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
    const pluginDetails = Array.from(this.loadedPlugins.entries()).map(
      ([name, plugin]) => ({
        name,
        version: plugin.version,
        rules: plugin.rules.length,
      })
    );

    return {
      loadedPlugins: this.loadedPlugins.size,
      totalRulesFromPlugins: pluginDetails.reduce(
        (sum, plugin) => sum + plugin.rules,
        0
      ),
      pluginDetails,
    };
  }
}
