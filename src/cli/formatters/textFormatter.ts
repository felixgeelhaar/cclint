import { LintingResult } from '../../domain/LintingResult.js';
import { Severity } from '../../domain/Severity.js';

export interface FormatOptions {
  plain?: boolean | undefined;
}

export function formatResult(
  result: LintingResult,
  format: string = 'text',
  options: FormatOptions = {}
): string {
  if (format === 'json') {
    return formatJsonResult(result);
  }

  return formatTextResult(result, options);
}

function shouldUseEmoji(plainOpt?: boolean): boolean {
  if (plainOpt === true) return false;
  if (process.env['NO_EMOJI'] === '1' || process.env['NO_COLOR'] === '1') {
    return false;
  }
  if (process.env['CI'] === 'true') return false;
  return Boolean(process.stdout.isTTY);
}

function formatTextResult(
  result: LintingResult,
  options: FormatOptions
): string {
  const lines: string[] = [];
  const emoji = shouldUseEmoji(options.plain);

  if (!result.hasViolations()) {
    lines.push(
      emoji
        ? `✅ No issues found in ${result.file.path}`
        : `[OK] No issues found in ${result.file.path}`
    );
    return lines.join('\n');
  }

  lines.push(
    emoji
      ? `📝 Linting results for ${result.file.path}:`
      : `Linting results for ${result.file.path}:`
  );
  lines.push('');

  for (const violation of result.violations) {
    const prefix = getSeverityPrefix(violation.severity, emoji);
    lines.push(`${prefix} ${violation.toString()}`);
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

function getSeverityPrefix(severity: Severity, emoji: boolean): string {
  if (severity === Severity.ERROR) {
    return emoji ? '❌ [ERROR]' : '[ERROR]';
  } else if (severity === Severity.WARNING) {
    return emoji ? '⚠️ [WARN]' : '[WARN]';
  } else {
    return emoji ? 'ℹ️ [INFO]' : '[INFO]';
  }
}
