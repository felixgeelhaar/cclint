import { describe, it, expect } from 'vitest';
import { OutputStyleRule } from '../../../src/rules/OutputStyleRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

const STYLE = '.claude/output-styles/concise.md';

function lint(content: string, path = STYLE) {
  return new OutputStyleRule().lint(new ContextFile(path, content));
}

const messages = (content: string, path = STYLE): string[] =>
  lint(content, path).map(v => v.message);

describe('OutputStyleRule', () => {
  describe('identity + gating', () => {
    it('has the expected id and description', () => {
      const rule = new OutputStyleRule();
      expect(rule.id).toBe('output-style');
      expect(rule.description).toContain('output-style');
    });

    it('appliesTo only Markdown files under output-styles/', () => {
      const rule = new OutputStyleRule();
      expect(rule.appliesTo(new ContextFile(STYLE, ''))).toBe(true);
      expect(rule.appliesTo(new ContextFile('.claude/skills/foo.md', ''))).toBe(
        false
      );
      expect(
        rule.appliesTo(new ContextFile('.claude/output-styles/x.json', '{}'))
      ).toBe(false);
    });

    it('returns no violations for a non-output-style file', () => {
      expect(lint('no frontmatter', 'CLAUDE.md')).toHaveLength(0);
    });
  });

  describe('frontmatter validation', () => {
    it('accepts a valid output style', () => {
      const content =
        '---\nname: Concise\ndescription: Short, direct answers with no preamble.\n---\n\nRespond tersely.';
      expect(lint(content)).toHaveLength(0);
    });

    it('flags a missing frontmatter fence', () => {
      const v = lint('# Concise\n\nJust a heading.');
      expect(v).toHaveLength(1);
      expect(v[0]?.message).toContain('missing frontmatter');
      expect(v[0]?.severity).toBe(Severity.ERROR);
    });

    it('flags a missing name', () => {
      const content = '---\ndescription: Something useful here.\n---\n\nBody.';
      expect(messages(content)).toContain(
        'Output style frontmatter is missing required "name" field.'
      );
    });

    it('flags a missing description', () => {
      const content = '---\nname: Concise\n---\n\nBody.';
      expect(messages(content)).toContain(
        'Output style frontmatter is missing required "description" field.'
      );
    });

    it('warns on an unknown frontmatter key', () => {
      const content =
        '---\nname: Concise\ndescription: Short answers.\ncolor: blue\n---\n\nBody.';
      const v = lint(content);
      const warn = v.find(x => x.message.includes('Unknown output-style'));
      expect(warn).toBeDefined();
      expect(warn?.message).toContain('color');
      expect(warn?.severity).toBe(Severity.WARNING);
    });

    it('does not warn on the known keys', () => {
      const content =
        '---\nname: Concise\ndescription: Short answers.\n---\n\nBody.';
      expect(
        lint(content).some(v => v.message.includes('Unknown output-style'))
      ).toBe(false);
    });
  });
});
