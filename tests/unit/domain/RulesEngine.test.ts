import { describe, it, expect } from 'vitest';
import { RulesEngine } from '../../../src/domain/RulesEngine.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Rule } from '../../../src/domain/Rule.js';
import { Violation } from '../../../src/domain/Violation.js';
import { Location } from '../../../src/domain/Location.js';
import { Severity } from '../../../src/domain/Severity.js';

class MockRule implements Rule {
  constructor(
    public readonly id: string,
    public readonly description: string,
    private readonly violations: Violation[]
  ) {}

  lint(_file: ContextFile): Violation[] {
    return this.violations;
  }
}

describe('RulesEngine', () => {
  describe('constructor', () => {
    it('should create engine with rules', () => {
      const rule1 = new MockRule('rule1', 'Description 1', []);
      const rule2 = new MockRule('rule2', 'Description 2', []);
      const engine = new RulesEngine([rule1, rule2]);

      expect(engine.rules).toHaveLength(2);
      expect(engine.rules).toContain(rule1);
      expect(engine.rules).toContain(rule2);
    });

    it('should create engine with no rules', () => {
      const engine = new RulesEngine([]);

      expect(engine.rules).toHaveLength(0);
    });

    it('should throw error for duplicate rule IDs', () => {
      const rule1 = new MockRule('duplicate', 'Description 1', []);
      const rule2 = new MockRule('duplicate', 'Description 2', []);

      expect(() => new RulesEngine([rule1, rule2]))
        .toThrow('Duplicate rule ID: duplicate');
    });
  });

  describe('lint', () => {
    it('should aggregate violations from all rules', () => {
      const violation1 = new Violation('rule1', 'Error 1', Severity.ERROR, new Location(1, 1));
      const violation2 = new Violation('rule2', 'Warning 1', Severity.WARNING, new Location(2, 1));
      const violation3 = new Violation('rule1', 'Error 2', Severity.ERROR, new Location(3, 1));

      const rule1 = new MockRule('rule1', 'Rule 1', [violation1, violation3]);
      const rule2 = new MockRule('rule2', 'Rule 2', [violation2]);
      const rule3 = new MockRule('rule3', 'Rule 3', []);

      const engine = new RulesEngine([rule1, rule2, rule3]);
      const file = new ContextFile('/test/CLAUDE.md', '# Test\nContent');
      const result = engine.lint(file);

      expect(result.file).toBe(file);
      expect(result.violations).toHaveLength(3);
      expect(result.violations).toContain(violation1);
      expect(result.violations).toContain(violation2);
      expect(result.violations).toContain(violation3);
    });

    it('should return empty result when no rules have violations', () => {
      const rule1 = new MockRule('rule1', 'Rule 1', []);
      const rule2 = new MockRule('rule2', 'Rule 2', []);

      const engine = new RulesEngine([rule1, rule2]);
      const file = new ContextFile('/test/CLAUDE.md', '# Test');
      const result = engine.lint(file);

      expect(result.hasViolations()).toBe(false);
    });

    it('should handle engine with no rules', () => {
      const engine = new RulesEngine([]);
      const file = new ContextFile('/test/CLAUDE.md', '# Test');
      const result = engine.lint(file);

      expect(result.hasViolations()).toBe(false);
    });
  });

  describe('getRuleById', () => {
    it('should return rule by ID', () => {
      const rule1 = new MockRule('rule1', 'Rule 1', []);
      const rule2 = new MockRule('rule2', 'Rule 2', []);
      const engine = new RulesEngine([rule1, rule2]);

      expect(engine.getRuleById('rule1')).toBe(rule1);
      expect(engine.getRuleById('rule2')).toBe(rule2);
    });

    it('should return undefined for unknown rule ID', () => {
      const rule1 = new MockRule('rule1', 'Rule 1', []);
      const engine = new RulesEngine([rule1]);

      expect(engine.getRuleById('unknown')).toBeUndefined();
    });
  });

  describe('hasRule', () => {
    it('should check if rule exists', () => {
      const rule1 = new MockRule('rule1', 'Rule 1', []);
      const engine = new RulesEngine([rule1]);

      expect(engine.hasRule('rule1')).toBe(true);
      expect(engine.hasRule('unknown')).toBe(false);
    });
  });
});