import type { LintingResult } from '../../domain/LintingResult.js';
import { formatResult, type FormatOptions } from './textFormatter.js';
import { formatSarifResults } from './sarifFormatter.js';

/**
 * Aggregate totals across every linted file in a project-wide run.
 */
export interface DirectorySummary {
  files: number;
  errors: number;
  warnings: number;
  infos: number;
}

/**
 * Format the results of linting a whole directory of config files.
 *
 * @remarks
 * Mirrors the single-file {@link formatResult} contract for `--format`:
 * - `text`  — a per-file section (reusing the single-file text renderer)
 *   followed by an aggregate summary line.
 * - `json`  — `{ results: [...per file...], summary: {...totals...} }`.
 * - `sarif` — one SARIF run carrying every file's results (SARIF supports
 *   multiple artifacts natively).
 */
export function formatDirectoryResult(
  results: readonly LintingResult[],
  format: string = 'text',
  options: FormatOptions = {}
): string {
  if (format === 'json') {
    return formatJson(results);
  }

  if (format === 'sarif') {
    return formatSarifResults(results);
  }

  return formatText(results, options);
}

/** Sum error/warning/info counts across all files. */
export function summarize(results: readonly LintingResult[]): DirectorySummary {
  return results.reduce<DirectorySummary>(
    (acc, result) => ({
      files: acc.files + 1,
      errors: acc.errors + result.getErrorCount(),
      warnings: acc.warnings + result.getWarningCount(),
      infos: acc.infos + result.getInfoCount(),
    }),
    { files: 0, errors: 0, warnings: 0, infos: 0 }
  );
}

function formatText(
  results: readonly LintingResult[],
  options: FormatOptions
): string {
  const sections = results.map(result =>
    formatResult(result, 'text', options)
  );
  const summary = summarize(results);

  const parts: string[] = [];
  const errorText = `${summary.errors} error${summary.errors === 1 ? '' : 's'}`;
  const warningText = `${summary.warnings} warning${summary.warnings === 1 ? '' : 's'}`;
  const infoText = `${summary.infos} info`;
  parts.push(errorText, warningText, infoText);

  const fileText = `${summary.files} file${summary.files === 1 ? '' : 's'}`;
  const aggregate = `Checked ${fileText}: ${parts.join(', ')}`;

  return [...sections, '', aggregate].join('\n');
}

function formatJson(results: readonly LintingResult[]): string {
  const payload = {
    results: results.map(result => ({
      file: result.file.path,
      violations: result.violations.map(violation => ({
        ruleId: violation.ruleId,
        message: violation.message,
        severity: violation.severity.name,
        location: {
          line: violation.location.line,
          column: violation.location.column,
        },
      })),
      summary: {
        errors: result.getErrorCount(),
        warnings: result.getWarningCount(),
        infos: result.getInfoCount(),
      },
    })),
    summary: summarize(results),
  };

  return JSON.stringify(payload, null, 2);
}
