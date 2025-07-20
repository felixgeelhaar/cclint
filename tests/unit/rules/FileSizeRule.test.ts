import { describe, it, expect } from 'vitest';
import { FileSizeRule } from '../../../src/rules/FileSizeRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('FileSizeRule', () => {
  describe('constructor', () => {
    it('should create rule with default max size', () => {
      const rule = new FileSizeRule();

      expect(rule.id).toBe('file-size');
      expect(rule.description).toContain('File size');
    });

    it('should create rule with custom max size', () => {
      const rule = new FileSizeRule(1000);

      expect(rule.id).toBe('file-size');
    });

    it('should throw error for negative max size', () => {
      expect(() => new FileSizeRule(-1))
        .toThrow('Max size must be positive');
    });

    it('should throw error for zero max size', () => {
      expect(() => new FileSizeRule(0))
        .toThrow('Max size must be positive');
    });
  });

  describe('lint', () => {
    it('should return no violations for file under size limit', () => {
      const rule = new FileSizeRule(100);
      const file = new ContextFile('/test/CLAUDE.md', 'Short content');

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should return violation for file over size limit', () => {
      const rule = new FileSizeRule(10);
      const content = 'This content is definitely longer than 10 characters';
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.ruleId).toBe('file-size');
      expect(violations[0]?.severity).toBe(Severity.WARNING);
      expect(violations[0]?.message).toContain('52 characters');
      expect(violations[0]?.message).toContain('10 characters');
      expect(violations[0]?.location.line).toBe(1);
      expect(violations[0]?.location.column).toBe(1);
    });

    it('should return violation for file exactly at size limit', () => {
      const rule = new FileSizeRule(10);
      const content = '1234567890'; // exactly 10 characters
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should handle empty file', () => {
      const rule = new FileSizeRule(10);
      const file = new ContextFile('/test/CLAUDE.md', '');

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should use default max size when not specified', () => {
      const rule = new FileSizeRule();
      const largeContent = 'x'.repeat(20000); // 20KB
      const file = new ContextFile('/test/CLAUDE.md', largeContent);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain('20000 characters');
      expect(violations[0]?.message).toContain('10000 characters');
    });
  });
});