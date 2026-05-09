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

  describe('heading hierarchy edge cases', () => {
    it('should not warn for h1 alone', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(file('# Only heading'));
      expect(
        violations.some(v => v.message.includes('Heading hierarchy skips'))
      ).toBe(false);
    });

    it('should warn h2 → h4 (skipping h3)', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(file('# T\n\n## A\n\n#### B'));
      expect(
        violations.some(v => v.message.includes('skips from h2 to h4'))
      ).toBe(true);
    });

    it('should not warn for going back up the hierarchy', () => {
      const rule = new ContentOrganizationRule();
      const content = '# T\n\n## A\n\n### A1\n\n## B\n\n### B1';
      const violations = rule.lint(file(content));
      expect(
        violations.some(v => v.message.includes('Heading hierarchy skips'))
      ).toBe(false);
    });
  });

  describe('vague language coverage', () => {
    it('should detect each vague phrase from the registry', () => {
      const phrases = [
        'properly',
        'correctly',
        'appropriately',
        'well',
        'good',
        'bad',
        'better',
        'best',
        'nice',
        'clean',
        'neat',
      ];
      const rule = new ContentOrganizationRule();
      for (const phrase of phrases) {
        const violations = rule.lint(file(`# T\n\nDo it ${phrase}.`));
        const hit = violations.find(v =>
          v.message.includes(`Vague term "${phrase}"`)
        );
        expect(hit, `expected "${phrase}" to fire`).toBeDefined();
      }
    });

    it('should match vague terms case-insensitively', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(file('# T\n\nFormat the code PROPERLY.'));
      expect(
        violations.some(v => v.message.includes('Vague term "properly"'))
      ).toBe(true);
    });

    it('should record column position of the vague term', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(file('# T\n\nXXXX properly is bad.'));
      const v = violations.find(x =>
        x.message.includes('Vague term "properly"')
      );
      expect(v).toBeDefined();
      expect(v?.location.line).toBe(3);
      expect(v?.location.column).toBe(6);
    });
  });

  describe('emphasis overuse precision', () => {
    it('should not warn when emphasis ratio is exactly at threshold', () => {
      const rule = new ContentOrganizationRule();
      // 1 IMPORTANT line out of 5 total = 20% (not strictly > 20%).
      const content = '# T\nplain1\nIMPORTANT thing\nplain3\nplain4';
      const violations = rule.lint(file(content));
      expect(
        violations.some(v =>
          v.message.includes('Overuse reduces effectiveness')
        )
      ).toBe(false);
    });

    it('should not flag a single emphasis on a long file', () => {
      const rule = new ContentOrganizationRule();
      const lines = ['# T', 'IMPORTANT first line'];
      for (let i = 0; i < 30; i++) lines.push(`Line ${i}`);
      const violations = rule.lint(file(lines.join('\n')));
      expect(
        violations.some(v =>
          v.message.includes('Overuse reduces effectiveness')
        )
      ).toBe(false);
    });
  });

  describe('emphasis pattern recognition', () => {
    it('should accept lowercase keyword wrapped in single asterisks', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(
        file('# T\n\nYou *must* read the docs first.')
      );
      expect(
        violations.some(v => v.message.includes('"must" but lacks emphasis'))
      ).toBe(false);
    });

    it('should accept lowercase keyword wrapped in double asterisks', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(
        file('# T\n\nYou **must** always run tests.')
      );
      expect(
        violations.some(v => v.message.includes('"must" but lacks emphasis'))
      ).toBe(false);
    });

    it('should not flag critical keywords inside heading lines', () => {
      const rule = new ContentOrganizationRule();
      const violations = rule.lint(file('# Things you must know\n'));
      expect(
        violations.some(v => v.message.includes('"must" but lacks emphasis'))
      ).toBe(false);
    });
  });
});
