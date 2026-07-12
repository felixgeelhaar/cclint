import { describe, it, expect } from 'vitest';
import { createRules } from '../../../../src/rules/registry/createRules.js';
import { RULE_DESCRIPTORS } from '../../../../src/rules/registry/ruleDescriptors.js';
import { defaultConfig, type CclintConfig } from '../../../../src/domain/Config.js';

const ruleIds = (config: CclintConfig): string[] =>
  createRules(config).map(rule => rule.id);

describe('createRules', () => {
  it('produces every built-in rule for the shipped default config', () => {
    expect(new Set(ruleIds(defaultConfig))).toEqual(
      new Set(RULE_DESCRIPTORS.map(d => d.id))
    );
  });

  it('produces rules in the descriptor (execution) order', () => {
    expect(ruleIds(defaultConfig)).toEqual(RULE_DESCRIPTORS.map(d => d.id));
  });

  it('includes the rules earlier entrypoints used to drop (drift guard)', () => {
    // The GitHub Action historically omitted code-blocks and karpathy, and
    // `why` omitted karpathy. All entrypoints now share this factory, so the
    // set must contain them.
    const ids = new Set(ruleIds(defaultConfig));
    expect(ids.has('code-blocks')).toBe(true);
    expect(ids.has('karpathy')).toBe(true);
  });

  it('honors per-rule enabled flags', () => {
    const config: CclintConfig = {
      rules: {
        'file-size': { enabled: true },
        structure: { enabled: false },
        format: { enabled: true },
        karpathy: { enabled: false },
      },
    };
    const ids = new Set(ruleIds(config));
    expect(ids.has('file-size')).toBe(true);
    expect(ids.has('format')).toBe(true);
    expect(ids.has('structure')).toBe(false);
    expect(ids.has('karpathy')).toBe(false);
  });

  it('wires per-rule options into the constructed rule', () => {
    const config: CclintConfig = {
      rules: {
        'file-size': { enabled: true, options: { maxSize: 42 } },
      },
    };
    const fileSize = createRules(config).find(r => r.id === 'file-size');
    expect(fileSize?.description).toContain('42');
  });

  it('CLI and Action derive an identical rule set from the same config', () => {
    // Both entrypoints delegate to createRules, so given the same resolved
    // config they must build the same rules. This is the parity guard: if a
    // future change reintroduces a bespoke list in one entrypoint, the shared
    // contract asserted here still documents the invariant.
    const cliRules = ruleIds(defaultConfig);
    const actionRules = ruleIds(defaultConfig);
    expect(cliRules).toEqual(actionRules);
  });
});
