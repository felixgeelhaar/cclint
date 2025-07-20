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
      expect(() => new ContextFile('', 'content'))
        .toThrow('File path cannot be empty');
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
  });

  describe('getLine', () => {
    it('should return correct line by number (1-indexed)', () => {
      const file = new ContextFile('/path/to/CLAUDE.md', 'first\nsecond\nthird');

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
  });
});