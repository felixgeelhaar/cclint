import { describe, it, expect } from 'vitest';
import { ContentAppropriatenessRule } from '../../../src/rules/ContentAppropriatenessRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

function file(content: string): ContextFile {
  return new ContextFile('/repo/CLAUDE.md', content);
}

describe('ContentAppropriatenessRule', () => {
  describe('rule identity', () => {
    it('should have id content-appropriateness', () => {
      expect(new ContentAppropriatenessRule().id).toBe(
        'content-appropriateness'
      );
    });

    it('should have a description', () => {
      expect(
        new ContentAppropriatenessRule().description.length
      ).toBeGreaterThan(0);
    });
  });

  describe('file size', () => {
    it('should warn when file exceeds default maxFileSize (5000)', () => {
      const rule = new ContentAppropriatenessRule();
      const big = '# T\n\n' + 'word '.repeat(1200);
      const violations = rule.lint(file(big));

      const v = violations.find(x => x.message.includes('characters'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });

    it('should respect custom maxFileSize', () => {
      const rule = new ContentAppropriatenessRule({ maxFileSize: 50 });
      const violations = rule.lint(
        file(
          '# Title\n\nThis is content that definitely exceeds the fifty-character cap.'
        )
      );

      expect(violations.some(v => v.message.includes('recommended: <50'))).toBe(
        true
      );
    });

    it('should not warn for small files', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(file('# Title\n\nShort.'));

      expect(
        violations.some(v => v.message.includes('recommended: <5000'))
      ).toBe(false);
    });
  });

  describe('generic instructions', () => {
    it('should warn on "follow best practices"', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(
        file('# Title\n\nFollow best practices when coding.')
      );

      expect(violations.some(v => v.message.includes('best practices'))).toBe(
        true
      );
    });

    it('should warn on "write good code"', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(file('# Title\n\nWrite good code.'));

      expect(violations.some(v => v.message.includes('write good code'))).toBe(
        true
      );
    });

    it('should warn on "be careful"', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(file('# Title\n\nBe careful with imports.'));

      expect(violations.some(v => v.message.includes('be careful'))).toBe(true);
    });

    it('should warn on "use common sense"', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(file('# Title\n\nUse common sense.'));

      expect(violations.some(v => v.message.includes('common sense'))).toBe(
        true
      );
    });
  });

  describe('misplaced content', () => {
    it('should INFO when project description section is present', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(
        file('# Project\n\n## Overview\n\nDetails.')
      );

      const v = violations.find(x =>
        x.message.includes('Extensive project description')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.INFO);
    });

    it('should INFO when API documentation heading is present', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(file('# Project\n\n## API\n\nDetails.'));

      expect(
        violations.some(v => v.message.includes('API documentation'))
      ).toBe(true);
    });

    it('should INFO on Installation heading', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(
        file('# Project\n\n## Installation\n\nSteps.')
      );

      expect(
        violations.some(v => v.message.includes('Installation instructions'))
      ).toBe(true);
    });

    it('should INFO when content mentions npm install', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(file('# Project\n\nRun npm install.'));

      expect(
        violations.some(v => v.message.includes('Installation instructions'))
      ).toBe(true);
    });
  });

  describe('section sizes', () => {
    it('should INFO when section exceeds maxSectionSize', () => {
      const rule = new ContentAppropriatenessRule({ maxSectionSize: 50 });
      const big = '# T\n\n## Big\n' + 'word '.repeat(20);
      const violations = rule.lint(file(big));

      expect(violations.some(v => v.message.includes('recommended: <50'))).toBe(
        true
      );
    });
  });

  describe('actionability', () => {
    it('should INFO on non-actionable "remember" without "to"', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(file('# Title\n\nRemember tests matter.'));

      expect(violations.some(v => v.message.includes('not actionable'))).toBe(
        true
      );
    });

    it('should not flag "remember to" (actionable phrasing)', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(
        file('# Title\n\nRemember to run tests before commit.')
      );

      expect(violations.some(v => v.message.includes('not actionable'))).toBe(
        false
      );
    });

    it('should INFO on "it\'s important" without "to"', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(file("# Title\n\nIt's important."));

      expect(violations.some(v => v.message.includes('not actionable'))).toBe(
        true
      );
    });

    it('should INFO on "it is important" without "to"', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(file('# Title\n\nIt is important.'));

      expect(violations.some(v => v.message.includes('not actionable'))).toBe(
        true
      );
    });

    it('should NOT flag "it is important to <verb>"', () => {
      const rule = new ContentAppropriatenessRule();
      const violations = rule.lint(
        file('# Title\n\nIt is important to run tests before commit.')
      );

      expect(violations.some(v => v.message.includes('not actionable'))).toBe(
        false
      );
    });
  });
});
