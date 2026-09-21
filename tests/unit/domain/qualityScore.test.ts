import { describe, it, expect } from 'vitest';
import { qualityScore } from '../../../src/domain/qualityScore.js';

describe('qualityScore', () => {
  it('is 100 with no findings', () => {
    expect(qualityScore(0, 0, 0)).toBe(100);
  });

  it('penalizes errors more than warnings', () => {
    expect(qualityScore(1, 0, 0)).toBe(90);
    expect(qualityScore(0, 1, 0)).toBe(97);
    expect(qualityScore(0, 0, 1)).toBe(99);
  });

  it('floors at 0', () => {
    expect(qualityScore(20, 0, 0)).toBe(0);
  });
});
