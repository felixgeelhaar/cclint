# CC Linter 🔍

[![CI](https://github.com/felixgeelhaar/cclint/workflows/CI/badge.svg)](https://github.com/felixgeelhaar/cclint/actions)
[![npm version](https://badge.fury.io/js/@felixgeelhaar%2Fcclint.svg)](https://badge.fury.io/js/@felixgeelhaar%2Fcclint)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Catch CLAUDE.md drift before Claude misbehaves.** A fast linter for the configuration files Claude Code actually reads — `CLAUDE.md`, skills, subagents, and hooks — so silent context bugs stop costing you sessions.

## What it catches

- **Stale or invalid model IDs** in subagents (e.g. `claude-3-5-sonnet` flagged as deprecated; `claude-opus-4-7` recognized)
- **Unresolved `@path` imports** and circular import chains
- **Dangerous bash** in code blocks (`rm -rf /`, `curl | bash`, fork bombs)
- **Duplicate content** across parent / sibling CLAUDE.md files in monorepos
- **Skill / subagent / hook** structural errors before Claude Code loads them
- **Vague instructions** ("follow best practices") that degrade model adherence

## Why use it

- **Built for Claude Code** — knows the spec, not just markdown syntax
- **Fast** — TypeScript + Vitest, lints in milliseconds
- **Extensible** — plugin API for custom rules
- **CI-ready** — GitHub Action, JSON output, exit codes
- **Auto-fix** — `--fix` and interactive `-i` modes for common issues

## 📦 Installation

### Global Installation

```bash
npm install -g @felixgeelhaar/cclint
```

### Local Installation

```bash
npm install --save-dev @felixgeelhaar/cclint
```

### Using npx (No Installation Required)

```bash
npx @felixgeelhaar/cclint lint your-claude.md
```

## 🚀 Quick Start

### Basic Usage

```bash
# Lint a CLAUDE.md file
cclint lint CLAUDE.md

# Lint with JSON output
cclint lint CLAUDE.md --format json

# Lint with SARIF output (for GitHub Code Scanning)
cclint lint CLAUDE.md --format sarif > cclint.sarif

# Set custom file size limit
cclint lint CLAUDE.md --max-size 5000
```

### Project-wide Linting

Point `cclint lint` at a directory (`.` for the whole project) and it discovers
and lints every Claude Code config file under that tree, routing each file to
the rules that apply to it:

```bash
# Lint the whole project
cclint lint .

# Lint a specific directory
cclint lint packages/api

# Aggregate results as JSON or SARIF
cclint lint . --format json
cclint lint . --format sarif > cclint.sarif
```

Discovery walks the directory (skipping `node_modules`, `.git`, `dist`,
`coverage`, `.stryker-tmp`) and picks up:

- `CLAUDE.md` files (including nested ones)
- `.claude/skills/**/*.md`, `.claude/agents/**/*.md`, `.claude/output-styles/**/*.md`
- `.claude/settings.json` and `.claude/settings.local.json`
- `.mcp.json` (including nested)
- `.claude-plugin/plugin.json` and `marketplace.json`

Each file is linted with only the rules that apply to its kind (structure rules
for `CLAUDE.md`, hook rules for `settings.json`, `mcp-config` for `.mcp.json`,
and so on). Results are aggregated across all files and the run exits non-zero if
any file has an error-severity violation.

### Example Output

```
📝 Linting results for CLAUDE.md:

❌ error: Missing required section: "Development Commands" at 1:1 [structure]
⚠️ warning: File size (12,543 characters) exceeds maximum allowed size (10,000 characters) at 1:1 [file-size]
⚠️ warning: Missing required content: TypeScript usage (expected: "TypeScript") at 1:1 [content]

Summary: 1 errors, 2 warnings
```

## 📏 Built-in Rules

### Import Syntax Rule (`import-syntax`) 🆕

Validates Anthropic's `@path/to/file` import syntax for CLAUDE.md files.

- **Checks**:
  - Import syntax outside code blocks/spans
  - Path format validation (relative, absolute, `~/`)
  - Duplicate import detection
  - Max depth violations (5 hops)
- **Severity**: Mixed (errors for syntax, warnings for patterns)
- **Enabled**: By default

### Content Organization Rule (`content-organization`) 🆕

Validates content quality and structure following Anthropic best practices.

- **Checks**:
  - Heading hierarchy (h1 → h2 → h3, no skipping)
  - Bullet point usage for organization
  - Vague language detection ("properly" → specific instructions)
  - Emphasis markers (IMPORTANT, YOU MUST)
  - Specificity (measurements, tool names)
- **Severity**: Info (suggestions for improvement)
- **Purpose**: Ensures clear, actionable instructions

### File Location Rule (`file-location`) 🆕

Validates file placement and naming conventions.

- **Checks**:
  - CLAUDE.local.md deprecation warnings
  - File naming (CLAUDE.md required)
  - Location recommendations (user vs project)
  - Git awareness (.gitignore suggestions)
- **Severity**: Mixed (errors for naming, warnings/info for recommendations)
- **Enabled**: By default

### Import Resolution Rule (`import-resolution`) ⭐ v0.6.0

Validates that imports resolve to existing files and detects circular dependencies.

- **Checks**:
  - File existence validation for all @path imports
  - Circular dependency detection (A → B → A)
  - Recursive depth limit enforcement (5 hops max)
  - Path resolution (relative, absolute, home directory)
- **Severity**: Error for missing files and cycles
- **Enabled**: By default

### Content Appropriateness Rule (`content-appropriateness`) ⭐ v0.6.0

Ensures content is specific, actionable, and belongs in CLAUDE.md.

- **Checks**:
  - Generic instructions detection ("follow best practices")
  - File size recommendations (~5KB limit)
  - Content placement (README vs CLAUDE.md)
  - Section size optimization
  - Actionable vs passive language
- **Severity**: Warning for size, Info for suggestions
- **Enabled**: By default

### Monorepo Hierarchy Rule (`monorepo-hierarchy`) ⭐ v0.6.0

Validates CLAUDE.md file relationships in monorepos.

- **Checks**:
  - Parent/child CLAUDE.md conflict detection
  - Duplicate content across hierarchy
  - Organization recommendations for multi-package repos
  - Import-based consolidation suggestions
- **Severity**: Warning for conflicts, Info for guidance
- **Enabled**: By default

### Command Safety Rule (`command-safety`) ⭐ v0.6.0

Validates bash command safety in code blocks.

- **Checks**:
  - Dangerous commands (`rm -rf /`, `curl | bash`, fork bombs)
  - Error handling (`set -e`, `|| exit 1`)
  - Variable quoting in destructive operations
  - Unsafe `sudo` usage warnings
- **Severity**: Error for dangerous commands, Warning for safety issues
- **Enabled**: By default

### Skill Structure Rule (`skill-structure`) 🆕 v0.11.0

Validates Claude Code skill files (`.claude/skills/*.md`).

- **Checks**:
  - Frontmatter presence and validity
  - Name format (kebab-case required)
  - Description length (10-200 characters)
  - Content structure after frontmatter
- **Severity**: Error for missing required fields, Warning for style issues
- **Enabled**: By default

### Subagent Structure Rule (`subagent-structure`) 🆕 v0.11.0

Validates Claude Code subagent files (`.claude/agents/*.md`).

- **Checks**:
  - Frontmatter presence with name and description
  - Valid tool names (Read, Edit, Bash, Glob, etc.)
  - Valid model identifiers (claude-3-5-sonnet, opus, haiku, etc.)
  - Prompt content presence and minimum length
- **Severity**: Error for missing required fields, Warning for invalid tools/models
- **Enabled**: By default

### Hook Configuration Rule (`hook-configuration`) 🆕 v0.11.0

Validates Claude Code hook configuration (`.claude/settings.json`).

- **Checks**:
  - Valid JSON syntax
  - Hook structure (matcher and command fields)
  - Dangerous command detection (`rm -rf`, `curl | sh`, fork bombs)
  - Command safety (warnings for `&&` without `set -e`)
- **Severity**: Error for JSON/structure issues, Warning for dangerous commands
- **Enabled**: By default

### Karpathy Recommendations (`karpathy`) 🆕

Opinionated CLAUDE.md style advisories inspired by Andrej Karpathy's commentary on writing for LLMs and "context engineering" — you program the model in English, so the context window should be minimal, high signal-to-noise, literal, and example-driven. Heuristics, not an official standard.

- **Checks**:
  - Hedging language (`try to`, `where appropriate`) that makes instructions non-literal
  - Filler / politeness (`please`, `thank you`, `you are a helpful assistant`) that spends context without signal
  - Guideline sections that list many rules but show no concrete example (show, don't tell)
  - Overly long prose paragraphs (prefer tight, skimmable lines or bullets)
- **Scope**: `CLAUDE.md` files only; code fences are ignored
- **Severity**: Info (recommendations, never fails CI)
- **Enabled**: By default

### Secret Detection Rule (`secret-detection`) 🆕

Flags likely credentials pasted into `CLAUDE.md` — one of the most damaging authoring mistakes, since context files are versioned, shared, and fed to models.

- **Checks**:
  - Provider key shapes: OpenAI (`sk-…`, `sk-proj-…`), Anthropic (`sk-ant-…`), GitHub (`ghp_`/`gho_`/`ghs_`/`ghu_`/`github_pat_…`), AWS access keys (`AKIA…`), Google (`AIza…`), Slack (`xoxb-…`)
  - PEM private-key blocks (`-----BEGIN … PRIVATE KEY-----`)
  - High-entropy `KEY=`/`TOKEN=`/`SECRET=`/`PASSWORD=` assignments
- **Scope**: Markdown files only; both prose and fenced code blocks are scanned
- **Severity**: Error
- **Masking**: Messages show only the first four characters of a secret (e.g. `sk-A…`) and never echo the full value
- **False positives**: Obvious placeholders (`sk-xxxx`, `your-api-key-here`, `<…>`, `example`, all-same-char) are ignored
- **Enabled**: By default

### Plugin Manifest Rule (`plugin-manifest`) 🆕

Validates Claude Code plugin manifests — the plugin descriptor (`.claude-plugin/plugin.json`) and the marketplace listing (`marketplace.json`). A malformed manifest silently breaks plugin discovery and installation.

- **Checks**:
  - Valid JSON that parses to an object
  - Required `name` field (non-empty string)
  - `version`, when present, is valid SemVer (e.g. `1.2.3`)
  - Resource references (`commands`, `agents`, `skills`, `hooks`) are path strings or arrays of path strings; absolute paths and backslashes are flagged
  - Marketplace `plugins` is an array whose entries carry a `name` (and a `source`)
- **Scope**: `plugin.json` and `marketplace.json` files only
- **Severity**: Error (structural), Warning (path portability, missing `source`)
- **Enabled**: By default

### MCP Config Rule (`mcp-config`) 🆕

Validates Model Context Protocol server configuration in `.mcp.json`.

- **Checks**:
  - Valid JSON containing an `mcpServers` object
  - Each server is **either** stdio (`command`, optional `args`/`env`) **or** remote (`url` + `type` of `sse`/`http`) — never both or neither
  - `${VAR}` environment-variable placeholders are well-formed
  - No duplicate server names
  - `args` is an array of strings and `env` is an object of string values
- **Scope**: `.mcp.json` files only
- **Severity**: Error (structural), Warning (missing/ambiguous fields)
- **Enabled**: By default

### Output Style Rule (`output-style`) 🆕

Validates Claude Code output-style definitions in `.claude/output-styles/*.md`.

- **Checks**:
  - Frontmatter is present with required `name` and `description` fields
  - Warns on unknown frontmatter keys (only `name` and `description` are recognized)
- **Scope**: Markdown files under an `output-styles/` directory
- **Severity**: Error (missing required fields), Warning (unknown keys)
- **Enabled**: By default

### File Size Rule (`file-size`)

Validates that CLAUDE.md files don't exceed size limits for optimal performance.

- **Default**: 10,000 characters
- **Severity**: Warning
- **Configurable**: `--max-size <number>`

### Structure Rule (`structure`)

Ensures required sections are present in CLAUDE.md files.

- **Required Sections**:
  - "Project Overview"
  - "Development Commands"
  - "Architecture"
- **Severity**: Error
- **Purpose**: Maintains consistent documentation structure

### Content Rule (`content`) ⚠️ Deprecated

> **Note**: This rule is deprecated in v0.5.0. Use `content-organization` instead.

Technology-specific content validation (deprecated in favor of content-organization).

- **Status**: Maintained for backward compatibility
- **Migration**: Switch to `content-organization` rule

### Format Rule (`format`)

Validates Markdown syntax and formatting best practices.

- **Checks**:
  - Header spacing (`# Header` not `#Header`)
  - Trailing whitespace
  - Consecutive empty lines (max 2)
  - Code block formatting
  - File ending with newline
- **Severity**: Mixed (errors for syntax, warnings for style)

### Code Blocks Rule (`code-blocks`)

Validates fenced code blocks inside CLAUDE.md.

- **Checks**:
  - Language tag present (` ```bash ` not bare ` ``` `)
  - Matched fence delimiters
  - Indentation consistency inside the block
- **Severity**: Warning
- **Fixable**: Yes — `--fix` can add missing language tags
- **Why**: Untyped code blocks degrade Claude's ability to parse intent and surface bash code blocks for the `command-safety` rule.

## 🤖 MCP Server

Run cclint inside any MCP-compatible client (Claude Desktop, Claude Code, Cursor) — no global install required. Add to your MCP config:

```json
{
  "mcpServers": {
    "cclint": {
      "command": "npx",
      "args": ["@felixgeelhaar/cclint", "mcp"]
    }
  }
}
```

Tools exposed:

- `lint_file` — lint a file on disk
- `lint_string` — lint inline content (e.g. before saving an edit)
- `list_rules` — list every cclint rule
- `explain_rule` — get rationale + examples for a rule

Or run as a standalone bin: `npx cclint-mcp`.

## 🖊️ LSP Server

Get real-time cclint diagnostics in your editor while you edit CLAUDE.md, skills, subagents, and Claude Code config files — no save-and-run round trip. cclint ships a Language Server Protocol server that works with any LSP-compatible editor (VS Code, Neovim, Emacs, Sublime, …).

Run it over stdio:

```bash
cclint-lsp --stdio
```

What it provides:

- **Live diagnostics** — the same rules as the CLI run on the buffer's live text on open, change, and save, published as editor squiggles. File-kind gating is honored, so a `settings.json` gets hook rules while a `CLAUDE.md` gets structure rules.
- **Quick fixes** — violations that carry a structured fix are offered as `quickfix` code actions that apply the exact edit.
- **Config aware** — `.cclintrc.json` and presets are discovered upward from the edited document, so per-workspace config is respected.

Example Neovim (`nvim-lspconfig`) setup:

```lua
require('lspconfig.configs').cclint = {
  default_config = {
    cmd = { 'cclint-lsp', '--stdio' },
    filetypes = { 'markdown', 'json' },
    root_dir = require('lspconfig.util').root_pattern('.cclintrc.json', '.git'),
  },
}
require('lspconfig').cclint.setup({})
```

> A dedicated VS Code extension client is not yet published; any editor with a generic LSP client can launch `cclint-lsp --stdio` today.

## 💡 `cclint why` — AI fix suggestions

Get plain-language explanations and AI-generated fix suggestions for any violation:

```bash
cclint why CLAUDE.md                          # all violations
cclint why CLAUDE.md --rule command-safety    # filter by rule
cclint why CLAUDE.md --line 41                # filter by line
cclint why CLAUDE.md --ai                     # AI-generated fix (needs ANTHROPIC_API_KEY)
```

Without `--ai`, prints the rule rationale and good example. With `--ai`, sends the offending line + rule context to Claude Haiku 4.5 and prints a focused 3–6 line fix suggestion.

## ⚙️ Configuration

### Command Line Options

```bash
cclint lint [options] <path>          # <path> may be a file or a directory

Options:
  -f, --format <format>   Output format (text, json, sarif) (default: "text")
  --max-size <size>       Maximum file size in characters (default: "10000")
  -c, --config <path>     Path to configuration file
  --fix                   Automatically fix problems where possible
  -i, --interactive       Interactively fix problems one at a time
  --diff                  Only show violations on changed lines
  --diff-ref <ref>        Git ref to compare against (default: "HEAD")
  --plain                 Plain text output (no emoji) for CI logs / screen readers
  --summary               Group violations by rule with counts
  --allow-plugins         Load custom rule plugins declared in project config
                          (opt-in; also set via CCLINT_ALLOW_PLUGINS=1)
  -h, --help              Display help for command

cclint install [options]

Options:
  --hooks                 Install pre-commit git hooks (default: true)
  --pre-push              Install pre-push quality check hooks (default: true)
  -h, --help              Display help for command
```

### Exit Codes

- `0`: No errors (warnings allowed)
- `1`: Errors found or execution failed

## 🏗️ Architecture

CC Linter follows a **hexagonal architecture** with clean separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐
│   CLI Adapter   │    │ VS Code Extension│
│                 │    │    (Future)      │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
          ┌──────────▼───────────┐
          │   Core Engine        │
          │ ┌─────────────────┐  │
          │ │ Rules Engine    │  │
          │ │ - FileSizeRule  │  │
          │ │ - StructureRule │  │
          │ │ - ContentRule   │  │
          │ │ - FormatRule    │  │
          │ └─────────────────┘  │
          └──────────────────────┘
```

### Domain Model

- **ContextFile**: Represents a CLAUDE.md file with parsing capabilities
- **Rule**: Interface for validation logic
- **Violation**: Represents a rule violation with location and severity
- **LintingResult**: Aggregates all violations for a file

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/felixgeelhaar/cclint.git
cd cclint

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Run the linter on itself
npm run dev -- lint CLAUDE.md
# Or after global install
cclint lint CLAUDE.md
```

### Scripts

```bash
npm test              # Run test suite with Vitest
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run typecheck     # Type check with TypeScript
npm run lint          # Lint source code
npm run build         # Build for production
npm run dev           # Run development version
```

### Testing Philosophy

CC Linter follows **Test-Driven Development (TDD)**:

- ✅ **980 tests** with comprehensive coverage
- 🚀 **Vitest** for ultra-fast test execution
- 🎯 **Unit tests** for domain logic
- 🔗 **Integration tests** for CLI functionality
- 📊 **Coverage reporting** for quality assurance

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code of conduct
- Development process
- Pull request requirements
- Testing guidelines

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Run the test suite (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋 Support

- 📚 [Documentation](https://github.com/felixgeelhaar/cclint#readme)
- 🐛 [Report Issues](https://github.com/felixgeelhaar/cclint/issues)
- 💬 [Discussions](https://github.com/felixgeelhaar/cclint/discussions)
- 📧 [Email Support](mailto:felix@felixgeelhaar.de)

## 🏆 Why CC Linter?

### For Developers

- **Consistency**: Maintain standardized CLAUDE.md files across projects
- **Quality**: Catch common issues before they impact AI interactions
- **Speed**: Fast feedback loop with instant validation
- **Integration**: Works with CI/CD pipelines and development workflows

### For Teams

- **Standards**: Enforce documentation standards across repositories
- **Onboarding**: Help new developers understand project structure
- **Maintenance**: Keep context files up-to-date and effective
- **Automation**: Integrate with existing development processes

## ⚙️ Advanced Features

### Configuration Files

Create a `.cclintrc.json` file to customize rules for your project:

```json
{
  "rules": {
    "file-size": {
      "enabled": true,
      "severity": "warning",
      "options": {
        "maxSize": 15000
      }
    },
    "structure": {
      "enabled": true,
      "options": {
        "requiredSections": ["Overview", "Commands", "Architecture"]
      }
    }
  },
  "ignore": ["*.backup.md"]
}
```

Prefer a shared baseline? Extend a built-in preset instead of hand-writing rules:

```json
{
  "extends": "@cclint/recommended"
}
```

- `@cclint/recommended` — the sensible defaults (core rules as warnings).
- `@cclint/strict` — every rule enabled, every violation an error (great for CI).

`extends` also accepts an array (applied left-to-right), and your own `rules`
always override the preset.

📚 [Full Configuration Guide](docs/configuration.md)

### Auto-fix

Automatically fix common formatting issues:

```bash
cclint lint CLAUDE.md --fix
```

### Git Hooks

Install pre-commit hooks to lint files automatically:

```bash
cclint install --hooks
```

Install pre-push hooks for comprehensive quality checks:

```bash
cclint install --pre-push
```

Install both hooks:

```bash
cclint install --hooks --pre-push
```

The pre-push hook runs:

- TypeScript type checking
- ESLint linting
- Prettier formatting check
- Full test suite

### GitHub Action

Add automated linting to your CI/CD pipeline:

```yaml
- name: Lint CLAUDE.md
  uses: felixgeelhaar/cclint@v0.16.0
  with:
    files: 'CLAUDE.md'
    format: 'text'
```

#### GitHub Code Scanning (SARIF)

Emit SARIF and upload it so violations appear as inline PR annotations and in
the repository's Code Scanning dashboard:

```yaml
- name: Lint CLAUDE.md (SARIF)
  run: npx @felixgeelhaar/cclint lint CLAUDE.md --format sarif > cclint.sarif
  continue-on-error: true # keep the run alive so the SARIF still uploads

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: cclint.sarif
```

📚 [GitHub Action Guide](docs/github-action.md)

### Custom Rules API

Create your own validation rules with the powerful Custom Rules API:

```javascript
import { CustomRule } from '@felixgeelhaar/cclint';

class MyCustomRule extends CustomRule {
  constructor() {
    super('my-rule', 'Description of my custom rule');
  }

  validateInternal(file) {
    const violations = [];
    // Your validation logic here
    return violations;
  }

  generateFixes(violations, content) {
    // Your auto-fix logic here
    return [];
  }
}

// Plugin export
export default {
  name: 'my-plugin',
  version: '1.0.0',
  rules: [new MyCustomRule()],
};
```

**Configuration (.cclintrc.json):**

```json
{
  "plugins": [
    {
      "name": "./my-plugin.js",
      "enabled": true
    }
  ],
  "rules": {
    "my-rule": {
      "enabled": true,
      "severity": "warning"
    }
  }
}
```

**Features:**

- 🔌 **Plugin System**: Load custom rules dynamically
- 🎯 **TypeScript Support**: Full type safety and IntelliSense
- 🔧 **Auto-fix Integration**: Custom rules support automatic fixes
- ⚙️ **Configurable**: Enable/disable and configure custom rules
- 📊 **Multiple Severities**: Error, warning, or info levels

> **🔒 Plugins are opt-in.** A config-declared plugin runs arbitrary code
> in-process, so cclint will **not** load the plugins listed in a project's
> `.cclintrc.json`/`package.json` unless you explicitly trust them by passing
> `--allow-plugins` (or setting `CCLINT_ALLOW_PLUGINS=1`). Without that gate the
> plugins are skipped — never imported — and cclint tells you how to enable
> them. This keeps linting an untrusted repository safe by default.

```bash
# Trust and load this project's declared plugins
cclint lint CLAUDE.md --allow-plugins

# Equivalent via environment variable
CCLINT_ALLOW_PLUGINS=1 cclint lint .
```

📚 [View Example Custom Rules](examples/custom-rules/)

## 🔮 Roadmap

- [ ] **VS Code Extension** - First-party editor client (a generic LSP client works today)
- [x] **LSP Server** - Real-time diagnostics + quick fixes in any editor (`cclint-lsp`) ✅
- [x] **Project-wide Linting** - `cclint lint .` across a whole config tree ✅
- [x] **Config Presets** - `extends: "@cclint/recommended" | "@cclint/strict"` ✅
- [x] **SARIF Output** - `--format sarif` for GitHub Code Scanning ✅
- [x] **Custom Rules API** - Plugin system for custom validation logic ✅
- [x] **Enhanced Auto-fix** - More intelligent fixes and suggestions ✅
- [x] **Configuration Files** - `.cclintrc.json` for project-specific rules ✅
- [x] **Auto-fix Suggestions** - Automatic fixes for common issues ✅
- [x] **Pre-push Quality Hooks** - Comprehensive quality checks before push ✅
- [x] **Git Hooks Integration** - Pre-commit validation ✅
- [x] **GitHub Action** - Easy CI/CD integration ✅

---

<div align="center">

**Made with ❤️ by Felix Geelhaar for the Claude AI developer community**

[⭐ Star us on GitHub](https://github.com/felixgeelhaar/cclint) • [📦 View on npm](https://www.npmjs.com/package/@felixgeelhaar/cclint) • [🐛 Report Bug](https://github.com/felixgeelhaar/cclint/issues)

</div>
