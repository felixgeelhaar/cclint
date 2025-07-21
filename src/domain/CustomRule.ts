import type { Rule } from './Rule.js';
import type { ContextFile } from './ContextFile.js';
import type { Violation } from './Violation.js';
import type { Fix } from './AutoFix.js';

/**
 * Abstract base class for custom rules
 * Provides a foundation for implementing custom validation logic
 */
export abstract class CustomRule implements Rule {
  public readonly id: string;
  public readonly description: string;
  public readonly category: string | undefined;
  public readonly version: string | undefined;

  constructor(
    id: string,
    description: string,
    options?: {
      category?: string;
      version?: string;
    }
  ) {
    this.id = id;
    this.description = description;
    this.category = options?.category;
    this.version = options?.version;
  }

  /**
   * Main linting method that calls the internal validation
   * This provides a consistent interface while allowing custom implementation
   */
  public lint(file: ContextFile): Violation[] {
    return this.validateInternal(file);
  }

  /**
   * Internal validation method to be implemented by custom rules
   * @param file The context file to validate
   * @returns Array of violations found
   */
  protected abstract validateInternal(file: ContextFile): Violation[];

  /**
   * Generate auto-fixes for violations created by this rule
   * @param violations Array of violations to fix
   * @param content Original file content
   * @returns Array of fixes to apply
   */
  public abstract generateFixes(
    violations: Violation[],
    content: string
  ): Fix[];

  /**
   * Validate rule configuration options
   * Override this method to add custom configuration validation
   */
  public validateOptions(_options: Record<string, unknown>): boolean {
    // Default implementation accepts any options
    return true;
  }

  /**
   * Get rule metadata for documentation and tooling
   */
  public getMetadata(): {
    id: string;
    description: string;
    category: string | undefined;
    version: string | undefined;
    hasAutoFix: boolean;
  } {
    return {
      id: this.id,
      description: this.description,
      category: this.category,
      version: this.version,
      hasAutoFix: true, // All custom rules support auto-fix by default
    };
  }
}

/**
 * Interface for plugin exports
 * Plugins must export an object conforming to this interface
 */
export interface Plugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  rules: CustomRule[];
  dependencies?: string[];
}

/**
 * Type for plugin module exports
 */
export interface PluginModule {
  default: Plugin;
}
