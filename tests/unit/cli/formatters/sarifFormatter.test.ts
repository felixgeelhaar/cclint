import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { formatSarifResult } from '../../../../src/cli/formatters/sarifFormatter.js';
import { LintingResult } from '../../../../src/domain/LintingResult.js';
import { ContextFile } from '../../../../src/domain/ContextFile.js';
import { Violation } from '../../../../src/domain/Violation.js';
import { Severity } from '../../../../src/domain/Severity.js';
import { Location } from '../../../../src/domain/Location.js';

// Deterministic tool metadata for snapshot-friendly assertions.
const OPTS = {
  toolVersion: '9.9.9',
  informationUri: 'https://example.test/cclint',
};

function makeResult(path = 'CLAUDE.md', content = '# Test\n'): LintingResult {
  return new LintingResult(new ContextFile(path, content));
}

describe('sarifFormatter', () => {
  describe('document structure', () => {
    it('produces a valid SARIF 2.1.0 skeleton', () => {
      const result = makeResult();
      const sarif = JSON.parse(formatSarifResult(result, OPTS));

      expect(sarif.version).toBe('2.1.0');
      expect(sarif.$schema).toMatch(/sarif.*2\.1\.0/i);
      expect(Array.isArray(sarif.runs)).toBe(true);
      expect(sarif.runs).toHaveLength(1);

      const driver = sarif.runs[0].tool.driver;
      expect(driver.name).toBe('cclint');
      expect(driver.version).toBe('9.9.9');
      expect(driver.informationUri).toBe('https://example.test/cclint');
      expect(Array.isArray(driver.rules)).toBe(true);
    });

    it('reads the driver version from package.json by default', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      const pkg = JSON.parse(
        readFileSync(join(here, '../../../../package.json'), 'utf-8')
      );

      const result = makeResult();
      const sarif = JSON.parse(formatSarifResult(result));

      expect(sarif.runs[0].tool.driver.version).toBe(pkg.version);
      expect(sarif.runs[0].tool.driver.informationUri).toBe(pkg.homepage);
    });
  });

  describe('empty results', () => {
    it('emits an empty results array and no rules', () => {
      const result = makeResult();
      const sarif = JSON.parse(formatSarifResult(result, OPTS));

      expect(sarif.runs[0].results).toEqual([]);
      expect(sarif.runs[0].tool.driver.rules).toEqual([]);
    });
  });

  describe('result mapping', () => {
    it('maps a violation to a SARIF result with location', () => {
      const result = makeResult('docs/CLAUDE.md');
      result.addViolation(
        new Violation(
          'structure',
          'Missing required section',
          Severity.ERROR,
          new Location(3, 5)
        )
      );

      const sarif = JSON.parse(formatSarifResult(result, OPTS));
      const [r] = sarif.runs[0].results;

      expect(r.ruleId).toBe('structure');
      expect(r.level).toBe('error');
      expect(r.message.text).toBe('Missing required section');

      const phys = r.locations[0].physicalLocation;
      expect(phys.artifactLocation.uri).toBe('docs/CLAUDE.md');
      expect(phys.region.startLine).toBe(3);
      expect(phys.region.startColumn).toBe(5);
    });

    it('clamps a zero column to 1 to stay valid SARIF', () => {
      const result = makeResult();
      result.addViolation(
        new Violation(
          'format',
          'Whole-line issue',
          Severity.WARNING,
          new Location(2, 0)
        )
      );

      const sarif = JSON.parse(formatSarifResult(result, OPTS));
      const region =
        sarif.runs[0].results[0].locations[0].physicalLocation.region;

      expect(region.startLine).toBe(2);
      expect(region.startColumn).toBe(1);
    });
  });

  describe('severity to level mapping', () => {
    it('maps error to error', () => {
      const result = makeResult();
      result.addViolation(
        new Violation('structure', 'e', Severity.ERROR, new Location(1, 1))
      );
      const sarif = JSON.parse(formatSarifResult(result, OPTS));
      expect(sarif.runs[0].results[0].level).toBe('error');
    });

    it('maps warning to warning', () => {
      const result = makeResult();
      result.addViolation(
        new Violation('format', 'w', Severity.WARNING, new Location(1, 1))
      );
      const sarif = JSON.parse(formatSarifResult(result, OPTS));
      expect(sarif.runs[0].results[0].level).toBe('warning');
    });

    it('maps info to note', () => {
      const result = makeResult();
      result.addViolation(
        new Violation('karpathy', 'i', Severity.INFO, new Location(1, 1))
      );
      const sarif = JSON.parse(formatSarifResult(result, OPTS));
      expect(sarif.runs[0].results[0].level).toBe('note');
    });
  });

  describe('rules array', () => {
    it('populates rules from the rule ids that produced results, with shortDescription', () => {
      const result = makeResult();
      result.addViolation(
        new Violation('structure', 'a', Severity.ERROR, new Location(1, 1))
      );
      result.addViolation(
        new Violation('structure', 'b', Severity.ERROR, new Location(2, 1))
      );
      result.addViolation(
        new Violation('format', 'c', Severity.WARNING, new Location(3, 1))
      );

      const sarif = JSON.parse(formatSarifResult(result, OPTS));
      const rules = sarif.runs[0].tool.driver.rules;

      // Deduplicated: structure + format => 2 rules, sorted by id.
      expect(rules.map((rule: { id: string }) => rule.id)).toEqual([
        'format',
        'structure',
      ]);
      for (const rule of rules) {
        expect(typeof rule.shortDescription.text).toBe('string');
        expect(rule.shortDescription.text.length).toBeGreaterThan(0);
      }
    });

    it('falls back to the rule id when no metadata description exists', () => {
      const result = makeResult();
      result.addViolation(
        new Violation(
          'custom-plugin-rule',
          'x',
          Severity.ERROR,
          new Location(1, 1)
        )
      );
      const sarif = JSON.parse(formatSarifResult(result, OPTS));
      const rule = sarif.runs[0].tool.driver.rules[0];
      expect(rule.id).toBe('custom-plugin-rule');
      expect(rule.shortDescription.text).toContain('custom-plugin-rule');
    });
  });

  describe('multiple files / determinism', () => {
    it('normalizes absolute paths to relative forward-slash URIs', () => {
      const abs = join(process.cwd(), 'nested', 'CLAUDE.md');
      const result = makeResult(abs);
      result.addViolation(
        new Violation('structure', 'x', Severity.ERROR, new Location(1, 1))
      );
      const sarif = JSON.parse(formatSarifResult(result, OPTS));
      expect(
        sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation
          .uri
      ).toBe('nested/CLAUDE.md');
    });

    it('produces byte-identical output for identical input (stable ordering)', () => {
      const build = (): string => {
        const result = makeResult();
        result.addViolation(
          new Violation('format', 'w', Severity.WARNING, new Location(2, 1))
        );
        result.addViolation(
          new Violation('structure', 'e', Severity.ERROR, new Location(1, 1))
        );
        return formatSarifResult(result, OPTS);
      };
      expect(build()).toBe(build());
    });
  });
});
