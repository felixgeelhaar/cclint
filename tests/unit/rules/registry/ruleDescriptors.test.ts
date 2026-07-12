import { describe, it, expect } from 'vitest';
import {
  RULE_DESCRIPTORS,
  isRuleEnabled,
  getBuiltinRuleIds,
} from '../../../../src/rules/registry/ruleDescriptors.js';
import { getAllRuleIds } from '../../../../src/rules/registry/ruleMetadata.js';
import { defaultConfig, type CclintConfig } from '../../../../src/domain/Config.js';

describe('ruleDescriptors', () => {
  it('has a unique id for every descriptor', () => {
    const ids = RULE_DESCRIPTORS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes metadata whose id matches the descriptor id', () => {
    for (const descriptor of RULE_DESCRIPTORS) {
      expect(descriptor.metadata).toBeDefined();
      expect(descriptor.metadata.id).toBe(descriptor.id);
    }
  });

  it('covers exactly the documented rule set (no drift)', () => {
    const descriptorIds = new Set(RULE_DESCRIPTORS.map(d => d.id));
    const metadataIds = new Set(getAllRuleIds());
    expect(descriptorIds).toEqual(metadataIds);
  });

  it('constructs a rule whose id matches the descriptor id', () => {
    for (const descriptor of RULE_DESCRIPTORS) {
      const rule = descriptor.create(defaultConfig);
      expect(rule.id).toBe(descriptor.id);
    }
  });

  it('derives the built-in id set from the descriptor list', () => {
    expect(getBuiltinRuleIds()).toEqual(new Set(RULE_DESCRIPTORS.map(d => d.id)));
  });

  describe('isRuleEnabled', () => {
    const find = (id: string) => {
      const descriptor = RULE_DESCRIPTORS.find(d => d.id === id);
      if (!descriptor) throw new Error(`missing descriptor ${id}`);
      return descriptor;
    };

    it('enables every rule under the shipped default config', () => {
      for (const descriptor of RULE_DESCRIPTORS) {
        expect(isRuleEnabled(descriptor, defaultConfig)).toBe(true);
      }
    });

    it('honors an explicit disable for a default-on rule', () => {
      const config: CclintConfig = {
        rules: { 'command-safety': { enabled: false } },
      };
      expect(isRuleEnabled(find('command-safety'), config)).toBe(false);
    });

    it('keeps default-on rules enabled when the config omits them', () => {
      const config: CclintConfig = { rules: {} };
      expect(isRuleEnabled(find('karpathy'), config)).toBe(true);
    });

    it('leaves core rules disabled when the config omits them', () => {
      const config: CclintConfig = { rules: {} };
      expect(isRuleEnabled(find('file-size'), config)).toBe(false);
      expect(isRuleEnabled(find('format'), config)).toBe(false);
    });

    it('treats the legacy `content` key as an alias for content-organization', () => {
      const config: CclintConfig = {
        rules: { content: { enabled: true } },
      };
      expect(isRuleEnabled(find('content-organization'), config)).toBe(true);
    });
  });
});
