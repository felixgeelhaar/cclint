import { describe, it, expect } from 'vitest';
import { EnforcementHintRule } from '../../../src/rules/EnforcementHintRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('EnforcementHintRule', () => {
  it('is quiet for soft guidance', () => {
    const file = new ContextFile(
      '/r/CLAUDE.md',
      '# Project\n\nPrefer feature branches.\n'
    );
    expect(new EnforcementHintRule().lint(file)).toEqual([]);
  });

  it('INFO on hard-enforcement language', () => {
    const file = new ContextFile(
      '/r/CLAUDE.md',
      '# Project\n\nYOU MUST NEVER run rm -rf on this repo.\n'
    );
    const violations = new EnforcementHintRule().lint(file);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe(Severity.INFO);
    expect(violations[0]?.message).toMatch(/PreToolUse/);
  });

  it('ignores enforcement phrases inside code fences', () => {
    const file = new ContextFile(
      '/r/CLAUDE.md',
      '# Project\n\n```\nYOU MUST NEVER delete\n```\n'
    );
    expect(new EnforcementHintRule().lint(file)).toEqual([]);
  });
});
