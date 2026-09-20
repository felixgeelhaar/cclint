# Backlog

Working list of features considered for cclint. Shipped items are kept here for
a short while as a record, then pruned; see [CHANGELOG.md](../CHANGELOG.md) for
the authoritative release history.

## Open

_Nothing queued right now._ New ideas and their rationale live in
[ROADMAP.md](./ROADMAP.md); the largest remaining item is a first-party VS Code
extension client (a generic LSP client already works via `cclint-lsp --stdio`).

## Shipped

- ✅ **Parity + product rules** (v0.18.0) — Action/CLI discovery+ignore parity,
  hooks/diff cover AGENTS.md/rules, `import-context-cost` + `enforcement-hint`,
  docs hygiene (Action pin, ADR index, TDD).
- ✅ **Anthropic / AGENTS.md catch-up** (v0.17.0) — discover `AGENTS.md` /
  `.claude/rules/` / `CLAUDE.local.md`; `agents-md` + `claude-rules` rules;
  ~200-line `file-size` budget; undo CLAUDE.local.md deprecation.
- ✅ **Project-wide lint** (v0.16.0) — `cclint lint .` discovers and lints a whole
  config tree (`CLAUDE.md`, `.claude/skills|agents|output-styles/**`,
  `settings*.json`, `.mcp.json`, plugin/marketplace manifests).
- ✅ **LSP server** (v0.16.0) — `cclint-lsp` provides real-time diagnostics and
  quick-fix code actions in any LSP editor (ADR 008).
- ✅ **Config presets** (v0.16.0) — `extends: "@cclint/recommended" | "@cclint/strict"`.
- ✅ **New validators** (v0.16.0) — `secret-detection`, `plugin-manifest`,
  `mcp-config`, `output-style`.
- ✅ **SARIF output** (v0.16.0) — `--format sarif` for GitHub Code Scanning.
- ✅ **Claude Code Extended Features** (v0.11.0) — `skill-structure`,
  `subagent-structure`, and `hook-configuration` rules.
- ✅ **Watch mode** — `cclint watch` continuously lints on change (chokidar,
  debounced, recursive, auto-fix).
- ✅ **Init/scaffold** — `cclint init` generates starter CLAUDE.md files with
  template system and project-type detection.
- ✅ **Pre-commit hook installation** — `cclint install` / `cclint uninstall`.
- ✅ **Interactive fix mode** — `cclint lint --interactive` step-through review.
- ✅ **Explain command** — `cclint explain [rule]` with rule metadata.
- ✅ **Diff-aware linting** — `cclint lint --diff` (`--diff-ref <ref>`) reports
  only violations on changed lines.
