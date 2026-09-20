# cclint VS Code extension

First-party client for [`cclint-lsp`](../../README.md). Surfaces diagnostics and
quick-fix code actions while you edit `CLAUDE.md`, `AGENTS.md`, and `.claude/**`
config.

## Requirements

- `cclint-lsp` on your `PATH`, **or** this workspace's `node_modules/.bin/cclint-lsp`
  after `npm install` / `npm link` of `@felixgeelhaar/cclint`
- Optional: set `cclint.serverPath` if the binary lives elsewhere

## Install

- **From VSIX** (CI artifact or local package): `code --install-extension cclint-*.vsix`
- **From location**: open this folder via “Extensions: Install from Location…”
- **Marketplace / Open VSX**: see [PUBLISHING.md](./PUBLISHING.md) (maintainer publish)

## Develop / package locally

```bash
cd extensions/vscode
npm install
npm run compile
npm run package   # → cclint-<version>.vsix
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `cclint.serverPath` | `""` | Absolute path to `cclint-lsp`; empty uses PATH / local `node_modules/.bin` |
| `cclint.trace.server` | `off` | LSP trace level |

## Commands

| Command | Action |
|---------|--------|
| `cclint: Lint File / Workspace` | Run `cclint lint` on the active file (or workspace root) |
| `cclint: Fix Current File` | Run `cclint lint --fix` on the active file |
| `cclint: Init CLAUDE.md` | Run `cclint init --detect --yes` in the workspace |
| `cclint: Explain Violation at Cursor` | Run `cclint why --line <cursor>` on the active file |

This extension is a thin Language Client — all linting logic lives in `cclint-lsp`.
