import { describe, it, expect, beforeEach } from 'vitest';
import { InteractiveFixer } from '../../../src/infrastructure/InteractiveFixer.js';
import { Violation } from '../../../src/domain/Violation.js';
import { Location } from '../../../src/domain/Location.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('InteractiveFixer', () => {
  let outputMessages: string[];
  let mockOutput: (message: string) => void;

  beforeEach(() => {
    outputMessages = [];
    mockOutput = (message: string): void => {
      outputMessages.push(message);
    };
  });

  const createViolation = (
    message: string,
    line: number,
    ruleId: string = 'format'
  ): Violation => {
    return new Violation(
      ruleId,
      message,
      Severity.WARNING,
      new Location(line, 1)
    );
  };

  describe('fix', () => {
    it('should handle no violations', async () => {
      const fixer = new InteractiveFixer({
        outputFn: mockOutput,
        promptFn: (): Promise<string> => Promise.resolve('y'),
      });

      const result = await fixer.fix('# Test', [], []);

      expect(result.fixed).toBe(false);
      expect(result.appliedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(outputMessages).toContain('No fixes available.');
    });

    it('should apply fix when user answers yes', async () => {
      const content = '##Header';
      const violations = [createViolation('Header missing space after ##', 1)];

      const fixer = new InteractiveFixer({
        outputFn: mockOutput,
        promptFn: (): Promise<string> => Promise.resolve('y'),
      });

      const result = await fixer.fix(content, violations, []);

      expect(result.fixed).toBe(true);
      expect(result.appliedCount).toBe(1);
      expect(result.skippedCount).toBe(0);
      expect(result.content).toBe('## Header');
    });

    it('should skip fix when user answers no', async () => {
      const content = '##Header';
      const violations = [createViolation('Header missing space after ##', 1)];

      const fixer = new InteractiveFixer({
        outputFn: mockOutput,
        promptFn: (): Promise<string> => Promise.resolve('n'),
      });

      const result = await fixer.fix(content, violations, []);

      expect(result.fixed).toBe(false);
      expect(result.appliedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.content).toBe(content);
    });

    it('should apply all remaining fixes when user answers all', async () => {
      const content = '##Header1\n##Header2';
      const violations = [
        createViolation('Header missing space after ##', 1),
        createViolation('Header missing space after ##', 2),
      ];

      let promptCount = 0;
      const fixer = new InteractiveFixer({
        outputFn: mockOutput,
        promptFn: (): Promise<string> => {
          promptCount++;
          return Promise.resolve(promptCount === 1 ? 'a' : 'n'); // Answer 'all' on first prompt
        },
      });

      const result = await fixer.fix(content, violations, []);

      expect(result.fixed).toBe(true);
      expect(result.appliedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(promptCount).toBe(1); // Only prompted once due to 'all'
    });

    it('should quit early when user answers quit', async () => {
      const content = '##Header1\n##Header2';
      const violations = [
        createViolation('Header missing space after ##', 1),
        createViolation('Header missing space after ##', 2),
      ];

      const fixer = new InteractiveFixer({
        outputFn: mockOutput,
        promptFn: (): Promise<string> => Promise.resolve('q'),
      });

      const result = await fixer.fix(content, violations, []);

      expect(result.fixed).toBe(false);
      expect(result.appliedCount).toBe(0);
      expect(result.skippedCount).toBe(2);
      expect(result.quitEarly).toBe(true);
    });

    it('should accept full words for responses', async () => {
      const content = '##Header';
      const violations = [createViolation('Header missing space after ##', 1)];

      const fixer = new InteractiveFixer({
        outputFn: mockOutput,
        promptFn: (): Promise<string> => Promise.resolve('yes'),
      });

      const result = await fixer.fix(content, violations, []);

      expect(result.fixed).toBe(true);
      expect(result.appliedCount).toBe(1);
    });

    it('should show fix preview with context lines', async () => {
      const content = 'Line 1\nLine 2\n##Header\nLine 4\nLine 5';
      const violations = [createViolation('Header missing space after ##', 3)];

      const fixer = new InteractiveFixer({
        outputFn: mockOutput,
        promptFn: (): Promise<string> => Promise.resolve('y'),
        contextLines: 2,
      });

      await fixer.fix(content, violations, []);

      // Check that output contains preview elements
      const fullOutput = outputMessages.join('\n');
      expect(fullOutput).toContain('Fix 1/1');
      expect(fullOutput).toContain('Location: Line 3');
    });

    it('should show summary after completion', async () => {
      const content = '##Header';
      const violations = [createViolation('Header missing space after ##', 1)];

      const fixer = new InteractiveFixer({
        outputFn: mockOutput,
        promptFn: (): Promise<string> => Promise.resolve('y'),
      });

      await fixer.fix(content, violations, []);

      const fullOutput = outputMessages.join('\n');
      expect(fullOutput).toContain('Summary');
      expect(fullOutput).toContain('Applied: 1');
      expect(fullOutput).toContain('Skipped: 0');
    });

    it('should handle mixed yes/no responses', async () => {
      const content = '##Header1\n##Header2\n##Header3';
      const violations = [
        createViolation('Header missing space after ##', 1),
        createViolation('Header missing space after ##', 2),
        createViolation('Header missing space after ##', 3),
      ];

      let promptCount = 0;
      const responses = ['y', 'n', 'y'];
      const fixer = new InteractiveFixer({
        outputFn: mockOutput,
        promptFn: (): Promise<string> =>
          Promise.resolve(responses[promptCount++] ?? 'n'),
      });

      const result = await fixer.fix(content, violations, []);

      expect(result.appliedCount).toBe(2);
      expect(result.skippedCount).toBe(1);
    });

    it('should fix trailing whitespace', async () => {
      const content = '# Header   ';
      const violations = [createViolation('Line has trailing whitespace', 1)];

      const fixer = new InteractiveFixer({
        outputFn: mockOutput,
        promptFn: (): Promise<string> => Promise.resolve('y'),
      });

      const result = await fixer.fix(content, violations, []);

      expect(result.fixed).toBe(true);
      expect(result.content).toBe('# Header');
    });

    it('should visualize whitespace in preview', async () => {
      const content = '# Header   ';
      const violations = [createViolation('Line has trailing whitespace', 1)];

      const fixer = new InteractiveFixer({
        outputFn: mockOutput,
        promptFn: (): Promise<string> => Promise.resolve('n'),
      });

      await fixer.fix(content, violations, []);

      const fullOutput = outputMessages.join('\n');
      // Should show trailing spaces as dots
      expect(fullOutput).toContain('···');
    });
  });
});
