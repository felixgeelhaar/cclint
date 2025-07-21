import type { Rule } from '../domain/Rule.js';
import type { CustomRule } from '../domain/CustomRule.js';

/**
 * Central registry for all rules (built-in and custom)
 * Manages rule registration, lookup, and lifecycle
 */
export class RuleRegistry {
  private rules: Map<string, Rule> = new Map();
  private plugins: Map<string, string> = new Map(); // rule ID -> plugin name

  /**
   * Register a custom rule
   * @param rule The rule to register
   * @param pluginName Optional plugin name that provides this rule
   */
  public registerRule(rule: Rule, pluginName?: string): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule with ID "${rule.id}" is already registered`);
    }

    this.rules.set(rule.id, rule);
    
    if (pluginName) {
      this.plugins.set(rule.id, pluginName);
    }
  }

  /**
   * Get a rule by its ID
   * @param ruleId The ID of the rule to retrieve
   * @returns The rule or undefined if not found
   */
  public getRule(ruleId: string): Rule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Check if a rule is registered
   * @param ruleId The ID of the rule to check
   * @returns True if the rule is registered
   */
  public hasRule(ruleId: string): boolean {
    return this.rules.has(ruleId);
  }

  /**
   * Get all registered rules
   * @returns Array of all registered rules
   */
  public getAllRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules filtered by category
   * @param category The category to filter by
   * @returns Array of rules in the specified category
   */
  public getRulesByCategory(category: string): Rule[] {
    return this.getAllRules().filter(rule => 
      (rule as CustomRule).category === category
    );
  }

  /**
   * Get rules provided by a specific plugin
   * @param pluginName The name of the plugin
   * @returns Array of rules from the specified plugin
   */
  public getRulesByPlugin(pluginName: string): Rule[] {
    const ruleIds = Array.from(this.plugins.entries())
      .filter(([, plugin]) => plugin === pluginName)
      .map(([ruleId]) => ruleId);
    
    return ruleIds
      .map(id => this.rules.get(id))
      .filter((rule): rule is Rule => rule !== undefined);
  }

  /**
   * Unregister a rule
   * @param ruleId The ID of the rule to unregister
   */
  public unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.plugins.delete(ruleId);
  }

  /**
   * Unregister all rules from a plugin
   * @param pluginName The name of the plugin
   */
  public unregisterPlugin(pluginName: string): void {
    const ruleIds = Array.from(this.plugins.entries())
      .filter(([, plugin]) => plugin === pluginName)
      .map(([ruleId]) => ruleId);
    
    ruleIds.forEach(ruleId => {
      this.rules.delete(ruleId);
      this.plugins.delete(ruleId);
    });
  }

  /**
   * Get plugin name for a rule
   * @param ruleId The ID of the rule
   * @returns The plugin name or undefined if it's a built-in rule
   */
  public getPluginForRule(ruleId: string): string | undefined {
    return this.plugins.get(ruleId);
  }

  /**
   * Get registry statistics
   * @returns Object containing registry statistics
   */
  public getStats(): {
    totalRules: number;
    customRules: number;
    builtInRules: number;
    pluginCount: number;
  } {
    const totalRules = this.rules.size;
    const customRules = Array.from(this.rules.values())
      .filter(rule => rule.constructor.name !== 'FileSizeRule' && 
                      rule.constructor.name !== 'StructureRule' && 
                      rule.constructor.name !== 'ContentRule' && 
                      rule.constructor.name !== 'FormatRule').length;
    const builtInRules = totalRules - customRules;
    const pluginCount = new Set(this.plugins.values()).size;

    return {
      totalRules,
      customRules,
      builtInRules,
      pluginCount,
    };
  }

  /**
   * Clear all registered rules
   * Used primarily for testing
   */
  public clear(): void {
    this.rules.clear();
    this.plugins.clear();
  }
}