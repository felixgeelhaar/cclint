import { LintingResult } from '../../domain/LintingResult.js';
import { Severity } from '../../domain/Severity.js';

export function formatResult(
  result: LintingResult,
  format: string = 'text'
): string {
  if (format === 'json') {
    return formatJsonResult(result);
  }

  return formatTextResult(result);
}

function formatTextResult(result: LintingResult): string {
  const lines: string[] = [];

  if (!result.hasViolations()) {
    lines.push(`✅ No issues found in ${result.file.path}`);
    return lines.join('\n');
  }

  lines.push(`📝 Linting results for ${result.file.path}:`);
  lines.push('');

  for (const violation of result.violations) {
    const icon = getSeverityIcon(violation.severity);
    lines.push(`${icon} ${violation.toString()}`);
  }

  lines.push('');
  lines.push(
    `Summary: ${result.getErrorCount()} errors, ${result.getWarningCount()} warnings`
  );

  return lines.join('\n');
}

function formatJsonResult(result: LintingResult): string {
  const jsonResult = {
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
  };

  return JSON.stringify(jsonResult, null, 2);
}

function getSeverityIcon(severity: Severity): string {
  if (severity === Severity.ERROR) {
    return '❌';
  } else if (severity === Severity.WARNING) {
    return '⚠️';
  } else {
    return 'ℹ️';
  }
}
