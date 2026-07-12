import { describe, it, expect } from 'vitest';
import { FrontmatterParser } from '../../../../src/rules/support/FrontmatterParser.js';

/** Convenience: split a string into the `lines` shape ContextFile produces. */
function toLines(content: string): string[] {
  return content.split('\n');
}

describe('FrontmatterParser', () => {
  describe('fence detection', () => {
    it('reports no fence when there is no frontmatter', () => {
      const fm = FrontmatterParser.parse(toLines('# Heading\n\nBody text.'));
      expect(fm.hasFence).toBe(false);
    });

    it('reports a fence when a --- delimiter is present', () => {
      const fm = FrontmatterParser.parse(toLines('---\nname: x\n---\n\nBody.'));
      expect(fm.hasFence).toBe(true);
    });

    it('reports a fence even when the block is never closed', () => {
      const fm = FrontmatterParser.parse(toLines('---\nname: x\n\nBody.'));
      expect(fm.hasFence).toBe(true);
    });

    it('treats a completely empty document as having no fence', () => {
      const fm = FrontmatterParser.parse(toLines(''));
      expect(fm.hasFence).toBe(false);
    });
  });

  describe('scalar values', () => {
    it('parses simple key: value pairs', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\nname: my-skill\ndescription: does things\n---')
      );
      expect(fm.getString('name')).toBe('my-skill');
      expect(fm.getString('description')).toBe('does things');
    });

    it('returns undefined for keys that are absent', () => {
      const fm = FrontmatterParser.parse(toLines('---\nname: x\n---'));
      expect(fm.getString('model')).toBeUndefined();
    });

    it('treats an empty value as an empty string, not absent', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\nname:\ndescription:\n---')
      );
      expect(fm.getString('name')).toBe('');
      expect(fm.getString('description')).toBe('');
      expect(fm.has('name')).toBe(true);
    });

    it('strips surrounding double quotes', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\nname: "quoted-name"\n---')
      );
      expect(fm.getString('name')).toBe('quoted-name');
    });

    it('strips surrounding single quotes', () => {
      const fm = FrontmatterParser.parse(toLines("---\nname: 'single'\n---"));
      expect(fm.getString('name')).toBe('single');
    });

    it('only strips outer content within a fenced block, ignoring body lines', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\nname: x\n---\n\nmodel: not-frontmatter\n')
      );
      expect(fm.getString('model')).toBeUndefined();
    });
  });

  describe('quoted values containing colons', () => {
    it('keeps a colon that lives inside a quoted value', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\ndescription: "ratio 16:9 output"\n---')
      );
      expect(fm.getString('description')).toBe('ratio 16:9 output');
    });

    it('keeps everything after the first colon for an unquoted value with a colon', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\ndescription: reviews code: finds bugs\n---')
      );
      expect(fm.getString('description')).toBe('reviews code: finds bugs');
    });
  });

  describe('comment handling', () => {
    it('ignores a full-line comment inside the frontmatter', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\n# a comment\nname: x\n---')
      );
      expect(fm.getString('name')).toBe('x');
    });

    it('strips a trailing inline comment from a scalar value', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\nname: my-skill # inline note\n---')
      );
      expect(fm.getString('name')).toBe('my-skill');
    });

    it('does not treat a # inside a quoted value as a comment', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\ndescription: "uses #tags heavily"\n---')
      );
      expect(fm.getString('description')).toBe('uses #tags heavily');
    });

    it('does not treat a # without a preceding space as a comment', () => {
      const fm = FrontmatterParser.parse(toLines('---\nname: color#1\n---'));
      expect(fm.getString('name')).toBe('color#1');
    });
  });

  describe('array values', () => {
    it('parses a multiline dash list', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\ntools:\n  - Read\n  - Edit\n  - Bash\n---')
      );
      expect(fm.getStringArray('tools')).toEqual(['Read', 'Edit', 'Bash']);
    });

    it('parses an inline bracket array', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\ntools: [Read, Edit, Bash]\n---')
      );
      expect(fm.getStringArray('tools')).toEqual(['Read', 'Edit', 'Bash']);
    });

    it('parses a bare comma-separated scalar as an array', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\ntools: Read, Edit\n---')
      );
      expect(fm.getStringArray('tools')).toEqual(['Read', 'Edit']);
    });

    it('strips quotes from inline array items', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\ntools: ["Read", "Edit"]\n---')
      );
      expect(fm.getStringArray('tools')).toEqual(['Read', 'Edit']);
    });

    it('allows a key line to be followed by dash items after a blank line', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\ntools:\n  - Read\nmodel: opus\n---')
      );
      expect(fm.getStringArray('tools')).toEqual(['Read']);
      expect(fm.getString('model')).toBe('opus');
    });

    it('returns an empty array for a key with no items', () => {
      const fm = FrontmatterParser.parse(toLines('---\ntools:\n---'));
      expect(fm.getStringArray('tools')).toEqual([]);
    });

    it('returns undefined array for an absent key', () => {
      const fm = FrontmatterParser.parse(toLines('---\nname: x\n---'));
      expect(fm.getStringArray('tools')).toBeUndefined();
    });

    it('strips an inline comment on a dash item', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\ntools:\n  - Read # main\n  - Edit\n---')
      );
      expect(fm.getStringArray('tools')).toEqual(['Read', 'Edit']);
    });
  });

  describe('boolean values', () => {
    it('reads true for the literal string true', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\ndisable_model_invocation: true\n---')
      );
      expect(fm.getBoolean('disable_model_invocation')).toBe(true);
    });

    it('reads false for any other value', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\ndisable_model_invocation: false\n---')
      );
      expect(fm.getBoolean('disable_model_invocation')).toBe(false);
    });

    it('reads false when the key is absent', () => {
      const fm = FrontmatterParser.parse(toLines('---\nname: x\n---'));
      expect(fm.getBoolean('disable_model_invocation')).toBe(false);
    });
  });

  describe('CRLF line endings', () => {
    it('parses scalars when lines carry a trailing carriage return', () => {
      const fm = FrontmatterParser.parse(
        '---\r\nname: crlf-skill\r\ndescription: works with crlf\r\n---\r\n'.split(
          '\n'
        )
      );
      expect(fm.hasFence).toBe(true);
      expect(fm.getString('name')).toBe('crlf-skill');
      expect(fm.getString('description')).toBe('works with crlf');
    });

    it('parses dash arrays with CRLF endings', () => {
      const fm = FrontmatterParser.parse(
        '---\r\ntools:\r\n  - Read\r\n  - Edit\r\n---\r\n'.split('\n')
      );
      expect(fm.getStringArray('tools')).toEqual(['Read', 'Edit']);
    });
  });

  describe('multiline scalar continuation', () => {
    it('joins an indented continuation line into the scalar', () => {
      const fm = FrontmatterParser.parse(
        toLines('---\ndescription: first line\n  second line\n---')
      );
      expect(fm.getString('description')).toBe('first line second line');
    });
  });

  describe('missing / empty frontmatter', () => {
    it('returns no values when there is no frontmatter block', () => {
      const fm = FrontmatterParser.parse(toLines('# Title\n\nBody.'));
      expect(fm.getString('name')).toBeUndefined();
      expect(fm.has('name')).toBe(false);
    });

    it('returns no values for an empty fenced block', () => {
      const fm = FrontmatterParser.parse(toLines('---\n---\n\nBody.'));
      expect(fm.getString('name')).toBeUndefined();
    });
  });
});
