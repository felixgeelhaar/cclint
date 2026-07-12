import { describe, it, expect } from 'vitest';
import { FormatRule } from '../../../src/rules/FormatRule.js';
import { AutoFixer } from '../../../src/infrastructure/AutoFixer.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Violation } from '../../../src/domain/Violation.js';
import { Severity } from '../../../src/domain/Severity.js';
import { Location } from '../../../src/domain/Location.js';

/**
 * Commit 3 (#40): the detecting rule now carries a structured fix on the
 * Violation, and AutoFixer applies it generically instead of re-parsing the
 * message. These tests lock in that (a) FormatRule attaches fixes, (b) the
 * carried fix produces the same result the message-matching path used to, and
 * (c) AutoFixer prefers a carried fix regardless of rule id.
 */
describe('FormatRule carried fixes', () => {
  const lint = (content: string): Violation[] =>
    new FormatRule().lint(new ContextFile('CLAUDE.md', content));

  const applyCarried = (content: string): string => {
    const fixes = AutoFixer.generateFixesForViolations(lint(content), content);
    return AutoFixer.applyFixes(content, fixes).content;
  };

  it('attaches a fix to a header-spacing violation', () => {
    const violations = lint('#Title\n');
    const header = violations.find(v =>
      v.message.startsWith('Header missing space')
    );
    expect(header?.fix).toEqual({
      range: { start: new Location(1, 2), end: new Location(1, 2) },
      text: ' ',
      description: 'Add space after header #',
    });
  });

  it('attaches a fix to a trailing-whitespace violation', () => {
    const violations = lint('# Title\ntext with spaces   \n');
    const trailing = violations.find(v =>
      v.message.includes('trailing whitespace')
    );
    expect(trailing?.fix?.text).toBe('');
    expect(trailing?.fix?.description).toBe('Remove trailing whitespace');
  });

  it('attaches a fix to an unclosed code block', () => {
    const violations = lint('# T\n\n```js\nconst x = 1;');
    const unclosed = violations.find(v =>
      v.message.includes('Unclosed code block')
    );
    expect(unclosed?.fix?.text).toBe('\n```');
  });

  it('attaches a fix to an unknown code block language', () => {
    const violations = lint('# T\n\n```notalang\ncode\n```\n');
    const unknown = violations.find(v =>
      v.message.includes('Unknown code block language')
    );
    expect(unknown?.fix?.text).toBe('text');
  });

  it('carried fixes match the legacy message-matched fixes byte-for-byte', () => {
    const samples = [
      '#Header\n',
      '# Title\nline with spaces   \n',
      'Line 1\n\n\n\nLine 2\n',
      '# Title\nno final newline',
      '# T\n\n```js\nconst x = 1;',
      '# T\n\n```notalang\ncode\n```\n',
    ];

    for (const content of samples) {
      const violations = lint(content);
      // Fixes derived from the real (fix-carrying) violations.
      const carried = AutoFixer.generateFixesForViolations(violations, content);
      // Fixes derived from message-matching only, by stripping the carried fix.
      const stripped = violations.map(
        v => new Violation(v.ruleId, v.message, v.severity, v.location)
      );
      const legacy = AutoFixer.generateFixesForViolations(stripped, content);
      expect(carried).toEqual(legacy);
    }
  });

  it('applies carried fixes end-to-end', () => {
    expect(applyCarried('#Header\n')).toBe('# Header\n');
    expect(applyCarried('# Title\nspaces   \n')).toBe('# Title\nspaces\n');
    expect(applyCarried('# Title\nno newline')).toBe('# Title\nno newline\n');
  });
});

describe('AutoFixer prefers Violation-carried fixes', () => {
  it('applies a carried fix even for a rule with no message-matcher', () => {
    const content = 'placeholder line';
    const violation = new Violation(
      'some-plugin-rule',
      'anything at all',
      Severity.WARNING,
      new Location(1, 1),
      {
        range: { start: new Location(1, 1), end: new Location(1, 12) },
        text: 'REPLACED',
        description: 'swap prefix',
      }
    );

    const fixes = AutoFixer.generateFixesForViolations([violation], content);
    expect(fixes).toHaveLength(1);
    expect(AutoFixer.applyFixes(content, fixes).content).toBe('REPLACED line');
  });

  it('uses the carried fix over what message-matching would produce', () => {
    const content = '#Header';
    // A format violation whose carried fix intentionally differs from the
    // legacy header matcher, proving the carried fix wins.
    const violation = new Violation(
      'format',
      'Header missing space after #',
      Severity.ERROR,
      new Location(1, 2),
      {
        range: { start: new Location(1, 1), end: new Location(1, 1) },
        text: 'X',
        description: 'carried-wins',
      }
    );

    const fixes = AutoFixer.generateFixesForViolations([violation], content);
    expect(fixes).toEqual([violation.fix]);
  });
});
