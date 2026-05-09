import { LintingResult } from '../../domain/LintingResult.js';
import { Severity } from '../../domain/Severity.js';

export interface FormatOptions {
  plain?: boolean | undefined;
  fixableCount?: number | undefined;
  summary?: boolean | undefined;
}

const RULE_GROUP_THRESHOLD = 4;

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

  if (options.summary) {
    lines.push(...formatSummaryGroups(result, emoji));
  } else {
    lines.push(...formatViolationList(result, emoji));
  }

  lines.push('');
  lines.push(formatSummaryLine(result, emoji));
  const footer = formatFooter(result, options);
  if (footer) {
    lines.push(footer);
  }

  return lines.join('\n');
}

function formatViolationList(result: LintingResult, emoji: boolean): string[] {
  const out: string[] = [];
  const ruleCounts = countByRule(result);

  // Track which rules we've already collapsed
  const collapsedRules = new Set<string>();

  for (const violation of result.violations) {
    const count = ruleCounts.get(violation.ruleId) ?? 0;

    // Collapse rules firing ≥THRESHOLD times to first item + summary
    if (count >= RULE_GROUP_THRESHOLD) {
      if (collapsedRules.has(violation.ruleId)) {
        continue;
      }
      collapsedRules.add(violation.ruleId);
      const prefix = getSeverityPrefix(violation.severity, emoji);
      out.push(`${prefix} ${violation.toString()}`);
      out.push(
        `         … and ${count - 1} more from rule [${violation.ruleId}]. Run \`cclint lint <file> --summary\` for grouped view.`
      );
    } else {
      const prefix = getSeverityPrefix(violation.severity, emoji);
      out.push(`${prefix} ${violation.toString()}`);
    }
  }

  return out;
}

function formatSummaryGroups(result: LintingResult, emoji: boolean): string[] {
  const out: string[] = [];
  const groups = new Map<
    string,
    { severity: Severity; count: number; firstLine: number }
  >();

  for (const violation of result.violations) {
    const existing = groups.get(violation.ruleId);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(violation.ruleId, {
        severity: violation.severity,
        count: 1,
        firstLine: violation.location.line,
      });
    }
  }

  // Sort: errors first, warnings, then info; within severity by descending count
  const sorted = [...groups.entries()].sort((a, b) => {
    const sevDiff = b[1].severity.compareTo(a[1].severity);
    if (sevDiff !== 0) return sevDiff;
    return b[1].count - a[1].count;
  });

  for (const [ruleId, info] of sorted) {
    const prefix = getSeverityPrefix(info.severity, emoji);
    const plural = info.count === 1 ? '' : 's';
    out.push(
      `${prefix} ${ruleId} (${info.count} occurrence${plural}, first at line ${info.firstLine})`
    );
  }

  return out;
}

function countByRule(result: LintingResult): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of result.violations) {
    counts.set(v.ruleId, (counts.get(v.ruleId) ?? 0) + 1);
  }
  return counts;
}

function formatSummaryLine(result: LintingResult, emoji: boolean): string {
  const errors = result.getErrorCount();
  const warnings = result.getWarningCount();
  const infos = result.getInfoCount();

  const parts: string[] = [];
  if (errors > 0) {
    parts.push(
      emoji
        ? `❌ ${errors} error${errors === 1 ? '' : 's'}`
        : `${errors} error${errors === 1 ? '' : 's'}`
    );
  }
  if (warnings > 0) {
    parts.push(
      emoji
        ? `⚠️  ${warnings} warning${warnings === 1 ? '' : 's'}`
        : `${warnings} warning${warnings === 1 ? '' : 's'}`
    );
  }
  if (infos > 0) {
    parts.push(emoji ? `ℹ️  ${infos} info` : `${infos} info`);
  }

  return `Summary: ${parts.length > 0 ? parts.join(', ') : '0 issues'}`;
}

function formatFooter(
  result: LintingResult,
  options: FormatOptions
): string | null {
  const fixable = options.fixableCount ?? 0;
  if (fixable > 0) {
    return `→ ${fixable} of ${result.violations.length} ${fixable === 1 ? 'issue is' : 'issues are'} auto-fixable. Run with --fix.`;
  }
  return null;
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
