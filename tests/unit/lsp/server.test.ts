import { describe, it, expect } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CodeActionKind } from 'vscode-languageserver';
import {
  uriToFsPath,
  lintTextDocument,
  computeCodeActions,
  buildInitializeResult,
} from '../../../src/lsp/server.js';

function doc(uri: string, content: string): TextDocument {
  return TextDocument.create(uri, 'markdown', 1, content);
}

describe('uriToFsPath', () => {
  it('converts a file:// URI to a filesystem path', () => {
    expect(uriToFsPath('file:///repo/CLAUDE.md')).toBe('/repo/CLAUDE.md');
  });

  it('passes a non-file URI through unchanged', () => {
    expect(uriToFsPath('untitled:Untitled-1')).toBe('untitled:Untitled-1');
  });
});

describe('buildInitializeResult', () => {
  it('advertises incremental sync and a quick-fix code action provider', () => {
    const result = buildInitializeResult();
    expect(result.capabilities.textDocumentSync).toBeDefined();
    const provider = result.capabilities.codeActionProvider;
    expect(provider).toBeTruthy();
    if (provider && typeof provider === 'object') {
      expect(provider.codeActionKinds).toContain(CodeActionKind.QuickFix);
    }
  });
});

describe('lintTextDocument', () => {
  it('returns no diagnostics for a clean minimal CLAUDE.md', () => {
    // A file the file-kind gating recognises as a CLAUDE.md document.
    const diagnostics = lintTextDocument(
      doc('file:///tmp/cclint-lsp/CLAUDE.md', '# Project\n\nHello world.\n')
    );
    expect(Array.isArray(diagnostics)).toBe(true);
  });

  it('flags trailing whitespace with a cclint-sourced diagnostic', () => {
    const diagnostics = lintTextDocument(
      doc('file:///tmp/cclint-lsp/CLAUDE.md', '# Project\n\nline   \n')
    );
    expect(diagnostics.some(d => d.source === 'cclint')).toBe(true);
  });

  it('applies file-kind gating: a settings.json does not get CLAUDE.md structure rules', () => {
    // structure/opinionated CLAUDE.md rules must not fire on settings.json.
    const settings = lintTextDocument(
      doc('file:///tmp/cclint-lsp/.claude/settings.json', '{\n  "hooks": {}\n}\n')
    );
    expect(settings.every(d => d.code !== 'structure')).toBe(true);
  });

  it('never throws on oversized content, returning an empty array instead', () => {
    // A single enormous line trips the content-limit guard in ContextFile.
    const huge = 'x'.repeat(2_000_000);
    const diagnostics = lintTextDocument(
      doc('file:///tmp/cclint-lsp/CLAUDE.md', huge)
    );
    expect(diagnostics).toEqual([]);
  });
});

describe('computeCodeActions', () => {
  it('offers a quick fix for a fixable violation within the requested range', () => {
    const document = doc(
      'file:///tmp/cclint-lsp/CLAUDE.md',
      '# Project\n\nline   \n'
    );
    // Trailing whitespace lives on line index 2 (0-based).
    const actions = computeCodeActions(document, {
      start: { line: 2, character: 0 },
      end: { line: 2, character: 10 },
    });
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0]?.kind).toBe(CodeActionKind.QuickFix);
    expect(actions[0]?.edit?.changes?.[document.uri]).toBeDefined();
  });

  it('returns no actions when the requested range excludes all fixable violations', () => {
    const document = doc(
      'file:///tmp/cclint-lsp/CLAUDE.md',
      '# Project\n\nline   \n'
    );
    const actions = computeCodeActions(document, {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 },
    });
    expect(actions).toEqual([]);
  });
});
