import { describe, it, expect } from 'vitest';
import { KarpathyRule } from '../../../src/rules/KarpathyRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

function claude(content: string): ContextFile {
  return new ContextFile('/repo/CLAUDE.md', content);
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
    it('flags hedging phrases that undermine literal instructions', () => {
      const v = new KarpathyRule().lint(
        claude('# Title\n\n- Try to keep functions small where appropriate.')
      );
      const hedge = v.find(x => x.message.toLowerCase().includes('hedg'));
      expect(hedge).toBeDefined();
      expect(hedge?.severity).toBe(Severity.INFO);
    });

    it('deduplicates the same hedging phrase to one finding', () => {
      const v = new KarpathyRule().lint(
        claude('# T\n\n- Try to do X.\n- Try to do Y.\n- Try to do Z.')
      );
      const tryToHits = v.filter(x =>
        x.message.toLowerCase().includes('try to')
      );
      expect(tryToHits).toHaveLength(1);
    });
  });

  describe('filler and politeness', () => {
    it('flags politeness and filler that waste context', () => {
      const v = new KarpathyRule().lint(
        claude('# T\n\nPlease run the tests. Thank you.')
      );
      expect(v.some(x => x.message.toLowerCase().includes('filler'))).toBe(
        true
      );
    });

    it('flags "you are a helpful assistant" framing', () => {
      const v = new KarpathyRule().lint(
        claude('# T\n\nYou are a helpful assistant that writes Go.')
      );
      expect(v.some(x => /helpful assistant/i.test(x.message))).toBe(true);
    });
  });

  describe('show, do not tell', () => {
    it('flags a guideline section with many rules but no example', () => {
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
      expect(v.some(x => x.message.toLowerCase().includes('example'))).toBe(
        true
      );
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
    it('flags an overly long prose paragraph', () => {
      const longPara = 'This sentence exists only to add length. '.repeat(25);
      const v = new KarpathyRule().lint(claude(`# T\n\n${longPara}`));
      expect(v.some(x => x.message.toLowerCase().includes('paragraph'))).toBe(
        true
      );
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
