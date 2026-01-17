# cclint Roadmap

This document outlines the planned features and improvements for cclint beyond v0.6.0.

## Vision

Transform cclint from a CLI linter into a **full-featured platform** for CLAUDE.md management, including:

- Real-time editor integration
- AI-powered content suggestions
- Quality metrics and dashboards
- Community-driven rule ecosystem

---

## Release Timeline

| Version | Theme                     | Target   | Status      |
| ------- | ------------------------- | -------- | ----------- |
| v0.6.0  | 10/10 Anthropic Alignment | Jan 2025 | ✅ Released |
| v0.7.0  | Developer Experience      | Q1 2025  | 🚧 Planning |
| v0.8.0  | Editor Integration (LSP)  | Q1 2025  | 📋 Planned  |
| v0.9.0  | AI Integration            | Q2 2025  | 📋 Planned  |
| v1.0.0  | Full Platform             | Q2 2025  | 📋 Planned  |

---

## v0.7.0 - Developer Experience

**Theme**: Make cclint delightful to use in daily development workflows.

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

## v0.8.0 - Editor Integration (LSP)

**Theme**: Real-time linting in any editor via Language Server Protocol.

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

## v0.9.0 - AI Integration

**Theme**: Leverage Claude to provide intelligent suggestions and automation.

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

#### 1. Web Playground

Try cclint in the browser without installation.

**URL**: `https://cclint.dev/playground`

**Features**:

- Paste or type CLAUDE.md content
- Real-time linting
- Share results via URL
- Export fixed content
- Compare before/after

**Technology**:

- WebAssembly compilation of core
- Monaco Editor for editing
- Static hosting (Vercel/Cloudflare Pages)

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

#### 3. Community Rule Packs

Share and discover rule configurations.

```bash
# Install rule pack
cclint pack install @anthropic/strict
cclint pack install @company/internal

# Create rule pack
cclint pack create my-rules

# Publish to registry
cclint pack publish
```

**Built-in Packs**:

- `@cclint/strict` - All rules, strict settings
- `@cclint/minimal` - Core rules only
- `@cclint/monorepo` - Optimized for monorepos
- `@cclint/library` - For published packages

#### 4. Configuration Presets

One-line setup for common scenarios.

```json
{
  "extends": "@cclint/typescript-strict"
}
```

**Presets**:

- Language-specific (typescript, python, go, rust)
- Project type (api, library, monorepo, cli)
- Strictness (minimal, recommended, strict)

#### 5. GitLab/Bitbucket CI Templates

Ready-to-use pipeline configurations.

**GitLab CI** (`.gitlab-ci.yml`):

```yaml
include:
  - remote: 'https://cclint.dev/ci/gitlab.yml'

cclint:
  extends: .cclint
```

**Bitbucket Pipelines** (`bitbucket-pipelines.yml`):

```yaml
definitions:
  caches:
    cclint: ~/.cclint
pipelines:
  default:
    - step:
        name: Lint CLAUDE.md
        script:
          - npx @felixgeelhaar/cclint lint CLAUDE.md
```

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
- Secret detection in code blocks
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
