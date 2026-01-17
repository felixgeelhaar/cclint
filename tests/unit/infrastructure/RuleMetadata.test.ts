import { describe, it, expect } from 'vitest';
import {
  getRuleMetadata,
  getAllRuleIds,
  isValidRule,
  RULE_METADATA,
} from '../../../src/infrastructure/RuleMetadata.js';

describe('RuleMetadata', () => {
  describe('RULE_METADATA', () => {
    it('should have metadata for all core rules', () => {
      const expectedRules = [
        'file-size',
        'structure',
        'format',
        'code-blocks',
        'import-syntax',
        'import-resolution',
        'file-location',
        'content-appropriateness',
        'monorepo-hierarchy',
        'command-safety',
        'content-organization',
      ];

      expectedRules.forEach(ruleId => {
        expect(RULE_METADATA[ruleId]).toBeDefined();
        expect(RULE_METADATA[ruleId]?.id).toBe(ruleId);
      });
    });

    it('should have required fields for each rule', () => {
      Object.values(RULE_METADATA).forEach(rule => {
        expect(rule.id).toBeTruthy();
        expect(rule.name).toBeTruthy();
        expect(rule.description).toBeTruthy();
        expect(rule.rationale).toBeTruthy();
        expect(typeof rule.fixable).toBe('boolean');
        expect(['error', 'warning', 'info']).toContain(rule.defaultSeverity);
        expect(rule.badExamples.length).toBeGreaterThan(0);
        expect(rule.goodExamples.length).toBeGreaterThan(0);
      });
    });

    it('should have valid examples with code and explanation', () => {
      Object.values(RULE_METADATA).forEach(rule => {
        rule.badExamples.forEach(example => {
          expect(example.code).toBeTruthy();
          expect(example.explanation).toBeTruthy();
        });
        rule.goodExamples.forEach(example => {
          expect(example.code).toBeTruthy();
          expect(example.explanation).toBeTruthy();
        });
      });
    });

    it('should mark fixable rules correctly', () => {
      // These rules are known to be fixable
      expect(RULE_METADATA['format']?.fixable).toBe(true);
      expect(RULE_METADATA['code-blocks']?.fixable).toBe(true);

      // These rules are not fixable
      expect(RULE_METADATA['file-size']?.fixable).toBe(false);
      expect(RULE_METADATA['structure']?.fixable).toBe(false);
    });
  });

  describe('getRuleMetadata', () => {
    it('should return metadata for valid rule', () => {
      const metadata = getRuleMetadata('format');

      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('format');
      expect(metadata?.name).toBe('Markdown Format');
    });

    it('should return undefined for invalid rule', () => {
      const metadata = getRuleMetadata('nonexistent-rule');

      expect(metadata).toBeUndefined();
    });
  });

  describe('getAllRuleIds', () => {
    it('should return array of all rule IDs', () => {
      const ruleIds = getAllRuleIds();

      expect(Array.isArray(ruleIds)).toBe(true);
      expect(ruleIds.length).toBeGreaterThan(0);
      expect(ruleIds).toContain('format');
      expect(ruleIds).toContain('structure');
      expect(ruleIds).toContain('file-size');
    });

    it('should match keys in RULE_METADATA', () => {
      const ruleIds = getAllRuleIds();
      const metadataKeys = Object.keys(RULE_METADATA);

      expect(ruleIds.sort()).toEqual(metadataKeys.sort());
    });
  });

  describe('isValidRule', () => {
    it('should return true for valid rules', () => {
      expect(isValidRule('format')).toBe(true);
      expect(isValidRule('structure')).toBe(true);
      expect(isValidRule('file-size')).toBe(true);
    });

    it('should return false for invalid rules', () => {
      expect(isValidRule('nonexistent')).toBe(false);
      expect(isValidRule('')).toBe(false);
      expect(isValidRule('FORMAT')).toBe(false); // Case sensitive
    });
  });

  describe('rule options', () => {
    it('should have options for configurable rules', () => {
      const fileSizeRule = getRuleMetadata('file-size');
      expect(fileSizeRule?.options).toBeDefined();
      expect(fileSizeRule?.options?.length).toBeGreaterThan(0);
      expect(fileSizeRule?.options?.[0]?.name).toBe('maxSize');
    });

    it('should have valid option definitions', () => {
      Object.values(RULE_METADATA).forEach(rule => {
        if (rule.options) {
          rule.options.forEach(option => {
            expect(option.name).toBeTruthy();
            expect(option.type).toBeTruthy();
            expect(option.default).toBeDefined();
            expect(option.description).toBeTruthy();
          });
        }
      });
    });
  });

  describe('related rules', () => {
    it('should reference valid rules in related array', () => {
      Object.values(RULE_METADATA).forEach(rule => {
        if (rule.related) {
          rule.related.forEach(relatedId => {
            expect(isValidRule(relatedId)).toBe(true);
          });
        }
      });
    });
  });
});
