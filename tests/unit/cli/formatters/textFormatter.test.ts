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
