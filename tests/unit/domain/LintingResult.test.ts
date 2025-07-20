import { describe, it, expect } from 'vitest';
import { LintingResult } from '../../../src/domain/LintingResult.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Violation } from '../../../src/domain/Violation.js';
import { Location } from '../../../src/domain/Location.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('LintingResult', () => {
  const createTestFile = (): ContextFile => {
    return new ContextFile('/test/CLAUDE.md', '# Test\nContent');
  };

  const createTestViolation = (severity: Severity = Severity.ERROR): Violation => {
    return new Violation(
      'test-rule',
      'Test violation',
      severity,
      new Location(1, 1)
    );
  };

  describe('constructor', () => {
    it('should create empty result for a file', () => {
      const file = createTestFile();
      const result = new LintingResult(file);

      expect(result.file).toBe(file);
      expect(result.violations).toEqual([]);
      expect(result.hasViolations()).toBe(false);
    });
  });

  describe('addViolation', () => {
    it('should add violation to the result', () => {
      const file = createTestFile();
      const result = new LintingResult(file);
      const violation = createTestViolation();

      result.addViolation(violation);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toBe(violation);
      expect(result.hasViolations()).toBe(true);
    });

    it('should add multiple violations', () => {
      const file = createTestFile();
      const result = new LintingResult(file);
      const violation1 = createTestViolation(Severity.ERROR);
      const violation2 = createTestViolation(Severity.WARNING);

      result.addViolation(violation1);
      result.addViolation(violation2);

      expect(result.violations).toHaveLength(2);
    });
  });

  describe('getViolationsByRule', () => {
    it('should return violations for specific rule', () => {
      const file = createTestFile();
      const result = new LintingResult(file);
      const violation1 = new Violation('rule-1', 'Message 1', Severity.ERROR, new Location(1, 1));
      const violation2 = new Violation('rule-2', 'Message 2', Severity.WARNING, new Location(2, 1));
      const violation3 = new Violation('rule-1', 'Message 3', Severity.INFO, new Location(3, 1));

      result.addViolation(violation1);
      result.addViolation(violation2);
      result.addViolation(violation3);

      const rule1Violations = result.getViolationsByRule('rule-1');
      expect(rule1Violations).toHaveLength(2);
      expect(rule1Violations).toContain(violation1);
      expect(rule1Violations).toContain(violation3);
    });

    it('should return empty array for unknown rule', () => {
      const file = createTestFile();
      const result = new LintingResult(file);

      expect(result.getViolationsByRule('unknown-rule')).toEqual([]);
    });
  });

  describe('getViolationsBySeverity', () => {
    it('should return violations of specific severity', () => {
      const file = createTestFile();
      const result = new LintingResult(file);
      const errorViolation = createTestViolation(Severity.ERROR);
      const warningViolation = createTestViolation(Severity.WARNING);
      const infoViolation = createTestViolation(Severity.INFO);

      result.addViolation(errorViolation);
      result.addViolation(warningViolation);
      result.addViolation(infoViolation);

      const errors = result.getViolationsBySeverity(Severity.ERROR);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(errorViolation);
    });
  });

  describe('getErrorCount', () => {
    it('should count error violations', () => {
      const file = createTestFile();
      const result = new LintingResult(file);

      result.addViolation(createTestViolation(Severity.ERROR));
      result.addViolation(createTestViolation(Severity.WARNING));
      result.addViolation(createTestViolation(Severity.ERROR));

      expect(result.getErrorCount()).toBe(2);
    });
  });

  describe('getWarningCount', () => {
    it('should count warning violations', () => {
      const file = createTestFile();
      const result = new LintingResult(file);

      result.addViolation(createTestViolation(Severity.ERROR));
      result.addViolation(createTestViolation(Severity.WARNING));
      result.addViolation(createTestViolation(Severity.WARNING));

      expect(result.getWarningCount()).toBe(2);
    });
  });

  describe('getHighestSeverity', () => {
    it('should return highest severity from violations', () => {
      const file = createTestFile();
      const result = new LintingResult(file);

      result.addViolation(createTestViolation(Severity.INFO));
      result.addViolation(createTestViolation(Severity.WARNING));

      expect(result.getHighestSeverity()).toBe(Severity.WARNING);
    });

    it('should return INFO for no violations', () => {
      const file = createTestFile();
      const result = new LintingResult(file);

      expect(result.getHighestSeverity()).toBe(Severity.INFO);
    });
  });
});