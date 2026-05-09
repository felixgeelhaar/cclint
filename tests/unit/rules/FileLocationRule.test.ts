import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileLocationRule } from '../../../src/rules/FileLocationRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('FileLocationRule', () => {
  const originalHome = process.env['HOME'];
  const FAKE_HOME = '/Users/test';

  beforeEach(() => {
    process.env['HOME'] = FAKE_HOME;
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env['HOME'];
    else process.env['HOME'] = originalHome;
  });

  function file(path: string, content = '# Project'): ContextFile {
    return new ContextFile(path, content);
  }

  describe('rule identity', () => {
    it('should have id file-location', () => {
      expect(new FileLocationRule().id).toBe('file-location');
    });

    it('should have a description', () => {
      expect(new FileLocationRule().description.length).toBeGreaterThan(0);
    });
  });

  describe('non-Claude files', () => {
    it('should skip files that are not CLAUDE.md or CLAUDE.local.md', () => {
      const rule = new FileLocationRule();
      const violations = rule.lint(file('/repo/README.md'));

      expect(violations).toEqual([]);
    });

    it('should skip arbitrary markdown files', () => {
      const rule = new FileLocationRule();
      const violations = rule.lint(file('/repo/docs/api.md'));

      expect(violations).toEqual([]);
    });
  });

  describe('CLAUDE.local.md deprecation', () => {
    it('should warn that CLAUDE.local.md is deprecated', () => {
      const rule = new FileLocationRule();
      const violations = rule.lint(file('/repo/CLAUDE.local.md'));

      const dep = violations.find(v => v.message.includes('deprecated'));
      expect(dep).toBeDefined();
      expect(dep?.severity).toBe(Severity.WARNING);
    });

    it('should not run other location/content checks for CLAUDE.local.md', () => {
      const rule = new FileLocationRule();
      const violations = rule.lint(
        file('/repo/CLAUDE.local.md', '# Project\n\nteam shared')
      );

      // Only the deprecation warning should fire.
      expect(violations).toHaveLength(1);
    });
  });

  describe('location recommendations', () => {
    it('should INFO when file is at user-memory location', () => {
      const rule = new FileLocationRule();
      const violations = rule.lint(file(`${FAKE_HOME}/.claude/CLAUDE.md`));

      const v = violations.find(x =>
        x.message.includes('User memory location')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.INFO);
    });

    it('should INFO when file is at project ./.claude/CLAUDE.md', () => {
      const rule = new FileLocationRule();
      const violations = rule.lint(file('/repo/.claude/CLAUDE.md'));

      const v = violations.find(x =>
        x.message.includes('Project-specific location')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.INFO);
    });

    it('should INFO when file is at project root', () => {
      const rule = new FileLocationRule();
      const violations = rule.lint(file('/repo/CLAUDE.md'));

      const v = violations.find(x =>
        x.message.includes('Project root location')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.INFO);
    });
  });

  describe('gitignore guidance', () => {
    it('should warn when project-located file mentions personal info', () => {
      const rule = new FileLocationRule();
      const violations = rule.lint(
        file(
          '/repo/CLAUDE.md',
          '# Project\n\nMy personal API key handling preferences.'
        )
      );

      const v = violations.find(x =>
        x.message.includes('personal information')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });

    it('should suggest committing team-shared content', () => {
      const rule = new FileLocationRule();
      const violations = rule.lint(
        file(
          '/repo/CLAUDE.md',
          '# Project\n\nThis project is used by the whole team.'
        )
      );

      const v = violations.find(x =>
        x.message.includes('team-shared instructions')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.INFO);
    });

    it('should not run gitignore checks at user-memory location', () => {
      const rule = new FileLocationRule();
      const violations = rule.lint(
        file(`${FAKE_HOME}/.claude/CLAUDE.md`, 'My personal team secret')
      );

      expect(
        violations.some(v => v.message.includes('personal information'))
      ).toBe(false);
      expect(violations.some(v => v.message.includes('team-shared'))).toBe(
        false
      );
    });
  });
});
