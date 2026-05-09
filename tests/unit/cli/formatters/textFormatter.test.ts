import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { formatResult } from '../../../../src/cli/formatters/textFormatter.js';
import { LintingResult } from '../../../../src/domain/LintingResult.js';
import { ContextFile } from '../../../../src/domain/ContextFile.js';
import { Violation } from '../../../../src/domain/Violation.js';
import { Severity } from '../../../../src/domain/Severity.js';
import { Location } from '../../../../src/domain/Location.js';

describe('textFormatter', () => {
  const file = new ContextFile('CLAUDE.md', '# Test\n');
  const errorViolation = new Violation(
    'structure',
    'Missing required section',
    Severity.ERROR,
    new Location(1, 1)
  );
  const warningViolation = new Violation(
    'file-size',
    'File too large',
    Severity.WARNING,
    new Location(1, 1)
  );
  const infoViolation = new Violation(
    'content-organization',
    'Consider adding emphasis',
    Severity.INFO,
    new Location(1, 1)
  );

  const originalCi = process.env['CI'];
  const originalNoEmoji = process.env['NO_EMOJI'];
  const originalNoColor = process.env['NO_COLOR'];

  beforeEach(() => {
    delete process.env['CI'];
    delete process.env['NO_EMOJI'];
    delete process.env['NO_COLOR'];
  });

  afterEach(() => {
    if (originalCi !== undefined) process.env['CI'] = originalCi;
    if (originalNoEmoji !== undefined)
      process.env['NO_EMOJI'] = originalNoEmoji;
    if (originalNoColor !== undefined)
      process.env['NO_COLOR'] = originalNoColor;
  });

  describe('plain mode', () => {
    it('should emit text severity tokens without emoji when plain=true', () => {
      const result = new LintingResult(file);
      result.addViolation(errorViolation);
      result.addViolation(warningViolation);
      result.addViolation(infoViolation);

      const output = formatResult(result, 'text', { plain: true });

      expect(output).toContain('[ERROR]');
      expect(output).toContain('[WARN]');
      expect(output).toContain('[INFO]');
      expect(output).not.toContain('❌');
      expect(output).not.toContain('⚠️');
      expect(output).not.toContain('ℹ️');
      expect(output).not.toContain('📝');
    });

    it('should plain-format the empty success state', () => {
      const result = new LintingResult(file);

      const output = formatResult(result, 'text', { plain: true });

      expect(output).toContain('[OK]');
      expect(output).not.toContain('✅');
    });
  });

  describe('environment-driven plain mode', () => {
    it('should disable emoji when CI=true', () => {
      process.env['CI'] = 'true';

      const result = new LintingResult(file);
      result.addViolation(errorViolation);
      const output = formatResult(result, 'text');

      expect(output).toContain('[ERROR]');
      expect(output).not.toContain('❌');
    });

    it('should disable emoji when NO_EMOJI=1', () => {
      process.env['NO_EMOJI'] = '1';

      const result = new LintingResult(file);
      result.addViolation(errorViolation);
      const output = formatResult(result, 'text');

      expect(output).not.toContain('❌');
    });

    it('should disable emoji when NO_COLOR=1', () => {
      process.env['NO_COLOR'] = '1';

      const result = new LintingResult(file);
      result.addViolation(errorViolation);
      const output = formatResult(result, 'text');

      expect(output).not.toContain('❌');
    });
  });

  describe('rule grouping', () => {
    it('should collapse rules firing 4+ times in default view', () => {
      const result = new LintingResult(file);
      for (let i = 0; i < 6; i++) {
        result.addViolation(
          new Violation(
            'monorepo-hierarchy',
            `Sibling overlap ${i}`,
            Severity.WARNING,
            new Location(i + 1, 1)
          )
        );
      }

      const output = formatResult(result, 'text', { plain: true });

      expect(output).toContain('and 5 more from rule [monorepo-hierarchy]');
      expect(output).toContain('--summary');
    });

    it('should not collapse rules firing fewer than 4 times', () => {
      const result = new LintingResult(file);
      for (let i = 0; i < 3; i++) {
        result.addViolation(
          new Violation(
            'file-location',
            `Issue ${i}`,
            Severity.INFO,
            new Location(i + 1, 1)
          )
        );
      }

      const output = formatResult(result, 'text', { plain: true });

      expect(output).not.toContain('and');
      expect((output.match(/file-location/g) ?? []).length).toBe(3);
    });
  });

  describe('summary mode', () => {
    it('should group violations by rule with counts', () => {
      const result = new LintingResult(file);
      result.addViolation(errorViolation);
      result.addViolation(errorViolation);
      result.addViolation(warningViolation);

      const output = formatResult(result, 'text', {
        plain: true,
        summary: true,
      });

      expect(output).toContain('structure (2 occurrences');
      expect(output).toContain('file-size (1 occurrence');
    });

    it('should sort errors before warnings before info', () => {
      const result = new LintingResult(file);
      result.addViolation(infoViolation);
      result.addViolation(warningViolation);
      result.addViolation(errorViolation);

      const output = formatResult(result, 'text', {
        plain: true,
        summary: true,
      });

      const errIdx = output.indexOf('[ERROR]');
      const warnIdx = output.indexOf('[WARN]');
      const infoIdx = output.indexOf('[INFO]');

      expect(errIdx).toBeGreaterThanOrEqual(0);
      expect(errIdx).toBeLessThan(warnIdx);
      expect(warnIdx).toBeLessThan(infoIdx);
    });
  });

  describe('fixable footer', () => {
    it('should show fixable count footer when fixableCount > 0', () => {
      const result = new LintingResult(file);
      result.addViolation(warningViolation);
      result.addViolation(warningViolation);

      const output = formatResult(result, 'text', {
        plain: true,
        fixableCount: 2,
      });

      expect(output).toContain('2 of 2 issues are auto-fixable');
      expect(output).toContain('--fix');
    });

    it('should pluralize correctly when fixableCount is 1', () => {
      const result = new LintingResult(file);
      result.addViolation(errorViolation);
      result.addViolation(warningViolation);

      const output = formatResult(result, 'text', {
        plain: true,
        fixableCount: 1,
      });

      expect(output).toContain('1 of 2 issue is auto-fixable');
    });

    it('should omit footer when fixableCount is 0 or undefined', () => {
      const result = new LintingResult(file);
      result.addViolation(errorViolation);

      const output = formatResult(result, 'text', { plain: true });

      expect(output).not.toContain('--fix');
      expect(output).not.toContain('auto-fixable');
    });
  });

  describe('summary line', () => {
    it('should include all severity counts when present', () => {
      const result = new LintingResult(file);
      result.addViolation(errorViolation);
      result.addViolation(warningViolation);
      result.addViolation(infoViolation);

      const output = formatResult(result, 'text', { plain: true });

      expect(output).toContain('1 error');
      expect(output).toContain('1 warning');
      expect(output).toContain('1 info');
    });

    it('should omit zero-count severities from summary line', () => {
      const result = new LintingResult(file);
      result.addViolation(errorViolation);

      const output = formatResult(result, 'text', { plain: true });
      const summaryLine = output.split('\n').find(l => l.startsWith('Summary'));

      expect(summaryLine).toBe('Summary: 1 error');
    });
  });

  describe('json mode unchanged', () => {
    it('should still emit JSON when format=json', () => {
      const result = new LintingResult(file);
      result.addViolation(errorViolation);
      const output = formatResult(result, 'json');

      const parsed = JSON.parse(output);
      expect(parsed.violations).toHaveLength(1);
      expect(parsed.violations[0].severity).toBe('error');
    });
  });
});
