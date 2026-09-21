import { describe, it, expect } from 'vitest';
import { lintMarkdown } from '../../../src/browser/lintMarkdown.js';
import { BROWSER_RULE_DESCRIPTORS } from '../../../src/rules/registry/browserRuleDescriptors.js';

describe('lintMarkdown (browser entry)', () => {
  it('returns a structured result for minimal markdown', () => {
    const result = lintMarkdown('# Title\n\nNo sections here.\n');
    expect(result).toHaveProperty('violations');
    expect(Array.isArray(result.violations)).toBe(true);
    expect(typeof result.errorCount).toBe('number');
  });

  it('flags untyped code fences via code-blocks', () => {
    const result = lintMarkdown(
      '# P\n\n## Project Overview\n\nT.\n\n## Development Commands\n\nnpm test\n\n## Architecture\n\nHex.\n\n```\nplain\n```\n'
    );
    expect(result.violations.some(v => v.ruleId === 'code-blocks')).toBe(true);
  });

  it('does not include filesystem-only rule ids in the browser set', () => {
    const ids = new Set(BROWSER_RULE_DESCRIPTORS.map(d => d.id));
    expect(ids.has('import-resolution')).toBe(false);
    expect(ids.has('monorepo-hierarchy')).toBe(false);
    expect(ids.has('agents-md')).toBe(false);
    expect(ids.has('code-blocks')).toBe(true);
  });
});
