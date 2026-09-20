import { describe, it, expect } from 'vitest';
import { ClaudeRulesRule } from '../../../src/rules/ClaudeRulesRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('ClaudeRulesRule', () => {
  const rule = new ClaudeRulesRule();

  it('applies only to .claude/rules markdown', () => {
    expect(
      rule.appliesTo(new ContextFile('/repo/.claude/rules/api.md', '# x\n'))
    ).toBe(true);
    expect(
      rule.appliesTo(
        new ContextFile('/repo/.claude/rules/backend/db.md', '# x\n')
      )
    ).toBe(true);
    expect(rule.appliesTo(new ContextFile('/repo/CLAUDE.md', '# x\n'))).toBe(
      false
    );
  });

  it('accepts a global rule with a body and no paths', () => {
    const file = new ContextFile(
      '/repo/.claude/rules/testing.md',
      '# Testing\n\n- Prefer Vitest.\n'
    );
    expect(rule.lint(file)).toEqual([]);
  });

  it('accepts CSV paths with a body', () => {
    const file = new ContextFile(
      '/repo/.claude/rules/api.md',
      '---\npaths: "src/api/**/*.ts,src/services/**/*.ts"\n---\n\n# API\n\n- Validate inputs.\n'
    );
    expect(rule.lint(file)).toEqual([]);
  });

  it('accepts YAML list paths with a body', () => {
    const file = new ContextFile(
      '/repo/.claude/rules/api.md',
      '---\npaths:\n  - "src/**/*.ts"\n---\n\n# API\n\n- Use zod.\n'
    );
    expect(rule.lint(file)).toEqual([]);
  });

  it('errors on empty paths list', () => {
    const file = new ContextFile(
      '/repo/.claude/rules/api.md',
      '---\npaths:\n---\n\n# API\n\n- x\n'
    );
    const violations = rule.lint(file);
    expect(violations.some(v => v.severity === Severity.ERROR)).toBe(true);
    expect(violations.some(v => v.message.includes('empty'))).toBe(true);
  });

  it('warns on empty body', () => {
    const file = new ContextFile(
      '/repo/.claude/rules/api.md',
      '---\npaths: "src/**/*.ts"\n---\n'
    );
    const violations = rule.lint(file);
    expect(violations.some(v => v.severity === Severity.WARNING)).toBe(true);
    expect(violations.some(v => v.message.includes('no instruction body'))).toBe(
      true
    );
  });
});
