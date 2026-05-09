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

      expect(
        () => new Violation('', 'message', Severity.ERROR, location)
      ).toThrow('Rule ID cannot be empty');
    });

    it('should throw error for whitespace-only rule ID', () => {
      const location = new Location(1, 1);

      expect(
        () => new Violation('   ', 'message', Severity.ERROR, location)
      ).toThrow('Rule ID cannot be empty');
    });

    it('should throw error for empty message', () => {
      const location = new Location(1, 1);

      expect(() => new Violation('rule', '', Severity.ERROR, location)).toThrow(
        'Message cannot be empty'
      );
    });

    it('should throw error for whitespace-only message', () => {
      const location = new Location(1, 1);

      expect(
        () => new Violation('rule', '   ', Severity.ERROR, location)
      ).toThrow('Message cannot be empty');
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

      expect(violation.toString()).toBe(
        'warning: Line too long at 10:5 [max-length]'
      );
    });
  });

  describe('equals', () => {
    const baseLocation = new Location(5, 10);

    it('should return true for violations with same properties', () => {
      const violation1 = new Violation(
        'rule',
        'message',
        Severity.ERROR,
        baseLocation
      );
      const violation2 = new Violation(
        'rule',
        'message',
        Severity.ERROR,
        baseLocation
      );

      expect(violation1.equals(violation2)).toBe(true);
    });

    it('should return false when ruleId differs', () => {
      const v1 = new Violation(
        'rule-a',
        'message',
        Severity.ERROR,
        baseLocation
      );
      const v2 = new Violation(
        'rule-b',
        'message',
        Severity.ERROR,
        baseLocation
      );

      expect(v1.equals(v2)).toBe(false);
    });

    it('should return false when message differs', () => {
      const v1 = new Violation(
        'rule',
        'message-a',
        Severity.ERROR,
        baseLocation
      );
      const v2 = new Violation(
        'rule',
        'message-b',
        Severity.ERROR,
        baseLocation
      );

      expect(v1.equals(v2)).toBe(false);
    });

    it('should return false when severity differs', () => {
      const v1 = new Violation('rule', 'message', Severity.ERROR, baseLocation);
      const v2 = new Violation(
        'rule',
        'message',
        Severity.WARNING,
        baseLocation
      );

      expect(v1.equals(v2)).toBe(false);
    });

    it('should return false when location differs', () => {
      const location1 = new Location(5, 10);
      const location2 = new Location(5, 11);
      const v1 = new Violation('rule', 'message', Severity.ERROR, location1);
      const v2 = new Violation('rule', 'message', Severity.ERROR, location2);

      expect(v1.equals(v2)).toBe(false);
    });

    it('should return true when only the Location instance differs but values match', () => {
      const location1 = new Location(5, 10);
      const location2 = new Location(5, 10);
      const v1 = new Violation('rule', 'message', Severity.ERROR, location1);
      const v2 = new Violation('rule', 'message', Severity.ERROR, location2);

      expect(v1.equals(v2)).toBe(true);
    });
  });
});
