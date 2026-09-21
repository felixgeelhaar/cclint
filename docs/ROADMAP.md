# cclint Roadmap

This document outlines the planned features and improvements for cclint beyond v0.6.0.

## Vision

Transform cclint from a CLI linter into a **full-featured platform** for CLAUDE.md management, including:

- Real-time editor integration
- AI-powered content suggestions
- Quality metrics and dashboards
- Community-driven rule ecosystem

---

## Current status (as of v0.24.0)

The developer-experience (v0.7) and editor-integration (v0.8) themes have both
**shipped**, and Anthropic alignment caught up for Claude Code 2.1.277:

- ✅ **AGENTS.md fallback** — discovery + `agents-md` guidance for the
  CLAUDE.md-or-AGENTS.md Project instructions behaviour.
- ✅ **`.claude/rules/`** — discovery + `claude-rules` frontmatter validation.
- ✅ **Developer experience** — watch mode, `init`, hook installation,
  interactive fix, `explain`, and diff-aware linting all shipped.
- ✅ **LSP server** — `cclint-lsp --stdio` delivers real-time diagnostics and
  quick-fix code actions to any LSP editor (ADR 008). A first-party VS Code
  extension lives in `extensions/vscode/` (VSIX CI artifact + PUBLISHING.md +
  command palette wrappers; install from VSIX / location — Marketplace listing
  intentionally out of scope).
- ✅ **AI integration** — `cclint why --ai`, `lint --ai`, `lint --fix --ai`,
  `suggest` (`--generate-missing` / `--rewrite-generic`), `analyze [--ai]`,
  shared `ai` config, Anthropic + OpenAI + Ollama providers (`--provider`).
- ✅ **Codebase-aware drafts** — `cclint analyze --draft` (optional `--write`)
  uses ProjectDetector + Scaffolder to preview a tailored CLAUDE.md.
- ✅ **Project-wide lint** — `cclint lint .` walks a whole config tree and lints
  each file with the rules that apply to it.
- ✅ **Metrics + presets + CI snippets** — `cclint metrics`, language/project
  presets, GitLab/Bitbucket templates (v0.22).
- ✅ **Local rule packs** — `cclint pack create|install|list` and `extends`
  resolution for `.cclint/packs/` (v0.23; remote registry still deferred).
- ✅ **Web playground (local)** — Vite app under `playground/` with
  `lintMarkdown` browser entry (v0.24; production hosting / WASM still deferred).

Remaining v1.0 themes (hosted playground, community pack registry) are still
aspirational.

---

## Release Timeline

| Version | Theme                         | Target   | Status         |
| ------- | ----------------------------- | -------- | -------------- |
| v0.6.0  | 10/10 Anthropic Alignment     | Jan 2025 | ✅ Released    |
| v0.7.0  | Developer Experience          | 2026     | ✅ Released    |
| v0.8.0  | Editor Integration (LSP)      | 2026     | ✅ Released    |
| v0.9.0  | AI Integration                | Sep 2026 | ✅ Released    |
| v0.11.0 | Claude Code Extended Features | Mar 2026 | ✅ Released    |
| v0.16.0 | Project-wide lint, LSP, new rules, presets, security | Jul 2026 | ✅ Released    |
| v0.20.0 | Analyze drafts + VS Code marketplace prep | Sep 2026 | ✅ Released    |
| v0.21.0 | AI breadth (providers, lint --ai/--fix --ai, suggest flags) | Sep 2026 | ✅ Released    |
| v0.22.0 | Metrics, language presets, GitLab/Bitbucket snippets | Sep 2026 | ✅ Released    |
| v0.23.0 | Local community rule packs (`cclint pack`) | Sep 2026 | ✅ Released    |
| v0.24.0 | Web playground (local Vite + browser lint) | Sep 2026 | ✅ Released    |
| v1.0.0  | Full Platform                 | TBD      | 🟡 In progress |

---

## v0.7.0 - Developer Experience ✅ Shipped

**Theme**: Make cclint delightful to use in daily development workflows.

> **Status:** all six features below have shipped. Note the delivered CLI spells
> a couple of commands differently than the sketches here: hook management is
> `cclint install` / `cclint uninstall` (not `install-hook`), and diff-aware
> linting is `cclint lint --diff [--diff-ref <ref>]`.

### Features

#### 1. Watch Mode

Continuously lint CLAUDE.md files on changes.

```bash
# Watch single file
cclint watch CLAUDE.md

# Watch directory recursively
cclint watch . --recursive

# Watch with auto-fix
cclint watch CLAUDE.md --fix
```

**Implementation**:

- Use `chokidar` for cross-platform file watching
- Debounce rapid changes (300ms default)
- Clear terminal between runs (optional)
- Show diff of changes when auto-fixing

#### 2. Init/Scaffold Command

Generate starter CLAUDE.md files with best practices baked in.

```bash
# Interactive mode
cclint init

# Use template
cclint init --template typescript
cclint init --template python
cclint init --template go
cclint init --template monorepo

# Analyze existing project
cclint init --detect
```

**Templates**:

