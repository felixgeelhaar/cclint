import { describe, it, expect } from 'vitest';
import { ContextFile } from '../../../src/domain/ContextFile.js';

describe('ContextFile', () => {
  describe('constructor', () => {
    it('should create a context file with path and content', () => {
      const content = '# My Project\n\nThis is a test.';
      const file = new ContextFile('/path/to/CLAUDE.md', content);

      expect(file.path).toBe('/path/to/CLAUDE.md');
      expect(file.content).toBe(content);
      expect(file.lines).toEqual(['# My Project', '', 'This is a test.']);
    });

    it('should throw error for empty path', () => {
      expect(() => new ContextFile('', 'content')).toThrow(
        'File path cannot be empty'
      );
    });

    it('should throw error for whitespace-only path', () => {
      expect(() => new ContextFile('   ', 'content')).toThrow(
        'File path cannot be empty'
      );
    });

    it('should handle empty content', () => {
      const file = new ContextFile('/path/to/CLAUDE.md', '');

      expect(file.content).toBe('');
      expect(file.lines).toEqual(['']);
    });

    it('should handle content with only newlines', () => {
      const file = new ContextFile('/path/to/CLAUDE.md', '\n\n\n');

      expect(file.lines).toEqual(['', '', '', '']);
    });

    it('should strip trailing CR when splitting CRLF (\\r\\n) content', () => {
      const content = '# Title\r\n\r\nBody line\r\n';
      const file = new ContextFile('/path/to/CLAUDE.md', content);

      expect(file.lines).toEqual(['# Title', '', 'Body line', '']);
      // No split line may retain a carriage return.
      expect(file.lines.every(line => !line.includes('\r'))).toBe(true);
      // The raw content is preserved intact (CRs still counted).
      expect(file.content).toBe(content);
    });

    it('should split lone CR (\\r) line endings without leaving a CR', () => {
      const file = new ContextFile('/path/to/CLAUDE.md', 'a\rb\rc');

      expect(file.lines).toEqual(['a', 'b', 'c']);
      expect(file.lines.every(line => !line.includes('\r'))).toBe(true);
    });

    it('should reject content exceeding the maximum size', () => {
      const oversized = 'a'.repeat(10 * 1024 * 1024 + 1);
      expect(() => new ContextFile('/path/to/CLAUDE.md', oversized)).toThrow(
        /exceeds maximum size/
      );
    });

    it('should reject a single line exceeding the maximum line length', () => {
      const longLine = 'x'.repeat(10001);
      expect(
        () => new ContextFile('/path/to/CLAUDE.md', `# ok\n${longLine}\n`)
      ).toThrow(/line 2 exceeding/);
    });

    it('should accept content at the line-length boundary', () => {
      const boundaryLine = 'x'.repeat(10000);
      expect(
        () => new ContextFile('/path/to/CLAUDE.md', boundaryLine)
      ).not.toThrow();
    });
  });

  describe('getLineCount', () => {
    it('should return correct line count', () => {
      const file = new ContextFile('/path/to/CLAUDE.md', 'line1\nline2\nline3');

      expect(file.getLineCount()).toBe(3);
    });

    it('should return 1 for empty content', () => {
      const file = new ContextFile('/path/to/CLAUDE.md', '');

      expect(file.getLineCount()).toBe(1);
    });
  });

  describe('getCharacterCount', () => {
    it('should return correct character count', () => {
      const content = 'Hello, World!';
      const file = new ContextFile('/path/to/CLAUDE.md', content);

      expect(file.getCharacterCount()).toBe(13);
    });

    it('should count newlines as characters', () => {
      const file = new ContextFile('/path/to/CLAUDE.md', 'a\nb\nc');

      expect(file.getCharacterCount()).toBe(5);
    });

    it('should count carriage returns from CRLF content (raw length)', () => {
      // Line normalization must not change the character count: the CRs are
      // still part of the raw content.
      const file = new ContextFile('/path/to/CLAUDE.md', 'a\r\nb');

      expect(file.getCharacterCount()).toBe(4);
    });
  });

  describe('getLine', () => {
    it('should return correct line by number (1-indexed)', () => {
      const file = new ContextFile(
        '/path/to/CLAUDE.md',
        'first\nsecond\nthird'
      );

      expect(file.getLine(1)).toBe('first');
      expect(file.getLine(2)).toBe('second');
      expect(file.getLine(3)).toBe('third');
    });

    it('should throw error for invalid line number', () => {
      const file = new ContextFile('/path/to/CLAUDE.md', 'line1\nline2');

      expect(() => file.getLine(0)).toThrow('Line number must be positive');
      expect(() => file.getLine(3)).toThrow('Line number 3 is out of range');
    });
  });

  describe('hasSection', () => {
    it('should detect presence of markdown sections', () => {
      const content = '# Title\n\n## Section 1\n\nContent\n\n### Subsection';
      const file = new ContextFile('/path/to/CLAUDE.md', content);

      expect(file.hasSection('Title')).toBe(true);
      expect(file.hasSection('Section 1')).toBe(true);
      expect(file.hasSection('Subsection')).toBe(true);
      expect(file.hasSection('Nonexistent')).toBe(false);
    });

    it('should be case sensitive', () => {
      const file = new ContextFile('/path/to/CLAUDE.md', '# My Section');

      expect(file.hasSection('My Section')).toBe(true);
      expect(file.hasSection('my section')).toBe(false);
    });

    it('should treat regex metacharacters in section title literally', () => {
      // Section title contains characters that, if not escaped, would
      // produce a different regex (e.g. '.' matching any char). This
      // exercises escapeRegExp's '\\$&' replacement; if escaping is
      // dropped the unrelated content "AnyChar." would falsely match.
      const file = new ContextFile(
        '/path/to/CLAUDE.md',
        '# Section.With.Dots\n\nAnotherX section'
      );

      expect(file.hasSection('Section.With.Dots')).toBe(true);
      // Without proper escaping, '.' would match any char and yield true.
      expect(file.hasSection('Section.With.Dots'.replace(/\./g, 'X'))).toBe(
        false
      );
      expect(file.hasSection('Section[X]')).toBe(false);
    });
  });
});
