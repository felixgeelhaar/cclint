#!/usr/bin/env node
/**
 * cclint LSP server entry point.
 *
 * Run as a stdio language server so any LSP-compatible editor (VS Code, Neovim,
 * Emacs, Sublime, …) can surface real-time cclint diagnostics while editing
 * CLAUDE.md, skills, subagents, and Claude Code config files.
 *
 * Editors typically launch it as:
 *
 *   cclint-lsp --stdio
 *
 * The `--stdio` flag is the conventional signal from LSP clients; the server
 * communicates over stdio regardless, so no argument parsing is required here.
 */
import { startServer } from './server.js';

startServer();
