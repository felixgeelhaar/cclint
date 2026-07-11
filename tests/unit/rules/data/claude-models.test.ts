import { describe, it, expect } from 'vitest';
import {
  LAST_VERIFIED,
  MODEL_FAMILIES,
  MODEL_ALIASES,
  RECOMMENDED_MODELS,
  RECOMMENDED_MODELS_TEXT,
  MODEL_SHAPE_PATTERN,
  isModelAlias,
  isKnownModelShape,
  isLegacyModel,
} from '../../../../src/rules/data/claude-models.js';

describe('claude-models data module', () => {
  describe('freshness', () => {
    // This test intentionally exists to prompt future maintainers to re-verify
    // the model knowledge against Anthropic's current model list.
    it('exposes a LAST_VERIFIED ISO date string', () => {
      expect(typeof LAST_VERIFIED).toBe('string');
      expect(LAST_VERIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('recognizes the current fable family and its bare alias', () => {
      // Regression guard: the previous hardcoded list flagged these as
      // "not recognized" false positives.
      expect(MODEL_FAMILIES).toContain('fable');
      expect(isModelAlias('fable')).toBe(true);
      expect(isKnownModelShape('claude-fable-5')).toBe(true);
    });
  });

  describe('families and aliases', () => {
    it('lists the four current families', () => {
      expect([...MODEL_FAMILIES].sort()).toEqual(
        ['fable', 'haiku', 'opus', 'sonnet'].sort()
      );
    });

    it('accepts every family name as a bare alias plus "inherit"', () => {
      for (const family of MODEL_FAMILIES) {
        expect(isModelAlias(family)).toBe(true);
      }
      expect(isModelAlias('inherit')).toBe(true);
      expect(MODEL_ALIASES).toContain('inherit');
    });

    it('is case-insensitive for aliases', () => {
      expect(isModelAlias('OPUS')).toBe(true);
      expect(isModelAlias('Fable')).toBe(true);
    });

    it('rejects unknown bare aliases', () => {
      expect(isModelAlias('turbo')).toBe(false);
      expect(isModelAlias('claude-opus-4-8')).toBe(false);
    });
  });

  describe('shape validation', () => {
    it('accepts current fully-qualified ids across families', () => {
      expect(isKnownModelShape('claude-opus-4-8')).toBe(true);
      expect(isKnownModelShape('claude-sonnet-5')).toBe(true);
      expect(isKnownModelShape('claude-haiku-4-5')).toBe(true);
      expect(isKnownModelShape('claude-fable-5')).toBe(true);
    });

    it('tolerates optional date and -latest suffixes', () => {
      expect(isKnownModelShape('claude-haiku-4-5-20251001')).toBe(true);
      expect(isKnownModelShape('claude-opus-4-8-latest')).toBe(true);
    });

    it('rejects malformed ids', () => {
      expect(isKnownModelShape('claude-99')).toBe(false);
      expect(isKnownModelShape('gpt-4')).toBe(false);
      expect(isKnownModelShape('claude-turbo-1')).toBe(false);
    });

    it('exports the documented base shape pattern', () => {
      expect(MODEL_SHAPE_PATTERN.test('claude-fable-5')).toBe(true);
      expect(MODEL_SHAPE_PATTERN.test('claude-opus-4-8')).toBe(true);
    });
  });

  describe('legacy detection', () => {
    it('flags Claude 3.x identifiers', () => {
      expect(isLegacyModel('claude-3-5-sonnet')).toBe(true);
      expect(isLegacyModel('claude-3-opus')).toBe(true);
    });

    it('does not flag current families as legacy', () => {
      expect(isLegacyModel('claude-opus-4-8')).toBe(false);
      expect(isLegacyModel('claude-fable-5')).toBe(false);
    });
  });

  describe('recommended models for advisories', () => {
    it('references current model ids', () => {
      expect(RECOMMENDED_MODELS).toContain('claude-opus-4-8');
      expect(RECOMMENDED_MODELS).toContain('claude-sonnet-5');
      expect(RECOMMENDED_MODELS_TEXT).toContain('claude-opus-4-8');
      expect(RECOMMENDED_MODELS_TEXT).toContain('claude-sonnet-5');
    });
  });
});
