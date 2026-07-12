import { describe, it, expect } from 'vitest';
import { ContextFile } from '../../../../src/domain/ContextFile.js';
import { LintingResult } from '../../../../src/domain/LintingResult.js';
import { Violation } from '../../../../src/domain/Violation.js';
import { Location } from '../../../../src/domain/Location.js';
import { Severity } from '../../../../src/domain/Severity.js';
import { formatDirectoryResult } from '../../../../src/cli/formatters/directoryFormatter.js';

function resultWith(
  path: string,
  violations: Array<{ rule: string; severity: Severity }>
): LintingResult {
  const result = new LintingResult(new ContextFile(path, '# x\n'));
  for (const v of violations) {
    result.addViolation(
      new Violation(v.rule, `msg for ${v.rule}`, v.severity, new Location(1, 1))
    );
  }
  return result;
}

describe('formatDirectoryResult', () => {
  const results = [
    resultWith('a/CLAUDE.md', [
      { rule: 'structure', severity: Severity.ERROR },
    ]),
    resultWith('b/.claude/settings.json', [
      { rule: 'hook-configuration', severity: Severity.WARNING },
    ]),
    resultWith('c/CLAUDE.md', []),
  ];

  describe('text', () => {
    it('renders a per-file section for every file', () => {
      const out = formatDirectoryResult(results, 'text', { plain: true });
      expect(out).toContain('a/CLAUDE.md');
      expect(out).toContain('b/.claude/settings.json');
      expect(out).toContain('c/CLAUDE.md');
      expect(out).toContain('No issues found in c/CLAUDE.md');
    });

    it('renders an aggregate summary across files', () => {
      const out = formatDirectoryResult(results, 'text', { plain: true });
      expect(out).toContain('3 files');
      expect(out).toContain('1 error');
      expect(out).toContain('1 warning');
    });
  });

  describe('json', () => {
    it('includes every file with its own violations and a total summary', () => {
      const parsed = JSON.parse(formatDirectoryResult(results, 'json', {})) as {
        results: Array<{ file: string; violations: unknown[] }>;
        summary: { files: number; errors: number; warnings: number };
      };

      expect(parsed.results).toHaveLength(3);
      expect(parsed.summary.files).toBe(3);
      expect(parsed.summary.errors).toBe(1);
      expect(parsed.summary.warnings).toBe(1);
      expect(parsed.results.map(r => r.file)).toContain('a/CLAUDE.md');
    });
  });

  describe('sarif', () => {
    it('emits one run with results from all files and multiple artifact URIs', () => {
      const sarif = JSON.parse(formatDirectoryResult(results, 'sarif', {})) as {
        version: string;
        runs: Array<{
          results: Array<{
            locations: Array<{
              physicalLocation: { artifactLocation: { uri: string } };
            }>;
          }>;
        }>;
      };

      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs).toHaveLength(1);
      // Two violations across two files.
      expect(sarif.runs[0]!.results).toHaveLength(2);
      const uris = sarif.runs[0]!.results.map(
        r => r.locations[0]!.physicalLocation.artifactLocation.uri
      );
      expect(new Set(uris).size).toBe(2);
    });
  });
});
