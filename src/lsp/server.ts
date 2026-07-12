import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  CodeActionKind,
  type Connection,
  type InitializeResult,
  type CodeAction,
  type Diagnostic,
  type Range,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ContextFile } from '../domain/ContextFile.js';
import { RulesEngine } from '../domain/RulesEngine.js';
import { createRules } from '../rules/registry/createRules.js';
import { ConfigLoader } from '../infrastructure/ConfigLoader.js';
import {
  violationsToDiagnostics,
  violationToCodeAction,
} from './diagnostics.js';

/**
 * Resolve a text-document URI to a filesystem path.
 *
 * @remarks
 * `file://` URIs are decoded to real paths so file-kind gating (a rule's
 * {@link ContextFile}-based `appliesTo`) sees, e.g., `.claude/skills/…` and
 * `settings.json`. Non-`file:` URIs (such as `untitled:`) are passed through
 * unchanged — they never resolve to a real config file, so config lookup simply
 * falls back to defaults and structure rules are gated off by extension.
 */
export function uriToFsPath(uri: string): string {
  if (uri.startsWith('file://')) {
    return fileURLToPath(uri);
  }
  return uri;
}

/**
 * Build a {@link RulesEngine} configured for the workspace that owns a given
 * document path, honouring `.cclintrc.json` / presets discovered upward from
 * the document's directory.
 *
 * @remarks
 * Deliberately constructed *without* per-rule severity overrides — matching the
 * MCP, watch, and Action adapters. `RulesEngine` applies an override by
 * reconstructing each violation, which discards its structured `fix`; skipping
 * overrides keeps fixes intact so `textDocument/codeAction` can offer quick
 * fixes. Diagnostics therefore reflect each rule's intrinsic severity. (The CLI
 * `lint` command, which does not need fixes at report time, is the only entry
 * point that opts into overrides.)
 */
function engineForPath(fsPath: string): RulesEngine {
  const config = ConfigLoader.load(dirname(fsPath));
  return new RulesEngine(createRules(config));
}

/**
 * Construct a {@link ContextFile} from a document's path and in-memory text, or
 * `undefined` when the text violates the domain content limits.
 *
 * @remarks
 * The editor holds the authoritative buffer, so we lint the live text directly
 * rather than reading from disk. The content-limit guard in {@link ContextFile}
 * can throw on pathological input (e.g. a multi-megabyte single line); we treat
 * that as "nothing to report" so a keystroke never crashes the server.
 */
function toContextFile(fsPath: string, text: string): ContextFile | undefined {
  try {
    return new ContextFile(fsPath, text);
  } catch {
    return undefined;
  }
}

/**
 * Lint an open document's live text and return LSP diagnostics.
 *
 * Pure with respect to the LSP connection: it can be exercised in unit tests by
 * passing a {@link TextDocument} built with `TextDocument.create`.
 */
export function lintTextDocument(document: TextDocument): Diagnostic[] {
  const fsPath = uriToFsPath(document.uri);
  const file = toContextFile(fsPath, document.getText());
  if (!file) {
    return [];
  }
  const result = engineForPath(fsPath).lint(file);
  return violationsToDiagnostics(result);
}

/** Whether two line spans (inclusive) overlap. */
function linesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Compute quick-fix code actions for the violations that fall within the
 * requested range and carry a structured fix.
 *
 * Pure with respect to the LSP connection, so it is unit-testable directly.
 */
export function computeCodeActions(
  document: TextDocument,
  range: Range
): CodeAction[] {
  const fsPath = uriToFsPath(document.uri);
  const file = toContextFile(fsPath, document.getText());
  if (!file) {
    return [];
  }
  const result = engineForPath(fsPath).lint(file);
  const actions: CodeAction[] = [];
  for (const violation of result.violations) {
    if (!violation.fix) {
      continue;
    }
    // The fix's own span is 1-based; compare on 0-based lines against the
    // requested range so we only surface fixes relevant to the user's cursor.
    const fixStartLine = violation.fix.range.start.line - 1;
    const fixEndLine = violation.fix.range.end.line - 1;
    if (
      !linesOverlap(fixStartLine, fixEndLine, range.start.line, range.end.line)
    ) {
      continue;
    }
    const action = violationToCodeAction(violation, document.uri);
    if (action) {
      actions.push(action);
    }
  }
  return actions;
}

/**
 * The server's advertised capabilities.
 *
 * @remarks
 * Incremental text sync keeps large documents cheap to update, and a quick-fix
 * code action provider exposes the fixes rules attach to their violations.
 */
export function buildInitializeResult(): InitializeResult {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      codeActionProvider: {
        codeActionKinds: [CodeActionKind.QuickFix],
      },
    },
  };
}

/**
 * Wire cclint's linting pipeline onto an LSP {@link Connection}: publish
 * diagnostics on open/change/save, clear them on close, and serve quick-fix
 * code actions.
 *
 * @remarks
 * Split out from {@link startServer} so a test can drive it with a fake
 * connection if desired. `documents.onDidChangeContent` fires on both open and
 * change, so it covers `textDocument/didOpen` and `textDocument/didChange`;
 * `onDidSave` re-lints on `textDocument/didSave`.
 */
export function registerHandlers(connection: Connection): void {
  const documents = new TextDocuments(TextDocument);

  connection.onInitialize(() => buildInitializeResult());

  const publish = (document: TextDocument): void => {
    const diagnostics = lintTextDocument(document);
    void connection.sendDiagnostics({ uri: document.uri, diagnostics });
  };

  documents.onDidChangeContent(event => publish(event.document));
  documents.onDidSave(event => publish(event.document));
  documents.onDidClose(event => {
    void connection.sendDiagnostics({
      uri: event.document.uri,
      diagnostics: [],
    });
  });

  connection.onCodeAction(params => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    return computeCodeActions(document, params.range);
  });

  documents.listen(connection);
}

/**
 * Start the cclint language server over stdio.
 *
 * @remarks
 * Called by the `cclint-lsp` bin. Creates the connection, registers handlers,
 * and begins listening. No work happens at module import time, so importing
 * this module in tests is side-effect free.
 */
export function startServer(): void {
  const connection = createConnection(ProposedFeatures.all);
  registerHandlers(connection);
  connection.listen();
}
