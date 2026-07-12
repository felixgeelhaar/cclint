import {
  DiagnosticSeverity,
  CodeActionKind,
  type CodeAction,
  type Diagnostic,
  type Position,
  type Range,
  type TextEdit,
} from 'vscode-languageserver';
import { Severity } from '../domain/Severity.js';
import type { Location } from '../domain/Location.js';
import type { Violation } from '../domain/Violation.js';
import type { LintingResult } from '../domain/LintingResult.js';
import type { Fix } from '../domain/AutoFix.js';

/**
 * The `source` field attached to every diagnostic, so editors label cclint
 * findings distinctly from other language servers active on the same document.
 */
export const CCLINT_SOURCE = 'cclint';

/**
 * Structured payload carried on each diagnostic's `data` field.
 *
 * @remarks
 * `fixable` lets a client decide whether to request a code action without
 * re-linting; it mirrors whether the originating {@link Violation} carried a
 * structured {@link Fix}.
 */
export interface DiagnosticData {
  ruleId: string;
  fixable: boolean;
}

/**
 * Map a cclint {@link Severity} to the corresponding LSP `DiagnosticSeverity`.
 */
export function severityToDiagnosticSeverity(
  severity: Severity
): DiagnosticSeverity {
  if (severity === Severity.ERROR) {
    return DiagnosticSeverity.Error;
  }
  if (severity === Severity.WARNING) {
    return DiagnosticSeverity.Warning;
  }
  return DiagnosticSeverity.Information;
}

/**
 * Convert a cclint {@link Location} (1-based line and column) to an LSP
 * {@link Position} (0-based line and character).
 *
 * @remarks
 * cclint columns are 1-based; a defensive `Math.max` guards the rare case of a
 * column reported as `0` so the character never becomes negative.
 */
export function locationToPosition(location: Location): Position {
  return {
    line: location.line - 1,
    character: Math.max(0, location.column - 1),
  };
}

/**
 * Convert a cclint {@link Fix} range (1-based start/end {@link Location}s) to an
 * LSP {@link Range} (0-based positions).
 */
export function fixRangeToRange(range: Fix['range']): Range {
  return {
    start: locationToPosition(range.start),
    end: locationToPosition(range.end),
  };
}

/**
 * Derive the LSP {@link Range} a diagnostic should highlight.
 *
 * @remarks
 * When the violation carries a structured fix, its range pinpoints the exact
 * span to replace, which is the most precise thing to underline. Otherwise we
 * fall back to a single-character range at the reported location — the pure
 * mapping has no document text, so it cannot extend the span to the token or
 * line end.
 */
function diagnosticRange(violation: Violation): Range {
  if (violation.fix) {
    return fixRangeToRange(violation.fix.range);
  }
  const start = locationToPosition(violation.location);
  return {
    start,
    end: { line: start.line, character: start.character + 1 },
  };
}

/**
 * Map a single cclint {@link Violation} to an LSP {@link Diagnostic}.
 */
export function violationToDiagnostic(violation: Violation): Diagnostic {
  const data: DiagnosticData = {
    ruleId: violation.ruleId,
    fixable: violation.fix !== undefined,
  };
  return {
    range: diagnosticRange(violation),
    severity: severityToDiagnosticSeverity(violation.severity),
    code: violation.ruleId,
    source: CCLINT_SOURCE,
    message: violation.message,
    data,
  };
}

/**
 * Map every violation in a {@link LintingResult} to LSP diagnostics, preserving
 * order. Returns an empty array for a clean result.
 */
export function violationsToDiagnostics(result: LintingResult): Diagnostic[] {
  return result.violations.map(violationToDiagnostic);
}

/**
 * Convert a cclint {@link Fix} to an LSP {@link TextEdit}.
 */
export function fixToTextEdit(fix: Fix): TextEdit {
  return {
    range: fixRangeToRange(fix.range),
    newText: fix.text,
  };
}

/**
 * Build a quick-fix {@link CodeAction} for a violation that carries a structured
 * {@link Fix}, or `undefined` when the violation has no fix.
 *
 * @param violation - the violation to offer a fix for
 * @param uri - the document URI the edit applies to
 *
 * @remarks
 * The fix comes straight from the rule that detected the problem (via
 * {@link Violation.fix}), so the edit is authoritative rather than re-derived
 * by pattern-matching the message. The originating diagnostic is attached to
 * the action so editors can associate the fix with the squiggle it resolves.
 */
export function violationToCodeAction(
  violation: Violation,
  uri: string
): CodeAction | undefined {
  const fix = violation.fix;
  if (!fix) {
    return undefined;
  }
  return {
    title: `cclint: ${fix.description}`,
    kind: CodeActionKind.QuickFix,
    diagnostics: [violationToDiagnostic(violation)],
    isPreferred: true,
    edit: {
      changes: {
        [uri]: [fixToTextEdit(fix)],
      },
    },
  };
}
