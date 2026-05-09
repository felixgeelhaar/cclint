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

# Set custom file size limit
cclint lint CLAUDE.md --max-size 5000
```

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
cclint lint [options] <file>

Options:
  -f, --format <format>   Output format (text, json) (default: "text")
  --max-size <size>       Maximum file size in characters (default: "10000")
  -c, --config <path>     Path to configuration file
  --fix                   Automatically fix problems where possible
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

- ✅ **371 tests** with comprehensive coverage
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
  uses: felixgeelhaar/cclint@v0.14.0
  with:
    files: 'CLAUDE.md'
    format: 'text'
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

📚 [View Example Custom Rules](examples/custom-rules/)

## 🔮 Roadmap

- [ ] **VS Code Extension** - Real-time linting in your editor
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
