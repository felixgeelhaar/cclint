import { describe, it, expect, beforeEach } from 'vitest';
import { RuleRegistry } from '../../../src/infrastructure/RuleRegistry.js';
import { CustomRule } from '../../../src/domain/CustomRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Violation } from '../../../src/domain/Violation.js';
import { Location } from '../../../src/domain/Location.js';
import { Severity } from '../../../src/domain/Severity.js';
import type { Fix } from '../../../src/domain/AutoFix.js';

class MockCustomRule extends CustomRule {
  constructor(id: string = 'mock-rule') {
    super(id, 'Mock rule for testing');
  }

  protected validateInternal(_file: ContextFile): Violation[] {
    return [];
  }

  generateFixes(_violations: Violation[], _content: string): Fix[] {
    return [];
  }
}

describe('RuleRegistry', () => {
  let registry: RuleRegistry;

  beforeEach(() => {
    registry = new RuleRegistry();
  });

  describe('registerRule', () => {
    it('should register a custom rule', () => {
      const rule = new MockCustomRule('test-rule');
      
      registry.registerRule(rule);
      
      expect(registry.hasRule('test-rule')).toBe(true);
      expect(registry.getRule('test-rule')).toBe(rule);
    });

    it('should throw error when registering duplicate rule ID', () => {
      const rule1 = new MockCustomRule('duplicate');
      const rule2 = new MockCustomRule('duplicate');
      
      registry.registerRule(rule1);
      
      expect(() => registry.registerRule(rule2)).toThrow(
        'Rule with ID "duplicate" is already registered'
      );
    });
  });

  describe('getRule', () => {
    it('should return registered rule', () => {
      const rule = new MockCustomRule('test-rule');
      registry.registerRule(rule);
      
      const retrieved = registry.getRule('test-rule');
      
      expect(retrieved).toBe(rule);
    });

    it('should return undefined for unregistered rule', () => {
      const result = registry.getRule('non-existent');
      
      expect(result).toBeUndefined();
    });
  });

  describe('getAllRules', () => {
    it('should return all registered rules', () => {
      const rule1 = new MockCustomRule('rule-1');
      const rule2 = new MockCustomRule('rule-2');
      
      registry.registerRule(rule1);
      registry.registerRule(rule2);
      
      const allRules = registry.getAllRules();
      
      expect(allRules).toHaveLength(2);
      expect(allRules).toContain(rule1);
      expect(allRules).toContain(rule2);
    });

    it('should return empty array when no rules registered', () => {
      const allRules = registry.getAllRules();
      
      expect(allRules).toHaveLength(0);
    });
  });

  describe('unregisterRule', () => {
    it('should unregister a rule', () => {
      const rule = new MockCustomRule('test-rule');
      registry.registerRule(rule);
      
      registry.unregisterRule('test-rule');
      
      expect(registry.hasRule('test-rule')).toBe(false);
    });

    it('should not throw error when unregistering non-existent rule', () => {
      expect(() => registry.unregisterRule('non-existent')).not.toThrow();
    });
  });

  describe('getRulesByCategory', () => {
    it('should return rules filtered by category', () => {
      const contentRule = new MockCustomRule('content-rule', 'content');
      const formatRule = new MockCustomRule('format-rule', 'format');
      
      registry.registerRule(contentRule);
      registry.registerRule(formatRule);
      
      const contentRules = registry.getRulesByCategory('content');
      
      expect(contentRules).toHaveLength(1);
      expect(contentRules[0]).toBe(contentRule);
    });
  });
});