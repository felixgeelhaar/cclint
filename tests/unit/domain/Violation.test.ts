import { describe, it, expect } from 'vitest';
import { Violation } from '../../../src/domain/Violation.js';
import { Location } from '../../../src/domain/Location.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('Violation', () => {
  describe('constructor', () => {
    it('should create a violation with all properties', () => {
      const location = new Location(5, 10);
      const violation = new Violation(
        'test-rule',
        'Test message',
        Severity.ERROR,
        location
      );

      expect(violation.ruleId).toBe('test-rule');
      expect(violation.message).toBe('Test message');
      expect(violation.severity).toBe(Severity.ERROR);
      expect(violation.location).toBe(location);
    });

    it('should throw error for empty rule ID', () => {
      const location = new Location(1, 1);
      
      expect(() => new Violation('', 'message', Severity.ERROR, location))
        .toThrow('Rule ID cannot be empty');
    });

    it('should throw error for empty message', () => {
      const location = new Location(1, 1);
      
      expect(() => new Violation('rule', '', Severity.ERROR, location))
        .toThrow('Message cannot be empty');
    });
  });

  describe('toString', () => {
    it('should format violation as "severity: message at location [rule]"', () => {
      const location = new Location(10, 5);
      const violation = new Violation(
        'max-length',
        'Line too long',
        Severity.WARNING,
        location
      );

      expect(violation.toString()).toBe('warning: Line too long at 10:5 [max-length]');
    });
  });

  describe('equals', () => {
    it('should return true for violations with same properties', () => {
      const location = new Location(5, 10);
      const violation1 = new Violation('rule', 'message', Severity.ERROR, location);
      const violation2 = new Violation('rule', 'message', Severity.ERROR, location);

      expect(violation1.equals(violation2)).toBe(true);
    });

    it('should return false for violations with different properties', () => {
      const location1 = new Location(5, 10);
      const location2 = new Location(5, 11);
      const violation1 = new Violation('rule', 'message', Severity.ERROR, location1);
      const violation2 = new Violation('rule', 'message', Severity.ERROR, location2);

      expect(violation1.equals(violation2)).toBe(false);
    });
  });
});