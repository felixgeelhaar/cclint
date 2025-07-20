import { describe, it, expect } from 'vitest';
import { Severity } from '../../../src/domain/Severity.js';

describe('Severity', () => {
  describe('constants', () => {
    it('should have ERROR severity', () => {
      expect(Severity.ERROR.level).toBe(2);
      expect(Severity.ERROR.name).toBe('error');
    });

    it('should have WARNING severity', () => {
      expect(Severity.WARNING.level).toBe(1);
      expect(Severity.WARNING.name).toBe('warning');
    });

    it('should have INFO severity', () => {
      expect(Severity.INFO.level).toBe(0);
      expect(Severity.INFO.name).toBe('info');
    });
  });

  describe('compareTo', () => {
    it('should compare severities correctly', () => {
      expect(Severity.ERROR.compareTo(Severity.WARNING)).toBe(1);
      expect(Severity.WARNING.compareTo(Severity.INFO)).toBe(1);
      expect(Severity.INFO.compareTo(Severity.ERROR)).toBe(-2);
      expect(Severity.ERROR.compareTo(Severity.ERROR)).toBe(0);
    });
  });

  describe('toString', () => {
    it('should return severity name', () => {
      expect(Severity.ERROR.toString()).toBe('error');
      expect(Severity.WARNING.toString()).toBe('warning');
      expect(Severity.INFO.toString()).toBe('info');
    });
  });

  describe('isAtLeast', () => {
    it('should check if severity is at least the given level', () => {
      expect(Severity.ERROR.isAtLeast(Severity.WARNING)).toBe(true);
      expect(Severity.ERROR.isAtLeast(Severity.ERROR)).toBe(true);
      expect(Severity.WARNING.isAtLeast(Severity.ERROR)).toBe(false);
      expect(Severity.INFO.isAtLeast(Severity.WARNING)).toBe(false);
    });
  });
});