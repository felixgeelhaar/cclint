import { describe, it, expect } from 'vitest';
import {
  PRESETS,
  getPreset,
  RECOMMENDED_PRESET_NAME,
  STRICT_PRESET_NAME,
} from '../../../src/domain/presets.js';
import { getBuiltinRuleIds } from '../../../src/rules/registry/ruleDescriptors.js';

describe('presets', () => {
  describe('getPreset', () => {
    it('resolves the recommended preset by name', () => {
      expect(getPreset(RECOMMENDED_PRESET_NAME)).toBe(
        PRESETS[RECOMMENDED_PRESET_NAME]
      );
    });

    it('resolves the strict preset by name', () => {
      expect(getPreset(STRICT_PRESET_NAME)).toBe(PRESETS[STRICT_PRESET_NAME]);
    });

    it('returns undefined for an unknown preset name', () => {
      expect(getPreset('@cclint/does-not-exist')).toBeUndefined();
    });
  });

  describe('@cclint/recommended', () => {
    it('keeps the sensible default posture (warnings stay warnings)', () => {
      const preset = PRESETS[RECOMMENDED_PRESET_NAME];
      expect(preset.rules?.['file-size']?.severity).toBe('warning');
      expect(preset.rules?.['structure']?.severity).toBe('warning');
      expect(preset.rules?.['format']?.severity).toBe('error');
    });

    it('enables its listed rules', () => {
      const preset = PRESETS[RECOMMENDED_PRESET_NAME];
      for (const rule of Object.values(preset.rules ?? {})) {
        expect(rule?.enabled).toBe(true);
      }
    });
  });

  describe('@cclint/strict', () => {
    it('promotes every rule severity to error', () => {
      const preset = PRESETS[STRICT_PRESET_NAME];
      for (const rule of Object.values(preset.rules ?? {})) {
        expect(rule?.severity).toBe('error');
        expect(rule?.enabled).toBe(true);
      }
    });

    it('enables every built-in rule (guards against drift)', () => {
      const preset = PRESETS[STRICT_PRESET_NAME];
      const configured = new Set(Object.keys(preset.rules ?? {}));
      for (const ruleId of getBuiltinRuleIds()) {
        expect(configured.has(ruleId)).toBe(true);
      }
    });
  });

  it('exposes both presets in the registry', () => {
    expect(Object.keys(PRESETS).sort()).toEqual(
      [RECOMMENDED_PRESET_NAME, STRICT_PRESET_NAME].sort()
    );
  });
});
