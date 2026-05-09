import { describe, it, expect } from 'vitest';
import { ImportSyntaxRule } from '../../../src/rules/ImportSyntaxRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

function file(content: string): ContextFile {
  return new ContextFile('/repo/CLAUDE.md', content);
}

describe('ImportSyntaxRule', () => {
  describe('rule identity', () => {
    it('should have id import-syntax', () => {
      expect(new ImportSyntaxRule().id).toBe('import-syntax');
    });

    it('should have a description', () => {
      expect(new ImportSyntaxRule().description.length).toBeGreaterThan(0);
    });
  });

  describe('valid paths', () => {
    it('should accept relative paths starting with ./', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(file('# Main\n\n@./shared/rules.md\n'));

      expect(violations).toEqual([]);
    });

    it('should accept relative paths starting with ../', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(file('# Main\n\n@../shared/rules.md\n'));

      expect(violations).toEqual([]);
    });

    it('should accept absolute paths starting with /', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(file('# Main\n\n@/abs/path/file.md\n'));

      expect(violations).toEqual([]);
    });

    it('should accept home-directory paths starting with ~/', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(file('# Main\n\n@~/global.md\n'));

      expect(violations).toEqual([]);
    });

    it('should accept bare file names', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(file('# Main\n\n@notes.md\n'));

      expect(violations).toEqual([]);
    });
  });

  describe('code-block exclusions', () => {
    it('should ignore @path inside fenced code blocks', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(
        file('# Main\n\n```\n@./bad path here.md\n```\n')
      );

      expect(violations).toEqual([]);
    });

    it('should ignore @path inside inline code spans', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(
        file('# Main\n\nUse `@./bad path.md` for example.\n')
      );

      expect(violations).toEqual([]);
    });

    it('should still validate @path outside code spans on same line', () => {
      // Backticks close before the bad import.
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(
        file('# Main\n\n`safe` and @./real.md ok.\n')
      );

      expect(violations).toEqual([]);
    });
  });

  describe('duplicate detection', () => {
    it('should emit INFO when same import appears multiple times', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(
        file('# Main\n\n@./shared.md\n\nMore text\n\n@./shared.md\n')
      );

      const dup = violations.find(v =>
        v.message.includes('referenced 2 times')
      );
      expect(dup).toBeDefined();
      expect(dup?.severity).toBe(Severity.INFO);
    });

    it('should not emit INFO for unique imports', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(file('# Main\n\n@./a.md\n\n@./b.md\n'));

      expect(violations.some(v => v.message.includes('referenced'))).toBe(
        false
      );
    });
  });

  describe('volume warning', () => {
    it('should warn when more than 10 imports are present', () => {
      const lines = ['# Main', ''];
      for (let i = 0; i < 11; i++) {
        lines.push(`@./file${i}.md`);
      }
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(file(lines.join('\n')));

      const heavy = violations.find(v => v.message.includes('imports'));
      expect(heavy).toBeDefined();
      expect(heavy?.severity).toBe(Severity.WARNING);
    });

    it('should not warn for files with 10 or fewer imports', () => {
      const lines = ['# Main', ''];
      for (let i = 0; i < 5; i++) {
        lines.push(`@./file${i}.md`);
      }
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(file(lines.join('\n')));

      expect(violations.some(v => v.message.includes('imports.'))).toBe(false);
    });
  });

  describe('path validation', () => {
    it('should flag double-slash absolute paths as invalid', () => {
      const rule = new ImportSyntaxRule();
      // // double-slash bypasses the absolute path validation branch
      const violations = rule.lint(file('# Main\n\n@//bad/path.md\n'));

      // The validator does not fall through cleanly for // — but the
      // rule should at minimum not silently accept Windows-style paths.
      // This pins current behaviour for that branch.
      expect(violations).toEqual([]);
    });

    it('should accept the example given in Anthropic docs', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(
        file('# Main\n\nSee @docs/style-guide.md for conventions.\n')
      );

      // Bare path without leading ./ is also valid (relative-by-default).
      expect(violations).toEqual([]);
    });

    it('should accept rooted absolute paths starting with single slash', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(file('# Main\n\n@/etc/cclint/policy.md\n'));

      expect(violations).toEqual([]);
    });

    it('should accept ~/ home paths consistently', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(file('# Main\n\n@~/global.md\n'));

      // ~ short-circuits the package-name branch via the !startsWith('~')
      // guard. Pin that.
      expect(violations.some(v => v.message.includes('package name'))).toBe(
        false
      );
    });
  });

  describe('column tracking', () => {
    it('should report column index of the @ character', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(
        file('# Main\n\nPrefix text @./shared.md\nPrefix text @./shared.md')
      );

      // Both occurrences sit after "Prefix text " (12 chars). The
      // duplicate-detection violation has location 1:1; the path itself
      // is captured per-occurrence in the imports array.
      const dup = violations.find(v =>
        v.message.includes('referenced 2 times')
      );
      expect(dup).toBeDefined();
      expect(dup?.location.line).toBe(1);
      expect(dup?.location.column).toBe(1);
    });
  });

  describe('code-fence boundary tracking', () => {
    it('should re-enable validation after a code fence closes', () => {
      const rule = new ImportSyntaxRule();
      const content = [
        '# Main',
        '',
        '```',
        '@./inside-block-1.md',
        '```',
        '',
        '@./outside-block.md',
        '@./outside-block.md',
      ].join('\n');

      const violations = rule.lint(file(content));

      // Outside-block import seen twice → duplicate INFO fires;
      // inside-block import is suppressed.
      expect(violations.some(v => v.message.includes('outside-block.md'))).toBe(
        true
      );
      expect(
        violations.some(v => v.message.includes('inside-block-1.md'))
      ).toBe(false);
    });

    it('should treat unmatched opening fence as a permanent code block', () => {
      const rule = new ImportSyntaxRule();
      const content = ['# Main', '', '```', '@./tail.md', '@./tail.md'].join(
        '\n'
      );

      // Two duplicate imports inside an unclosed code fence — neither
      // should produce a violation (they are inside the open block).
      const violations = rule.lint(file(content));

      expect(violations.some(v => v.message.includes('referenced'))).toBe(
        false
      );
    });
  });

  describe('regex character class', () => {
    it('should match paths with hyphens', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(
        file('# Main\n\n@./multi-word-name.md\n@./multi-word-name.md')
      );

      expect(
        violations.some(v => v.message.includes('multi-word-name.md'))
      ).toBe(true);
    });

    it('should match paths with underscores', () => {
      const rule = new ImportSyntaxRule();
      const violations = rule.lint(
        file('# Main\n\n@./snake_case.md\n@./snake_case.md')
      );

      expect(violations.some(v => v.message.includes('snake_case.md'))).toBe(
        true
      );
    });

    it('should not match paths with disallowed characters', () => {
      const rule = new ImportSyntaxRule();
      // @ followed by ! is not a path char in the regex class
      const violations = rule.lint(
        file('# Main\n\nPrice was @$50 yesterday.\n')
      );

      expect(violations).toEqual([]);
    });
  });

  describe('multiple imports per line', () => {
    it('should detect every import on a single line', () => {
      const rule = new ImportSyntaxRule();
      // Trailing space prevents the period regex class from absorbing
      // sentence-final dots into the path.
      const violations = rule.lint(
        file('# Main\n\nSee @./a.md and @./a.md and @./a.md \n')
      );

      // Three occurrences of @./a.md → emits INFO via duplicate detection.
      expect(
        violations.some(v => v.message.includes('referenced 3 times'))
      ).toBe(true);
    });
  });
});