- `minimal` - Basic structure, 3 sections
- `typescript` - TypeScript/Node.js project
- `python` - Python project with pip/poetry
- `go` - Go project with modules
- `monorepo` - Multi-package repository
- `library` - npm/PyPI package
- `api` - REST/GraphQL API project

**Detection** (`--detect`):

- Scan `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`
- Detect CI/CD (GitHub Actions, GitLab CI)
- Find existing README sections to reference
- Suggest imports for existing documentation

#### 3. Pre-commit Hook Installation

One-command setup for Git hooks.

```bash
# Install hook
cclint install-hook

# Install with options
cclint install-hook --fix       # Auto-fix on commit
cclint install-hook --staged    # Only check staged files

# Uninstall
cclint uninstall-hook
```

**Supported Hook Managers**:

- Husky (auto-detect `.husky/`)
- Lefthook (auto-detect `lefthook.yml`)
- pre-commit (auto-detect `.pre-commit-config.yaml`)
- Raw Git hooks (`.git/hooks/pre-commit`)

#### 4. Interactive Fix Mode

Step through violations one-by-one with previews.

```bash
cclint lint CLAUDE.md --interactive
```

**Interface**:

```
[1/5] content-appropriateness (warning)
Line 45: Generic instruction detected

  Current:
  > Follow best practices for error handling.

  Suggested fix:
  > Use try-catch blocks for async operations. Log errors with stack traces to stderr.

  [a]pply  [s]kip  [A]pply all  [q]uit  [?]help
```

#### 5. Rule Explanation Command

Get detailed documentation for any rule.

```bash
cclint explain content-appropriateness
cclint explain --all              # List all rules
cclint explain --category safety  # List safety rules
```

**Output**:

- Rule description and purpose
- Configuration options with defaults
- Examples of violations
- Links to Anthropic documentation
- Related rules

#### 6. Diff-Aware Linting

Only lint changed sections for faster CI.

```bash
# Compare to previous commit
cclint lint --diff HEAD~1

# Compare to branch
cclint lint --diff main

# Compare to specific commit
cclint lint --diff abc123
```

**Benefits**:

- Faster CI for large CLAUDE.md files
- Focus attention on new issues
- Skip unchanged baseline violations

---

## v0.8.0 - Editor Integration (LSP) ✅ Shipped (v0.16.0)

**Theme**: Real-time linting in any editor via Language Server Protocol.

> **Status:** the LSP server shipped in v0.16.0 as the `cclint-lsp` bin (run
> `cclint-lsp --stdio`), providing live diagnostics on open/change/save and
> quick-fix code actions, config-aware via discovered `.cclintrc.json`/presets
> (ADR 008). A first-party VS Code extension and a dedicated Neovim plugin are
> **not yet published** — any editor with a generic LSP client works today.

### Features

#### 1. LSP Server

Full Language Server Protocol implementation for CLAUDE.md files.

```bash
# Start LSP server (for editor integration)
cclint lsp

# With debug logging
cclint lsp --debug
```

**Capabilities**:

- `textDocument/diagnostic` - Real-time error highlighting
- `textDocument/codeAction` - Quick fixes
- `textDocument/completion` - Section/keyword completion
- `textDocument/hover` - Rule documentation on hover
- `textDocument/formatting` - Format document

**Supported Editors** (via LSP):

- VS Code (with extension)
- Neovim (via nvim-lspconfig)
- Emacs (via lsp-mode/eglot)
- Sublime Text (via LSP package)
- Helix, Zed, etc.

#### 2. VS Code Extension

First-party VS Code extension with enhanced features.

**Features**:

- Syntax highlighting for CLAUDE.md
- Real-time diagnostics (errors, warnings, info)
- Quick Fix actions (CodeActions)
- Hover documentation
- Auto-completion for sections
- Format on save
- Status bar quality score
- Command palette integration

**Extension Commands**:

- `cclint.lint` - Lint current file
- `cclint.fix` - Fix all auto-fixable issues
- `cclint.init` - Create CLAUDE.md in workspace
- `cclint.explain` - Explain rule at cursor

#### 3. Neovim Plugin

Native Neovim integration.

```lua
-- lazy.nvim
{
  'felixgeelhaar/cclint.nvim',
  dependencies = { 'nvim-lua/plenary.nvim' },
  config = function()
    require('cclint').setup({
      auto_lint = true,
      virtual_text = true,
    })
  end
}
```

---

## v0.9.0 - AI Integration ✅ Shipped

**Theme**: Leverage Claude (and other providers) for intelligent suggestions.

> **Status:** shipped through v0.19–v0.21 (Anthropic, OpenAI, Ollama; lint --ai /
> --fix --ai; suggest flags; config `ai`). Optional follow-ups: cost tracking.

### Features

#### 1. AI-Powered Suggestions

Use Claude API to suggest content improvements.

```bash
# Analyze and suggest improvements
cclint suggest CLAUDE.md

# Generate missing sections
cclint suggest --generate-missing

# Interactive mode with AI explanations
cclint lint --ai-explain
```

**Capabilities**:

- Suggest more specific instructions
- Identify missing documentation based on codebase
- Rewrite vague content to be actionable
- Generate section content from README/package.json

