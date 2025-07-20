import type { Rule } from './Rule.js';
import { ContextFile } from './ContextFile.js';
import { LintingResult } from './LintingResult.js';

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

  public getRuleById(ruleId: string): Rule | undefined {
    return this._rules.get(ruleId);
  }

  public hasRule(ruleId: string): boolean {
    return this._rules.has(ruleId);
  }
}
