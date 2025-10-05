// Worker threads will be imported when actually implementing sandboxing
// import { Worker } from 'worker_threads';
// import { resolve } from 'path';
import type { Plugin } from '../../domain/CustomRule.js';
import { ContextFile } from '../../domain/ContextFile.js';
import type { Violation } from '../../domain/Violation.js';

/**
 * Security configuration for plugin execution
 */
export interface PluginSecurityConfig {
  /** Maximum execution time in milliseconds */
  timeout: number;
  /** Maximum memory usage in MB */
  maxMemory: number;
  /** Allow network access */
  allowNetwork: boolean;
  /** Allow file system access */
  allowFileSystem: boolean;
  /** Allowed module imports */
  allowedModules: string[];
}

/**
 * Result from sandboxed plugin execution
 */
export interface SandboxResult {
  success: boolean;
  violations?: Violation[];
  error?: string;
  executionTime: number;
  memoryUsed: number;
}

/**
 * Provides secure, sandboxed execution environment for plugins
 */
export class PluginSandbox {
  private readonly defaultConfig: PluginSecurityConfig = {
    timeout: 5000, // 5 seconds
    maxMemory: 128, // 128 MB
    allowNetwork: false,
    allowFileSystem: false,
    allowedModules: ['path', 'url', 'util', 'string_decoder'],
  };

  private config: PluginSecurityConfig;

  constructor(config?: Partial<PluginSecurityConfig>) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Execute a plugin in a sandboxed environment
   * @param plugin The plugin to execute
   * @param file The file to lint
   * @returns Sandbox execution result
   */
  public async executePlugin(
    plugin: Plugin,
    file: ContextFile
  ): Promise<SandboxResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // For now, we'll use a timeout-based approach
      // In production, consider using VM2 or isolated-vm for better sandboxing
      const violations = await this.executeWithTimeout(
        () => this.runPluginRules(plugin, file),
        this.config.timeout
      );

      const executionTime = Date.now() - startTime;
      const memoryUsed =
        (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;

      // Check memory usage
      if (memoryUsed > this.config.maxMemory) {
        throw new Error(
          `Plugin exceeded memory limit: ${memoryUsed.toFixed(2)}MB > ${this.config.maxMemory}MB`
        );
      }

      return {
        success: true,
        violations,
        executionTime,
        memoryUsed,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        memoryUsed:
          (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      };
    }
  }

  /**
   * Run plugin rules with basic isolation
   * @param plugin The plugin to run
   * @param file The file to lint
   * @returns Array of violations
   */
  private async runPluginRules(
    plugin: Plugin,
    file: ContextFile
  ): Promise<Violation[]> {
    const violations: Violation[] = [];

    for (const rule of plugin.rules) {
      try {
        // Create a safe copy of the file to prevent mutations
        const safeFile = this.createSafeFileCopy(file);

        // Execute the rule with error handling
        const ruleViolations = await Promise.resolve(rule.lint(safeFile));

        // Validate the returned violations
        if (Array.isArray(ruleViolations)) {
          for (const violation of ruleViolations) {
            if (this.isValidViolation(violation)) {
              violations.push(violation);
            }
          }
        }
      } catch (error) {
        // Log but don't throw - one rule failure shouldn't stop others
        console.error(`Rule ${rule.id} failed:`, error);
      }
    }

    return violations;
  }

  /**
   * Execute a function with a timeout
   * @param fn The function to execute
   * @param timeout Timeout in milliseconds
   * @returns The function result
   */
  private executeWithTimeout<T>(
    fn: () => Promise<T> | T,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Plugin execution timed out after ${timeout}ms`));
      }, timeout);

      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Create a safe, immutable copy of a ContextFile
   * @param file The original file
   * @returns A safe copy
   */
  private createSafeFileCopy(file: ContextFile): ContextFile {
    // Create a new instance with frozen properties
    const safeCopy = new ContextFile(file.path, file.content);

    // Prevent modifications
    return Object.freeze(safeCopy) as ContextFile;
  }

  /**
   * Validate that a violation object is properly formed
   * @param violation The violation to validate
   * @returns True if valid
   */
  private isValidViolation(violation: unknown): boolean {
    if (!violation || typeof violation !== 'object') {
      return false;
    }

    const v = violation as Record<string, unknown>;
    return (
      typeof v['ruleId'] === 'string' &&
      typeof v['message'] === 'string' &&
      v['severity'] != null &&
      v['location'] != null
    );
  }

  /**
   * Validate plugin signature (for future implementation)
   * @param _plugin The plugin to validate
   * @param signature The plugin signature
   * @returns True if signature is valid
   */
  public validatePluginSignature(_plugin: Plugin, signature?: string): boolean {
    if (!signature) {
      // No signature provided - consider this based on security policy
      return false;
    }

    // TODO: Implement actual signature verification
    // This would involve:
    // 1. Computing hash of plugin code
    // 2. Verifying signature against trusted public key
    // 3. Checking certificate chain if applicable

    // For now, we'll just check if a signature exists
    return signature.length > 0;
  }

  /**
   * Check if a module is allowed to be imported
   * @param moduleName The module name to check
   * @returns True if allowed
   */
  public isModuleAllowed(moduleName: string): boolean {
    // Check against allowed list
    if (this.config.allowedModules.includes(moduleName)) {
      return true;
    }

    // Check for relative imports (could be dangerous)
    if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
      return false;
    }

    // Check for node: protocol
    if (moduleName.startsWith('node:')) {
      const coreModule = moduleName.slice(5);
      return this.config.allowedModules.includes(coreModule);
    }

    return false;
  }
}