**Privacy**:

- Opt-in only (requires `--ai` flag or config)
- Local mode available (Ollama/LM Studio support)
- No data retention by default
- Content is sent to Claude API only when explicitly requested

#### 2. Codebase-Aware Analysis

Scan codebase to suggest CLAUDE.md content.

```bash
cclint analyze .
```

**Detection**:

- Identify main technologies (TypeScript, Python, Go)
- Find build commands from scripts
- Detect testing framework
- Map project structure
- Suggest architecture documentation

#### 3. Smart Fix Generation

AI-generated fixes for complex violations.

```bash
cclint lint --fix --ai
```

**Scenarios**:

- Rewrite generic instructions to be specific
- Generate code examples for documentation
- Create proper heading hierarchy
- Suggest command safety improvements

---

## v1.0.0 - Full Platform

**Theme**: Complete ecosystem for CLAUDE.md management.

### Features

#### 1. Web Playground 🟡 Partially shipped

Try cclint in the browser without installation.

> **Status (v0.24.0):** local Vite playground under `playground/` with
> `src/browser/lintMarkdown` (JS bundle of browser-safe rules — not WASM).
> Run `npm run playground`. Production hosting (`cclint.dev`), Monaco, and WASM
> remain deferred.

**URL** (future): `https://cclint.dev/playground`

**Shipped locally**:

- Paste or type CLAUDE.md content
- Live linting (debounced)
- Share results via compressed URL hash

**Still planned**:

- Export fixed content
- Monaco Editor
- Static hosting (Vercel/Cloudflare Pages)
- WASM compilation of core (optional; JS bundle is enough for now)

#### 2. Metrics Dashboard

Track CLAUDE.md quality over time.

```bash
# Record metrics
cclint metrics record

# View local dashboard
cclint metrics serve

# Export for CI
cclint metrics export --format json
```

**Metrics Tracked**:

- Quality score (0-100)
- Violation count by severity
- Rule compliance rates
- File size trends
- Fix rate over time

**CI Integration**:

- GitHub Action annotation with trends
- PR comment with quality diff
- Badge generation for README

#### 3. Community Rule Packs 🟡 Partially shipped

Share and discover rule configurations.

> **Status (v0.23.0):** local packs ship via `cclint pack create|install|list`.
> Installed packs live under `.cclint/packs/` and resolve through `extends` the
> same way built-in presets do. Remote registry / `pack publish` remain deferred.

```bash
# Scaffold + install a local pack
cclint pack create my-rules
cclint pack install ./my-rules

# Built-in presets need no install
cclint pack list
```

```bash
# Install rule pack (future registry)
cclint pack install @anthropic/strict
cclint pack install @company/internal

# Create rule pack
cclint pack create my-rules

# Publish to registry
cclint pack publish
```

**Built-in Packs** (aliases of presets today):

- `@cclint/strict` - All rules, strict settings
- `@cclint/minimal` - Core rules only
- `@cclint/monorepo` - Optimized for monorepos
- `@cclint/library` - For published packages

#### 4. Configuration Presets ✅ Shipped

One-line setup for common scenarios.

> **Status:** the `extends` mechanism shipped in v0.16.0 with `@cclint/recommended`
> and `@cclint/strict`; v0.22.0 added language/project-type presets (`minimal`,
> `typescript`, `python`, `go`, `monorepo`, `library`, `api`, `cli`). See the
> [Configuration Guide](./configuration.md#presets-extends).

```json
{
  "extends": "@cclint/typescript"
}
```

**Presets**:

- Language-specific (typescript, python, go)
- Project type (api, library, monorepo, cli)
- Strictness (minimal, recommended, strict)

#### 5. GitLab/Bitbucket CI Templates ✅ Shipped

Ready-to-use pipeline configurations in `docs/ci/`.

**GitLab CI** (`.gitlab-ci.yml`):

```yaml
include:
  - local: 'docs/ci/gitlab-ci.yml'

cclint:
  extends: .cclint
```

**Bitbucket Pipelines** (`bitbucket-pipelines.yml`): see `docs/ci/bitbucket-pipelines.yml`.

---

## Future Considerations (Post v1.0)

### Multi-Language Support

- Localized rule messages (i18n)
- Non-English CLAUDE.md validation

### Organization Features

- Team-wide rule enforcement
- Centralized configuration management
- Compliance reporting

### IDE Marketplace

- JetBrains plugin (IntelliJ, WebStorm, PyCharm)
- Eclipse plugin
- Cursor/Windsurf integration

### Security Enhancements

- SBOM validation for imports
- ✅ Secret detection in code blocks — shipped in v0.16.0 (`secret-detection` rule)
- Dependency vulnerability checking

---

## Contributing

We welcome contributions to any roadmap item! See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Priority Labels

- `roadmap:v0.7` - Developer Experience features
- `roadmap:v0.8` - LSP/Editor features
- `roadmap:v0.9` - AI Integration features
- `roadmap:v1.0` - Platform features

### Getting Started

1. Pick an issue with a roadmap label
2. Comment to claim it
3. Follow the contribution guidelines
4. Submit a PR with tests

---

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for release history.
