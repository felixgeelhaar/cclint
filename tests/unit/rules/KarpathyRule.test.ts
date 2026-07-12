import { describe, it, expect } from 'vitest';
import { KarpathyRule } from '../../../src/rules/KarpathyRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';
import type { Violation } from '../../../src/domain/Violation.js';

function claude(content: string): ContextFile {
  return new ContextFile('/repo/CLAUDE.md', content);
}

/** Assert exactly one violation matches `predicate`, and return it. */
function only(
  violations: Violation[],
  predicate: (v: Violation) => boolean
): Violation {
  const matches = violations.filter(predicate);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

describe('KarpathyRule', () => {
  describe('rule identity', () => {
    it('has id karpathy', () => {
      expect(new KarpathyRule().id).toBe('karpathy');
    });
    it('has a description', () => {
      expect(new KarpathyRule().description.length).toBeGreaterThan(0);
    });
  });

  describe('scope', () => {
    it('only lints CLAUDE.md files', () => {
      const rule = new KarpathyRule();
      const other = new ContextFile(
        '/repo/README.md',
        'Please try to write good code, thank you.'
      );
      expect(rule.lint(other)).toHaveLength(0);
    });
  });

  describe('hedging language', () => {
    it('flags a hedging phrase with exact message, INFO severity, and location', () => {
      const v = new KarpathyRule().lint(
        claude('# Title\n\n- Try to keep functions small where appropriate.')
      );
      const hedge = only(v, x => x.message.includes('"try to"'));
      expect(hedge.ruleId).toBe('karpathy');
      expect(hedge.message).toBe(
        'Hedging phrase "try to" weakens a literal instruction. ' +
          'State the rule directly so the model follows it deterministically.'
      );
      expect(hedge.severity).toBe(Severity.INFO);
      // The phrase is on the third line (heading, blank, bullet).
      expect(hedge.location.line).toBe(3);
      expect(hedge.location.column).toBe(1);
    });

    it('flags a second distinct hedging phrase on the same line', () => {
      const v = new KarpathyRule().lint(
        claude('# Title\n\n- Try to keep functions small where appropriate.')
      );
      const appropriate = only(v, x =>
        x.message.includes('"where appropriate"')
      );
      expect(appropriate.severity).toBe(Severity.INFO);
      expect(appropriate.location.line).toBe(3);
    });

    it('deduplicates the same hedging phrase to one finding', () => {
      const v = new KarpathyRule().lint(
        claude('# T\n\n- Try to do X.\n- Try to do Y.\n- Try to do Z.')
      );
      const tryToHits = v.filter(x =>
        x.message.toLowerCase().includes('try to')
      );
      expect(tryToHits).toHaveLength(1);
      // First occurrence wins: line 3, not 4 or 5.
      expect(tryToHits[0]!.location.line).toBe(3);
    });
  });

  describe('filler and politeness', () => {
    it('flags politeness/filler with exact message, INFO severity, and location', () => {
      const v = new KarpathyRule().lint(
        claude('# T\n\nPlease run the tests. Thank you.')
      );
      const please = only(v, x => x.message.includes('"please"'));
      expect(please.message).toBe(
        'Filler/politeness "please" spends context without signal. ' +
          'Drop it — CLAUDE.md is instructions for a model, not prose for a person.'
      );
      expect(please.severity).toBe(Severity.INFO);
      expect(please.location.line).toBe(3);
      expect(please.location.column).toBe(1);
      // Both filler phrases are detected independently.
      expect(v.some(x => x.message.includes('"thank you"'))).toBe(true);
    });

    it('flags "you are a helpful assistant" framing at INFO', () => {
      const v = new KarpathyRule().lint(
        claude('# T\n\nYou are a helpful assistant that writes Go.')
      );
      const framing = only(v, x => /helpful assistant/i.test(x.message));
      expect(framing.severity).toBe(Severity.INFO);
      expect(framing.location.line).toBe(3);
    });
  });

  describe('show, do not tell', () => {
    it('flags a guideline section with exact message, count, INFO severity, and heading location', () => {
      const v = new KarpathyRule().lint(
        claude(
          [
            '# Project',
            '',
            '## Conventions',
            '',
            '- Use tabs for indentation',
            '- Name tests Test_Subject',
            '- Keep functions under 40 lines',
            '- Return errors, do not panic',
            '',
          ].join('\n')
        )
      );
      const example = only(v, x => x.message.includes('shows no'));
      expect(example.message).toBe(
        'Section "Conventions" lists 4 rules but shows no example. ' +
          "Add a concrete example (show, don't tell) — few-shot context " +
          'steers the model better than abstract rules.'
      );
      expect(example.severity).toBe(Severity.INFO);
      // Points at the heading line (## Conventions), which is line 3.
      expect(example.location.line).toBe(3);
      expect(example.location.column).toBe(1);
    });

    it('does not flag with exactly 3 bullets (below the >= 4 threshold)', () => {
      // Boundary guard for `bullets >= 4`: three bullets must stay silent.
      const v = new KarpathyRule().lint(
        claude(
          [
            '# Project',
            '',
            '## Conventions',
            '',
            '- Use tabs for indentation',
            '- Name tests Test_Subject',
            '- Keep functions under 40 lines',
            '',
          ].join('\n')
        )
      );
      expect(v.some(x => x.message.includes('shows no'))).toBe(false);
    });

    it('does not flag a guideline section that includes a code example', () => {
      const v = new KarpathyRule().lint(
        claude(
          [
            '# Project',
            '',
            '## Conventions',
            '',
            '- Use table-driven tests',
            '- Name tests Test_Subject',
            '- Keep functions small',
            '- Return errors, do not panic',
            '',
            '```go',
            'func Test_Add(t *testing.T) {}',
            '```',
            '',
          ].join('\n')
        )
      );
      expect(v.some(x => x.message.toLowerCase().includes('example'))).toBe(
        false
      );
    });
  });

  describe('signal-to-noise', () => {
    it('flags an overly long prose paragraph with exact word count, INFO severity, and location', () => {
      const longPara = 'This sentence exists only to add length. '.repeat(25);
      const v = new KarpathyRule().lint(claude(`# T\n\n${longPara}`));
      const para = only(v, x => x.message.includes('Paragraph is'));
      // 7 words * 25 repeats = 175 words — pins the count into the message.
      expect(para.message).toBe(
        'Paragraph is 175 words. Tighten to high-signal lines or bullets — ' +
          'dense prose buries the instruction.'
      );
      expect(para.severity).toBe(Severity.INFO);
      // Paragraph starts on line 3 (heading, blank, prose).
      expect(para.location.line).toBe(3);
      expect(para.location.column).toBe(1);
    });

    it('does not flag code blocks as long paragraphs', () => {
      const longCode =
        '```\n' + 'x := 1 // padding padding padding\n'.repeat(25) + '```';
      const v = new KarpathyRule().lint(claude(`# T\n\n${longCode}`));
      expect(v.some(x => x.message.toLowerCase().includes('paragraph'))).toBe(
        false
      );
    });
  });

  describe('clean file', () => {
    it('returns no violations for a tight, concrete CLAUDE.md', () => {
      const v = new KarpathyRule().lint(
        claude(
          [
            '# nomid',
            '',
            '## Commands',
            '',
            '```bash',
            'make test   # go test ./...',
            'make build  # builds bin/nomid',
            '```',
            '',
            '## Conventions',
            '',
            '- Module path: github.com/x/y',
            '- New tools register in tools.Registry',
            '',
            '```go',
            'reg.Register(myTool)',
            '```',
            '',
          ].join('\n')
        )
      );
      expect(v).toHaveLength(0);
    });
  });
});
