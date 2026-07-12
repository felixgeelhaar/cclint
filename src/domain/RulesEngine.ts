import type { Rule } from './Rule.js';
import { ContextFile } from './ContextFile.js';
import { LintingResult } from './LintingResult.js';
import { Violation } from './Violation.js';
import type { Severity } from './Severity.js';

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
 * const file = new ContextFile('CLAUDE.md', readFileSync('CLAUDE.md', 'utf-8'));
 * const result = engine.lint(file);
 *
 * console.log(`Errors: ${result.errorCount}`);
 * ```
 *
 * @category Domain
 */
export class RulesEngine {
  private readonly _rules: Map<string, Rule> = new Map();
  private readonly _severityOverrides: ReadonlyMap<string, Severity>;

  /**
   * @param rules - the rules to run, in order
   * @param severityOverrides - optional per-rule severity (by rule id). When a
   *   rule has an override, ALL of its violations are re-emitted at that
   *   severity — the standard linter model where a rule is configured to one
   *   level (error/warning/info). This is how `config.rules.<id>.severity`
   *   takes effect.
   */
  constructor(
    rules: Rule[],
    severityOverrides?: ReadonlyMap<string, Severity>
  ) {
    for (const rule of rules) {
      if (this._rules.has(rule.id)) {
        throw new Error(`Duplicate rule ID: ${rule.id}`);
      }
      this._rules.set(rule.id, rule);
    }
    this._severityOverrides = severityOverrides ?? new Map();
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
      if (rule.appliesTo && !rule.appliesTo(file)) {
        continue;
      }

      const override = this._severityOverrides.get(rule.id);
      for (const violation of rule.lint(file)) {
        result.addViolation(
          override
            ? new Violation(
                violation.ruleId,
                violation.message,
                override,
                violation.location,
                violation.fix
              )
            : violation
        );
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
