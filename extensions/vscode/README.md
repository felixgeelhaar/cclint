# cclint VS Code extension

First-party client for [`cclint-lsp`](../../README.md). Surfaces diagnostics and
quick-fix code actions while you edit `CLAUDE.md`, `AGENTS.md`, and `.claude/**`
config.

## Requirements

- `cclint-lsp` on your `PATH`, **or** this workspace's `node_modules/.bin/cclint-lsp`
  after `npm install` / `npm link` of `@felixgeelhaar/cclint`
- Optional: set `cclint.serverPath` if the binary lives elsewhere

## Develop / install locally

```bash
cd extensions/vscode
npm install
npm run compile
# Install from this folder in VS Code: "Extensions: Install from Location…"
# Or package a VSIX:
npm run package
code --install-extension cclint-*.vsix
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `cclint.serverPath` | `""` | Absolute path to `cclint-lsp`; empty uses PATH / local `node_modules/.bin` |
| `cclint.trace.server` | `off` | LSP trace level |

This extension is a thin Language Client — all linting logic lives in `cclint-lsp`.
