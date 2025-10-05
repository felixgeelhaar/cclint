import type { Rule } from './Rule.js';
import { ContextFile } from './ContextFile.js';
import { LintingResult } from './LintingResult.js';

/**
 * Core linting engine that aggregates rules and runs validation.
 *
 * @remarks
 * The RulesEngine follows the hexagonal architecture pattern, residing in the
 * domain layer. It coordinates rule execution and aggregates violations into
 * a {@link LintingResult}.
 *
 * @example
 * ```typescript
 * const rules = [
 *   new FileSizeRule(10000),
 *   new StructureRule(),
 *   new FormatRule()
 * ];
 *
 * const engine = new RulesEngine(rules);
 * const file = ContextFile.fromFile('CLAUDE.md');
 * const result = engine.lint(file);
 *
 * console.log(`Errors: ${result.errorCount}`);
 * ```
 *
 * @category Domain
 */
export class RulesEngine {
  private readonly _rules: Map<string, Rule> = new Map();

  constructor(rules: Rule[]) {
    for (const rule of rules) {
      if (this._rules.has(rule.id)) {
        throw new Error(`Duplicate rule ID: ${rule.id}`);
      }
      this._rules.set(rule.id, rule);
    }
  }

  public get rules(): Rule[] {
    return Array.from(this._rules.values());
  }

  /**
   * Lint a context file using all registered rules.
   *
   * @param file - The {@link ContextFile} to validate
   * @returns A {@link LintingResult} containing all violations found
   *
   * @remarks
   * Rules are executed in the order they were registered. Each rule's violations
   * are aggregated into a single result object.
   */
  public lint(file: ContextFile): LintingResult {
    const result = new LintingResult(file);

    for (const rule of this._rules.values()) {
      const violations = rule.lint(file);
      for (const violation of violations) {
        result.addViolation(violation);
      }
    }

    return result;
  }

  /**
   * Retrieve a rule by its ID.
   *
   * @param ruleId - The unique identifier of the rule
   * @returns The rule if found, undefined otherwise
   */
  public getRuleById(ruleId: string): Rule | undefined {
    return this._rules.get(ruleId);
  }

  /**
   * Check if a rule is registered.
   *
   * @param ruleId - The unique identifier of the rule
   * @returns True if the rule is registered
   */
  public hasRule(ruleId: string): boolean {
    return this._rules.has(ruleId);
  }
}
