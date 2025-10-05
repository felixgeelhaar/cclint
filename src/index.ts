/**
 * CC Linter - A comprehensive linter for CLAUDE.md files
 *
 * @packageDocumentation
 *
 * ## Overview
 *
 * CC Linter validates and optimizes CLAUDE.md context files for Claude AI.
 * Built with TypeScript following hexagonal architecture principles.
 *
 * ## Core Concepts
 *
 * - **ContextFile**: In-memory representation of a file being linted
 * - **Rule**: Self-contained validation logic
 * - **Violation**: A broken rule with location and severity
 * - **RulesEngine**: Aggregates rules and runs validation
 * - **LintingResult**: Complete validation results for a file
 *
 * ## Basic Usage
 *
 * ```typescript
 * import { ContextFile, RulesEngine, FileSizeRule } from '@felixgeelhaar/cclint';
 *
 * // Create a context file
 * const file = ContextFile.fromFile('CLAUDE.md');
 *
 * // Set up rules
 * const rules = [new FileSizeRule(10000)];
 * const engine = new RulesEngine(rules);
 *
 * // Run linting
 * const result = engine.lint(file);
 *
 * console.log(`Errors: ${result.errorCount}`);
 * console.log(`Warnings: ${result.warningCount}`);
 * ```
 *
 * @see {@link https://github.com/felixgeelhaar/cclint | GitHub Repository}
 * @see {@link https://www.npmjs.com/package/@felixgeelhaar/cclint | npm Package}
 */

// Domain Model - Core business logic
export { ContextFile } from './domain/ContextFile.js';
export { RulesEngine } from './domain/RulesEngine.js';
export { LintingResult } from './domain/LintingResult.js';
export { Violation } from './domain/Violation.js';
export { Location } from './domain/Location.js';
export { Severity } from './domain/Severity.js';
export type { Rule } from './domain/Rule.js';
export type {
  CclintConfig,
  RuleConfig,
  PluginConfig,
} from './domain/Config.js';

// Built-in Rules
export { FileSizeRule } from './rules/FileSizeRule.js';
export { StructureRule } from './rules/StructureRule.js';
export { FormatRule } from './rules/FormatRule.js';
export { CodeBlockRule } from './rules/CodeBlockRule.js';

// New rules (v0.5.0+)
export { ImportSyntaxRule } from './rules/ImportSyntaxRule.js';
export { ContentOrganizationRule } from './rules/ContentOrganizationRule.js';
export { FileLocationRule } from './rules/FileLocationRule.js';

// New rules (v0.6.0+) - 10/10 Anthropic Alignment
export { ImportResolutionRule } from './rules/ImportResolutionRule.js';
export { ContentAppropriatenessRule } from './rules/ContentAppropriatenessRule.js';
export { MonorepoHierarchyRule } from './rules/MonorepoHierarchyRule.js';
export { CommandSafetyRule } from './rules/CommandSafetyRule.js';

// Deprecated rules (use alternatives)
/** @deprecated Use ContentOrganizationRule instead - ContentRule is too opinionated with technology-specific checks */
export { ContentRule } from './rules/ContentRule.js';

// Custom Rules API
export { CustomRule } from './domain/CustomRule.js';
export type { Plugin, PluginModule } from './domain/CustomRule.js';

// Infrastructure
export { ConfigLoader } from './infrastructure/ConfigLoader.js';
export { PluginLoader } from './infrastructure/PluginLoader.js';
export { RuleRegistry } from './infrastructure/RuleRegistry.js';
export { AutoFixer } from './infrastructure/AutoFixer.js';
export type { Fix } from './domain/AutoFix.js';

// Security
export { PluginSandbox } from './infrastructure/security/PluginSandbox.js';
export { PathValidator } from './infrastructure/security/PathValidator.js';
export type {
  PluginSecurityConfig,
  SandboxResult,
} from './infrastructure/security/PluginSandbox.js';
