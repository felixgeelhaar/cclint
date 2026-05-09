import { describe, it, expect } from 'vitest';
import { ContentOrganizationRule } from '../../../src/rules/ContentOrganizationRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

function file(content: string): ContextFile {
  return new ContextFile('/repo/CLAUDE.md', content);
}

describe('ContentOrganizationRule', () => {
  describe('rule identity', () => {
    it('should have id content-organization', () => {
      expect(new ContentOrganizationRule().id).toBe('content-organization');
    });

    it('should have a description', () => {
      expect(new ContentOrganizationRule().description.length).toBeGreaterThan(
        0
      );
    });
  });

  describe('heading hierarchy', () => {
    it('should warn when heading levels skip (h1 → h3)', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(file('# Title\n\n### Sub'));

      const v = violations.find(x =>
        x.message.includes('Heading hierarchy skips')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });

    it('should not warn when heading levels are sequential', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(file('# Title\n\n## Sub\n\n### SubSub'));

      expect(
        violations.some(v => v.message.includes('Heading hierarchy skips'))
      ).toBe(false);
    });
  });

  describe('bullet point usage', () => {
    it('should INFO when long section has no bullets', () => {
      const rule = new ContentOrganizationRule();
      const content =
        '# Title\n\n## Setup\nLine one of setup\nLine two of setup\nLine three of setup\nLine four\n\n## Next\nfoo';
      const violations = rule.lint(file(content));

      const v = violations.find(
        x => x.message.includes('Setup') && x.message.includes('bullet points')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.INFO);
    });

    it('should not flag sections that use bullets', () => {
      const rule = new ContentOrganizationRule();
      const content =
        '# Title\n\n## Setup\n- step one\n- step two\n- step three\n- step four';
      const violations = rule.lint(file(content));

      expect(violations.some(v => v.message.includes('bullet points'))).toBe(
        false
      );
    });

    it('should not flag short sections', () => {
      const rule = new ContentOrganizationRule();
      const content = '# Title\n\n## Setup\nShort.';
      const violations = rule.lint(file(content));

      expect(violations.some(v => v.message.includes('bullet points'))).toBe(
        false
      );
    });
  });

  describe('vague language', () => {
    it('should INFO on vague terms', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(
        file('# Title\n\nFormat the code properly.')
      );

      const v = violations.find(x => x.message.includes('properly'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.INFO);
    });

    it('should ignore vague terms inside fenced code blocks', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(
        file('# Title\n\n```\nproperly is fine here\n```')
      );

      expect(
        violations.some(v => v.message.includes('Vague term "properly"'))
      ).toBe(false);
    });

    it('should still flag vague terms after a closed code block', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(
        file('# Title\n\n```\nplain\n```\n\nFormat the code properly.')
      );

      expect(
        violations.some(v => v.message.includes('Vague term "properly"'))
      ).toBe(true);
    });
  });

  describe('emphasis usage', () => {
    it('should INFO when critical keyword "must" lacks emphasis', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(
        file('# Title\n\nYou must run tests before committing.')
      );

      expect(
        violations.some(v => v.message.includes('"must" but lacks emphasis'))
      ).toBe(true);
    });

    it('should not flag MUST in uppercase', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(
        file('# Title\n\nYou MUST run tests before committing.')
      );

      expect(
        violations.some(v => v.message.includes('"must" but lacks emphasis'))
      ).toBe(false);
    });

    it('should INFO when long file has no emphasis at all', () => {
      const rule = new ContentOrganizationRule();
      const lines = ['# Title'];
      for (let i = 0; i < 25; i++) lines.push(`Line ${i}`);
      const violations = rule.lint(file(lines.join('\n')));

      expect(
        violations.some(v => v.message.includes('no emphasis markers'))
      ).toBe(true);
    });
  });

  describe('emphasis overuse', () => {
    it('should WARN when emphasis ratio exceeds 20%', () => {
      const rule = new ContentOrganizationRule();
      const lines = ['# Title'];
      for (let i = 0; i < 4; i++) {
        lines.push(`IMPORTANT: rule ${i}`);
      }
      const violations = rule.lint(file(lines.join('\n')));

      const v = violations.find(x =>
        x.message.includes('Overuse reduces effectiveness')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });

    it('should INFO on consecutive emphasis lines', () => {
      const rule = new ContentOrganizationRule();
      const content =
        '# Title\n\nIMPORTANT: line a\nIMPORTANT: line b\nplain\nplain\nplain\nplain\nplain';
      const violations = rule.lint(file(content));

      expect(
        violations.some(v =>
          v.message.includes('Consecutive lines with emphasis')
        )
      ).toBe(true);
    });
  });

  describe('specificity', () => {
    it('should INFO when style instruction lacks specifics', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(
        file('# Title\n\nUse appropriate style for code.')
      );

      expect(violations.some(v => v.message.includes('lacks specifics'))).toBe(
        true
      );
    });

    it('should INFO when format instruction lacks specifics (no longer self-matches)', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(
        file('# Title\n\nUse appropriate format for code.')
      );

      expect(violations.some(v => v.message.includes('lacks specifics'))).toBe(
        true
      );
    });

    it('should not flag specifics with numeric measurements', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(
        file('# Title\n\nUse 2-space indent and 80-character line limit.')
      );

      expect(violations.some(v => v.message.includes('lacks specifics'))).toBe(
        false
      );
    });

    it('should not flag specifics with tool names', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(
        file('# Title\n\nUse Prettier for formatting.')
      );

      expect(violations.some(v => v.message.includes('lacks specifics'))).toBe(
        false
      );
    });
  });
});
