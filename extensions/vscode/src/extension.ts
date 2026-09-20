import * as path from 'path';
import { existsSync } from 'fs';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import * as vscode from 'vscode';

let client: LanguageClient | undefined;

function resolveServerPath(configured: string): string {
  if (configured.trim() !== '') {
    return configured.trim();
  }

  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    const localBin = path.join(
      folders[0]!.uri.fsPath,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'cclint-lsp.cmd' : 'cclint-lsp'
    );
    if (existsSync(localBin)) {
      return localBin;
    }
  }

  // Fall back to PATH
  return 'cclint-lsp';
}

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('cclint');
  const serverPath = resolveServerPath(config.get<string>('serverPath') ?? '');

  const serverOptions: ServerOptions = {
    run: { command: serverPath, args: ['--stdio'], transport: TransportKind.stdio },
    debug: {
      command: serverPath,
      args: ['--stdio'],
      transport: TransportKind.stdio,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'markdown' },
      { scheme: 'file', pattern: '**/CLAUDE.md' },
      { scheme: 'file', pattern: '**/AGENTS.md' },
      { scheme: 'file', pattern: '**/.claude/**/*.md' },
      { scheme: 'file', pattern: '**/.claude/settings*.json' },
      { scheme: 'file', pattern: '**/.mcp.json' },
    ],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher(
        '**/{CLAUDE.md,AGENTS.md,.claude/**,.mcp.json}'
      ),
    },
  };

  client = new LanguageClient(
    'cclint',
    'cclint Language Server',
    serverOptions,
    clientOptions
  );

  context.subscriptions.push(client);
  void client.start();
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
