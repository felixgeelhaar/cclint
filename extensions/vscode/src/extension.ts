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

function resolveCliInvocation(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    const localBin = path.join(
      folders[0]!.uri.fsPath,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'cclint.cmd' : 'cclint'
    );
    if (existsSync(localBin)) {
      return quoteShell(localBin);
    }
  }
  return 'npx --yes @felixgeelhaar/cclint';
}

function quoteShell(value: string): string {
  if (/[\s"']/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

function activeFsPath(): string | undefined {
  return vscode.window.activeTextEditor?.document.uri.fsPath;
}

function runInTerminal(title: string, args: string[]): void {
  const cli = resolveCliInvocation();
  const command = `${cli} ${args.map(quoteShell).join(' ')}`;
  const terminal = vscode.window.createTerminal({ name: title });
  terminal.show();
  terminal.sendText(command);
}

function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('cclint.lint', () => {
      const file = activeFsPath();
      if (!file) {
        void vscode.window.showWarningMessage(
          'cclint: open a file to lint, or run lint on the workspace folder.'
        );
        const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (folder) runInTerminal('cclint lint', ['lint', folder]);
        return;
      }
      runInTerminal('cclint lint', ['lint', file]);
    }),
    vscode.commands.registerCommand('cclint.fix', () => {
      const file = activeFsPath();
      if (!file) {
        void vscode.window.showWarningMessage(
          'cclint: open a file before running Fix.'
        );
        return;
      }
      runInTerminal('cclint fix', ['lint', file, '--fix']);
    }),
    vscode.commands.registerCommand('cclint.init', () => {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) {
        void vscode.window.showWarningMessage(
          'cclint: open a workspace folder before running Init.'
        );
        return;
      }
      runInTerminal('cclint init', ['init', '--detect', '--yes']);
    }),
    vscode.commands.registerCommand('cclint.explain', () => {
      const file = activeFsPath();
      if (!file) {
        void vscode.window.showWarningMessage(
          'cclint: open a file before running Explain.'
        );
        return;
      }
      const line =
        (vscode.window.activeTextEditor?.selection.active.line ?? 0) + 1;
      runInTerminal('cclint why', [
        'why',
        file,
        '--line',
        String(line),
      ]);
    })
  );
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
  registerCommands(context);
  void client.start();
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
