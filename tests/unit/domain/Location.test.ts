import { describe, it, expect } from 'vitest';
import { Location } from '../../../src/domain/Location.js';

describe('Location', () => {
  describe('constructor', () => {
    it('should create a location with valid line and column', () => {
      const location = new Location(1, 5);
      
      expect(location.line).toBe(1);
      expect(location.column).toBe(5);
    });

    it('should throw error for invalid line number', () => {
      expect(() => new Location(0, 1)).toThrow('Line number must be positive');
      expect(() => new Location(-1, 1)).toThrow('Line number must be positive');
    });

    it('should throw error for invalid column number', () => {
      expect(() => new Location(1, -1)).toThrow('Column number must be non-negative');
    });
  });

  describe('toString', () => {
    it('should format location as line:column', () => {
      const location = new Location(10, 25);
      
      expect(location.toString()).toBe('10:25');
    });
  });

  describe('equals', () => {
    it('should return true for locations with same line and column', () => {
      const location1 = new Location(5, 10);
      const location2 = new Location(5, 10);
      
      expect(location1.equals(location2)).toBe(true);
    });

    it('should return false for locations with different line or column', () => {
      const location1 = new Location(5, 10);
      const location2 = new Location(5, 11);
      const location3 = new Location(6, 10);
      
      expect(location1.equals(location2)).toBe(false);
      expect(location1.equals(location3)).toBe(false);
    });
  });
});