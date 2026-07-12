import { describe, it, expect } from 'vitest';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { Violation } from '../../../src/domain/Violation.js';
import { Location } from '../../../src/domain/Location.js';
import { Severity } from '../../../src/domain/Severity.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { LintingResult } from '../../../src/domain/LintingResult.js';
import type { Fix } from '../../../src/domain/AutoFix.js';
import {
  CCLINT_SOURCE,
  severityToDiagnosticSeverity,
  locationToPosition,
  fixRangeToRange,
  violationToDiagnostic,
  violationsToDiagnostics,
  violationToCodeAction,
} from '../../../src/lsp/diagnostics.js';

const anyFile = new ContextFile('/repo/CLAUDE.md', '# Title\n');

describe('severityToDiagnosticSeverity', () => {
  it('maps cclint ERROR to LSP Error', () => {
    expect(severityToDiagnosticSeverity(Severity.ERROR)).toBe(
      DiagnosticSeverity.Error
    );
  });

  it('maps cclint WARNING to LSP Warning', () => {
    expect(severityToDiagnosticSeverity(Severity.WARNING)).toBe(
      DiagnosticSeverity.Warning
    );
  });

  it('maps cclint INFO to LSP Information', () => {
    expect(severityToDiagnosticSeverity(Severity.INFO)).toBe(
      DiagnosticSeverity.Information
    );
  });
});

describe('locationToPosition', () => {
  it('converts 1-based cclint line/column to 0-based LSP position', () => {
    expect(locationToPosition(new Location(1, 1))).toEqual({
      line: 0,
      character: 0,
    });
    expect(locationToPosition(new Location(10, 5))).toEqual({
      line: 9,
      character: 4,
    });
  });

  it('clamps a zero column to character 0 (never negative)', () => {
    // Location permits column 0; 0 - 1 must not become a negative character.
    expect(locationToPosition(new Location(3, 0))).toEqual({
      line: 2,
      character: 0,
    });
  });
});

describe('fixRangeToRange', () => {
  it('converts a fix range (1-based) to a 0-based LSP range', () => {
    const fix: Fix = {
      range: {
        start: new Location(4, 2),
        end: new Location(4, 7),
      },
      text: 'text',
      description: 'Replace unknown language with "text"',
    };
    expect(fixRangeToRange(fix.range)).toEqual({
      start: { line: 3, character: 1 },
      end: { line: 3, character: 6 },
    });
  });
});

describe('violationToDiagnostic', () => {
  it('produces a diagnostic with mapped severity, position, code and source', () => {
    const v = new Violation(
      'format',
      'Line has trailing whitespace',
      Severity.WARNING,
      new Location(7, 12)
    );
    const d = violationToDiagnostic(v);
    expect(d.severity).toBe(DiagnosticSeverity.Warning);
    expect(d.code).toBe('format');
    expect(d.source).toBe(CCLINT_SOURCE);
    expect(d.message).toBe('Line has trailing whitespace');
    expect(d.range.start).toEqual({ line: 6, character: 11 });
  });

  it('marks non-fixable violations in data.fixable=false', () => {
    const v = new Violation(
      'file-size',
      'File too large',
      Severity.ERROR,
      new Location(1, 1)
    );
    const d = violationToDiagnostic(v);
    expect(d.data).toEqual({ ruleId: 'file-size', fixable: false });
  });

  it('uses the carried fix range as the diagnostic range and marks fixable', () => {
    const fix: Fix = {
      range: { start: new Location(2, 1), end: new Location(2, 4) },
      text: '',
      description: 'Remove trailing whitespace',
    };
    const v = new Violation(
      'format',
      'Line has trailing whitespace',
      Severity.WARNING,
      new Location(2, 1),
      fix
    );
    const d = violationToDiagnostic(v);
    expect(d.range).toEqual({
      start: { line: 1, character: 0 },
      end: { line: 1, character: 3 },
    });
    expect(d.data).toEqual({ ruleId: 'format', fixable: true });
  });
});

describe('violationsToDiagnostics', () => {
  it('returns an empty array for a result with no violations', () => {
    const result = new LintingResult(anyFile);
    expect(violationsToDiagnostics(result)).toEqual([]);
  });

  it('maps multiple violations preserving order', () => {
    const result = new LintingResult(anyFile);
    result.addViolation(
      new Violation('a', 'first', Severity.ERROR, new Location(1, 1))
    );
    result.addViolation(
      new Violation('b', 'second', Severity.INFO, new Location(3, 2))
    );
    const diags = violationsToDiagnostics(result);
    expect(diags).toHaveLength(2);
    expect(diags[0]?.code).toBe('a');
    expect(diags[0]?.severity).toBe(DiagnosticSeverity.Error);
    expect(diags[1]?.code).toBe('b');
    expect(diags[1]?.severity).toBe(DiagnosticSeverity.Information);
    expect(diags[1]?.range.start).toEqual({ line: 2, character: 1 });
  });
});

describe('violationToCodeAction', () => {
  it('returns undefined for a violation without a fix', () => {
    const v = new Violation(
      'file-size',
      'File too large',
      Severity.ERROR,
      new Location(1, 1)
    );
    expect(violationToCodeAction(v, 'file:///repo/CLAUDE.md')).toBeUndefined();
  });

  it('builds a quick-fix WorkspaceEdit from a carried fix', () => {
    const fix: Fix = {
      range: { start: new Location(2, 1), end: new Location(2, 4) },
      text: '',
      description: 'Remove trailing whitespace',
    };
    const v = new Violation(
      'format',
      'Line has trailing whitespace',
      Severity.WARNING,
      new Location(2, 1),
      fix
    );
    const uri = 'file:///repo/CLAUDE.md';
    const action = violationToCodeAction(v, uri);
    expect(action).toBeDefined();
    if (!action) return;
    expect(action.title).toContain('Remove trailing whitespace');
    expect(action.kind).toBe('quickfix');
    const edits = action.edit?.changes?.[uri];
    expect(edits).toHaveLength(1);
    expect(edits?.[0]).toEqual({
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 3 },
      },
      newText: '',
    });
    // The originating diagnostic is attached so the editor can associate the
    // fix with the squiggle it resolves.
    expect(action.diagnostics).toHaveLength(1);
    expect(action.diagnostics?.[0]?.code).toBe('format');
  });
});
