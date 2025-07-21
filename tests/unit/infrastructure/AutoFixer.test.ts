import { describe, it, expect } from 'vitest';
import { AutoFixer } from '../../../src/infrastructure/AutoFixer.js';
import { Violation } from '../../../src/domain/Violation.js';
import { Location } from '../../../src/domain/Location.js';
import { Severity } from '../../../src/domain/Severity.js';
import type { Fix } from '../../../src/domain/AutoFix.js';

describe('AutoFixer', () => {
  describe('applyFixes', () => {
    it('should return original content when no fixes provided', () => {
      const content = 'Hello World\nSecond line';
      const fixes: Fix[] = [];

      const result = AutoFixer.applyFixes(content, fixes);

      expect(result.fixed).toBe(false);
      expect(result.content).toBe(content);
      expect(result.appliedFixes).toEqual([]);
    });

    it('should apply single line insertion fix', () => {
      const content = '#Header\nSecond line';
      const fixes: Fix[] = [
        {
          range: {
            start: new Location(1, 2),
            end: new Location(1, 2),
          },
          text: ' ',
          description: 'Add space after header #',
        },
      ];

      const result = AutoFixer.applyFixes(content, fixes);

      expect(result.fixed).toBe(true);
      expect(result.content).toBe('# Header\nSecond line');
      expect(result.appliedFixes).toHaveLength(1);
    });

    it('should apply replacement fix', () => {
      const content = 'Hello World';
      const fixes: Fix[] = [
        {
          range: {
            start: new Location(1, 1),
            end: new Location(1, 6),
          },
          text: 'Hi',
          description: 'Replace Hello with Hi',
        },
      ];

      const result = AutoFixer.applyFixes(content, fixes);

      expect(result.fixed).toBe(true);
      expect(result.content).toBe('Hi World');
      expect(result.appliedFixes).toHaveLength(1);
    });

    it('should handle invalid fix ranges gracefully', () => {
      const content = 'Short line';
      const fixes: Fix[] = [
        {
          range: {
            start: new Location(1, 1),
            end: new Location(1, 6),
          },
          text: 'Fixed',
          description: 'Valid fix',
        },
        {
          range: {
            start: new Location(99, 1), // Invalid line
            end: new Location(99, 5),
          },
          text: 'Invalid',
          description: 'Invalid fix',
        },
      ];

      const result = AutoFixer.applyFixes(content, fixes);

      expect(result.fixed).toBe(true);
      expect(result.content).toBe('Fixed line');
      expect(result.appliedFixes).toHaveLength(1);
      expect(result.appliedFixes[0].description).toBe('Valid fix');
    });
  });

  describe('generateFixesForViolations', () => {
    it('should not generate fixes for non-format rules', () => {
      const content = 'Some content';
      const violations = [
        new Violation(
          'file-size',
          'File too large',
          Severity.WARNING,
          new Location(1, 1)
        ),
        new Violation(
          'structure',
          'Missing section',
          Severity.ERROR,
          new Location(1, 1)
        ),
      ];

      const fixes = AutoFixer.generateFixesForViolations(violations, content);

      expect(fixes).toHaveLength(0);
    });

    it('should handle empty violations array', () => {
      const content = 'Some content';
      const violations: Violation[] = [];

      const fixes = AutoFixer.generateFixesForViolations(violations, content);

      expect(fixes).toHaveLength(0);
    });

    it('should return empty array for format violations without specific patterns', () => {
      const content = 'Some content';
      const violations = [
        new Violation(
          'format',
          'Some other format issue',
          Severity.WARNING,
          new Location(1, 1)
        ),
      ];

      const fixes = AutoFixer.generateFixesForViolations(violations, content);

      expect(fixes).toHaveLength(0);
    });

    it('should handle violations with missing line content', () => {
      const content = 'Line 1';
      const violations = [
        new Violation(
          'format',
          'Header missing space after #',
          Severity.ERROR,
          new Location(99, 1) // Line doesn't exist
        ),
      ];

      const fixes = AutoFixer.generateFixesForViolations(violations, content);

      expect(fixes).toHaveLength(0);
    });

    it('should generate fix for header spacing violation', () => {
      const content = '#Header';
      const violations = [
        new Violation(
          'format',
          'Header missing space after #',
          Severity.ERROR,
          new Location(1, 2)
        ),
      ];

      const fixes = AutoFixer.generateFixesForViolations(violations, content);

      expect(fixes).toHaveLength(1);
      expect(fixes[0]).toEqual({
        range: {
          start: { line: 1, column: 2 },
          end: { line: 1, column: 2 },
        },
        text: ' ',
        description: 'Add space after header #',
      });
    });

    it('should generate fix for trailing whitespace violation', () => {
      const content = 'Line with spaces   ';
      const violations = [
        new Violation(
          'format',
          'Line has trailing whitespace',
          Severity.WARNING,
          new Location(1, 18)
        ),
      ];

      const fixes = AutoFixer.generateFixesForViolations(violations, content);

      expect(fixes).toHaveLength(1);
      expect(fixes[0]).toEqual({
        range: {
          start: { line: 1, column: 17 },
          end: { line: 1, column: 20 },
        },
        text: '',
        description: 'Remove trailing whitespace',
      });
    });

    it('should generate fix for consecutive empty lines violation', () => {
      const content = 'Line 1\n\n\n\nLine 2';
      const violations = [
        new Violation(
          'format',
          'Too many consecutive empty lines (4), maximum 2 allowed',
          Severity.WARNING,
          new Location(2, 1)
        ),
      ];

      const fixes = AutoFixer.generateFixesForViolations(violations, content);

      expect(fixes).toHaveLength(1);
      expect(fixes[0]).toEqual({
        range: {
          start: { line: 2, column: 1 },
          end: { line: 3, column: 1 },
        },
        text: '',
        description: 'Remove extra empty line',
      });
    });
  });

  describe('format fix generation', () => {
    it('should create fix for header spacing when pattern matches', () => {
      const content = '#Header';
      
      // Create a fix manually that would be generated by the pattern matching
      const expectedFix: Fix = {
        range: {
          start: { line: 1, column: 2 },
          end: { line: 1, column: 2 },
        },
        text: ' ',
        description: 'Add space after header #',
      };

      const result = AutoFixer.applyFixes(content, [expectedFix]);
      
      expect(result.fixed).toBe(true);
      expect(result.content).toBe('# Header');
    });

    it('should create fix for trailing whitespace when pattern matches', () => {
      const content = 'Line with spaces   ';
      
      // Create a fix manually that would be generated by the pattern matching
      const expectedFix: Fix = {
        range: {
          start: { line: 1, column: 17 },
          end: { line: 1, column: 20 },
        },
        text: '',
        description: 'Remove trailing whitespace',
      };

      const result = AutoFixer.applyFixes(content, [expectedFix]);
      
      expect(result.fixed).toBe(true);
      expect(result.content).toBe('Line with spaces');
    });
  });

  describe('integration with fix application', () => {
    it('should handle complete fix workflow', () => {
      const content = '#Project Overview\nThis is a test.';
      
      // Manually create the fix that would be generated
      const fixes: Fix[] = [
        {
          range: {
            start: { line: 1, column: 2 },
            end: { line: 1, column: 2 },
          },
          text: ' ',
          description: 'Add space after header #',
        },
      ];

      const result = AutoFixer.applyFixes(content, fixes);

      expect(result.fixed).toBe(true);
      expect(result.content).toBe('# Project Overview\nThis is a test.');
      expect(result.appliedFixes).toHaveLength(1);
    });

    it('should handle multiple fixes correctly', () => {
      const content = '#Header\n##SubHeader';
      
      const fixes: Fix[] = [
        {
          range: {
            start: { line: 2, column: 3 },
            end: { line: 2, column: 3 },
          },
          text: ' ',
          description: 'Add space after header # in line 2',
        },
        {
          range: {
            start: { line: 1, column: 2 },
            end: { line: 1, column: 2 },
          },
          text: ' ',
          description: 'Add space after header # in line 1',
        },
      ];

      const result = AutoFixer.applyFixes(content, fixes);

      expect(result.fixed).toBe(true);
      expect(result.content).toBe('# Header\n## SubHeader');
      expect(result.appliedFixes).toHaveLength(2);
    });
  });

  describe('enhanced auto-fix capabilities', () => {
    describe('code block fixes', () => {
      it('should generate fix for unclosed code block', () => {
        const content = 'Text\n```javascript\nconst x = 1;';
        const violations = [
          new Violation(
            'format',
            'Unclosed code block',
            Severity.ERROR,
            new Location(2, 1)
          ),
        ];

        const fixes = AutoFixer.generateFixesForViolations(violations, content);

        expect(fixes).toHaveLength(1);
        expect(fixes[0]).toEqual({
          range: {
            start: { line: 3, column: 13 },
            end: { line: 3, column: 13 },
          },
          text: '\n```',
          description: 'Close unclosed code block',
        });
      });

      it('should generate fix for code block with invalid language', () => {
        const content = 'Text\n```invalidlang\ncode\n```';
        const violations = [
          new Violation(
            'format',
            'Unknown code block language: "invalidlang"',
            Severity.INFO,
            new Location(2, 4)
          ),
        ];

        const fixes = AutoFixer.generateFixesForViolations(violations, content);

        expect(fixes).toHaveLength(1);
        expect(fixes[0]).toEqual({
          range: {
            start: { line: 2, column: 4 },
            end: { line: 2, column: 15 },
          },
          text: 'text',
          description: 'Replace unknown language with "text"',
        });
      });
    });

    describe('file ending fixes', () => {
      it('should generate fix for missing final newline', () => {
        const content = 'Line 1\nLine 2';
        const violations = [
          new Violation(
            'format',
            'File should end with a newline',
            Severity.WARNING,
            new Location(2, 7)
          ),
        ];

        const fixes = AutoFixer.generateFixesForViolations(violations, content);

        expect(fixes).toHaveLength(1);
        expect(fixes[0]).toEqual({
          range: {
            start: { line: 2, column: 7 },
            end: { line: 2, column: 7 },
          },
          text: '\n',
          description: 'Add final newline',
        });
      });
    });

    describe('list consistency fixes', () => {
      it('should generate fix for inconsistent list markers', () => {
        const content = '- Item 1\n* Item 2\n+ Item 3';
        const violations = [
          new Violation(
            'format',
            'Inconsistent list markers found: -, *, +. Use consistent markers throughout.',
            Severity.WARNING,
            new Location(1, 1)
          ),
        ];

        const fixes = AutoFixer.generateFixesForViolations(violations, content);

        expect(fixes).toHaveLength(2);
        expect(fixes[0]).toEqual({
          range: {
            start: { line: 2, column: 1 },
            end: { line: 2, column: 2 },
          },
          text: '-',
          description: 'Standardize list marker to "-"',
        });
        expect(fixes[1]).toEqual({
          range: {
            start: { line: 3, column: 1 },
            end: { line: 3, column: 2 },
          },
          text: '-',
          description: 'Standardize list marker to "-"',
        });
      });
    });

    describe('integration tests for enhanced fixes', () => {
      it('should apply unclosed code block fix', () => {
        const content = 'Text\n```javascript\nconst x = 1;';
        const fixes: Fix[] = [
          {
            range: {
              start: { line: 3, column: 13 },
              end: { line: 3, column: 13 },
            },
            text: '\n```',
            description: 'Close unclosed code block',
          },
        ];

        const result = AutoFixer.applyFixes(content, fixes);

        expect(result.fixed).toBe(true);
        expect(result.content).toBe('Text\n```javascript\nconst x = 1;\n```');
        expect(result.appliedFixes).toHaveLength(1);
      });

      it('should apply final newline fix', () => {
        const content = 'Line 1\nLine 2';
        const fixes: Fix[] = [
          {
            range: {
              start: { line: 2, column: 7 },
              end: { line: 2, column: 7 },
            },
            text: '\n',
            description: 'Add final newline',
          },
        ];

        const result = AutoFixer.applyFixes(content, fixes);

        expect(result.fixed).toBe(true);
        expect(result.content).toBe('Line 1\nLine 2\n');
        expect(result.appliedFixes).toHaveLength(1);
      });

      it('should apply list marker standardization fix', () => {
        const content = '- Item 1\n* Item 2\n+ Item 3';
        const fixes: Fix[] = [
          {
            range: {
              start: { line: 2, column: 1 },
              end: { line: 2, column: 2 },
            },
            text: '-',
            description: 'Standardize list marker to "-"',
          },
          {
            range: {
              start: { line: 3, column: 1 },
              end: { line: 3, column: 2 },
            },
            text: '-',
            description: 'Standardize list marker to "-"',
          },
        ];

        const result = AutoFixer.applyFixes(content, fixes);

        expect(result.fixed).toBe(true);
        expect(result.content).toBe('- Item 1\n- Item 2\n- Item 3');
        expect(result.appliedFixes).toHaveLength(2);
      });
    });
  });
});