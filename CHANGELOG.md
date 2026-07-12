# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.16.0] - 2026-07-12

A large feature + hardening release: project-wide linting, an LSP server, new
rules and validators, config presets, and a security-focused audit pass.

### ✨ Added

- **Project-wide lint** — `cclint lint .` discovers and lints a whole project tree (`CLAUDE.md` and nested, `.claude/skills/**`, `.claude/agents/**`, `.claude/output-styles/**`, `settings*.json`, `.mcp.json`, `plugin.json`/`marketplace.json`), routing each file to the rules that apply to it and aggregating results across `text`, `json`, and `sarif`.
- **LSP server** (`cclint-lsp` bin) — real-time diagnostics on open/change/save and quick-fix code actions in any editor, reusing the same rule engine as the CLI.
- **`secret-detection` rule** — flags likely leaked credentials (OpenAI, Anthropic, GitHub, AWS, Google, Slack key shapes, PEM private-key blocks, high-entropy `KEY=`/`TOKEN=` assignments) in `CLAUDE.md` and code fences; masks the value in the message and ignores obvious placeholders.
- **New validators** — `plugin-manifest` (`plugin.json` / `marketplace.json`), `mcp-config` (`.mcp.json` server shape, `${VAR}` placeholders, duplicate-name detection), and `output-style` (`.claude/output-styles/*.md` frontmatter).
- **Config presets** — `extends: "@cclint/recommended" | "@cclint/strict"` (array form supported) so teams get sane defaults without hand-writing rule config.
- **SARIF output** — `--format sarif` (SARIF 2.1.0) for GitHub Code Scanning and inline PR annotations.

### 🔒 Security

- **Config-declared plugins no longer auto-execute.** Plugins discovered in a project's `.cclintrc.json`/`package.json` are only loaded with an explicit `--allow-plugins` flag (or `CCLINT_ALLOW_PLUGINS=1`) — closing an arbitrary-code-execution vector when linting an untrusted repository.
- **Symlink-aware path containment** — `PathValidator` now resolves real paths and re-checks base-directory containment, so a symlink inside an allowed directory can't escape it.
- **MCP file reads** go through the `FileReader` adapter (extension allowlist, size/line caps, path + symlink validation) instead of a raw read.
- **DoS content caps** (max size / line length) are enforced on every entrypoint — CLI, GitHub Action, and MCP — as a domain invariant.
- CI workflow runs with least-privilege `permissions: contents: read`.

### 🐛 Fixed

- **Model validation** no longer false-flags current models — the `fable` family and `claude-fable-5` are recognized; model knowledge is centralized with a freshness check.
- **`hook-configuration` is now reachable** — `settings.json` files can be linted (the reader previously rejected non-Markdown), and `.claude/settings.local.json` / `~/.claude/settings.json` are recognized.
- **Rule drift fixed** — the GitHub Action and CLI now run an identical rule set (the Action previously skipped `code-blocks` and `karpathy`).
- **Circular-import** detection catches cycles back to the root file; **CRLF/CR** line endings are normalized so line-anchored rules behave correctly.
- **`command-safety`** catches `rm -rf` variants (flag reordering, long-form flags); user-supplied `dangerousCommands` are matched literally instead of as unescaped regex.
- **Rule applicability** — CLAUDE.md-document rules (structure, karpathy, monorepo, file-location) no longer emit "missing section" false positives on skill/agent/output-style Markdown or on `settings.json`.

### 🔧 Changed / Internal

- Unified rule construction behind a single `createRules(config)` factory + canonical rule descriptors (one source of truth for id / default / metadata), removing the divergent hand-built rule lists across entrypoints.
- Auto-fixes are now **first-class on violations** (produced by the detecting rule, not matched from message text); severity overrides preserve a violation's fix.
- Extracted a shared `FrontmatterParser`; split the 585-LOC `CodeBlockRule` into per-language validator strategies; moved file I/O out of the domain layer.
- Removed the fictional plugin "sandbox" claim in favor of an honest, documented in-process-with-trust-gate posture.
- Test hardening — pinned message/severity/location assertions, stabilized flaky subprocess/cwd tests, and made Stryker mutation testing available locally (`npm run test:mutation`).

## [0.15.1] - 2026-07-04

### 🔒 Security

- **`path-security`** — path-containment now rejects sibling-prefix escapes: a base of `/project` no longer accepts `/project-evil/...` (previously a `startsWith` check let a sibling directory sharing the base's prefix through). Containment is checked on a path-separator boundary.
- **`GitDiffProvider`** — git is now invoked via `execFileSync` with argument arrays instead of a shell string, removing a command-injection surface when a branch/ref name reaches the diff commands.

### 🐛 Fixed (false positives)

- **`structure`** — a missing section is now a **warning** ("recommended"), not an error ("required"), so a lean CLAUDE.md no longer fails CI on structure alone.
- **`import-resolution`** — no longer flags `@`-mentions and other non-import `@` strings; an import is recognized only at a word boundary with a path-like target.
- **`format`** (`--fix`) — is now fenced-code-aware: it no longer rewrites headers, blank lines, list markers, or trailing whitespace **inside** code blocks, so shebangs, YAML, and formatted snippets survive a fix.
- **`hook-configuration`** — rewritten to Claude Code's real hooks schema (a top-level `hooks` object keyed by actual events: `PreToolUse`, `SessionStart`, …). It now validates real `settings.json` and catches dangerous hook commands (e.g. `curl … | sh`) that the previous fictional-schema version silently skipped.

### 🔧 Changed

- Per-rule **severity overrides** from config are now actually applied to a rule's emitted violations.
- Removed the dead `PluginSandbox` in favor of an honest, documented trusted-only plugin posture (plugins run in-process, trusted like any npm dependency).

## [0.15.0] - 2026-06-03

### ✨ Features

- **New `karpathy` rule** — opinionated, INFO-severity CLAUDE.md recommendations inspired by Andrej Karpathy's LLM / context-engineering principles (minimal, high signal-to-noise, literal, example-driven). Flags hedging language, filler/politeness, guideline sections without examples (show, don't tell), and overly long prose paragraphs. CLAUDE.md-scoped, code-fence-aware, default-on, never fails CI. Wired into the lint CLI, MCP server, watch mode, `explain`, registry, and public exports.

## [0.14.0] - 2026-05-09

### 🛠️ Quality Hardening Release

Round of mutation-driven test strengthening + 3 real correctness bug
fixes surfaced by Stryker.

### Fixed

- `content-appropriateness` actionability check now matches both
  contracted ("it's important") and full ("it is important") forms.
  The negative-lookahead still allows "it is important to <verb>".
- `content-organization` vague-language check now tracks open/close
  fence state instead of skipping only the fence delimiter line, so
  vague terms in code examples no longer fire false positives.
- `content-organization` specificity check no longer self-matches
  the keyword "format" against its own tool-name allowlist regex,
  which previously suppressed every format-related warning. Allowlist
  tightened to actual formatter names (eslint, prettier, black,
  gofmt, rustfmt, biome, clang-format, ruff) bounded by word
  boundaries.

### Tested

Major mutation-score improvements per file:

- `CodeBlockRule`: 37.62% → 45.56% (+8 points)
- `FormatRule`: 45.83% → 62.50% (+17 points)
- `MonorepoHierarchyRule`: 42.26% → 64.29% (+22 points)
- `SubagentStructureRule`: 54.15% → 57.88% (+4 points)
- `HookConfigurationRule`: 68.21% → 79.47% (+11 points)
- `SkillStructureRule`: 66.45% → 74.34% (+8 points)
- `ContentOrganizationRule`: 55.35% (after bug fix)
- `ContentAppropriatenessRule`: 61.27% (after bug fix)

Combined domain + rules: 56.96% → 62.85%. Domain primitives stay at
93.59%. Tests: 545 → 607 (+62).

## [0.13.0] - 2026-05-09

### 🚀 Distribution + AI Release

This release ships cclint as an MCP server and adds an AI-assisted
explainer, opening two new distribution surfaces beyond the CLI.

### Added

- **`cclint mcp`** — Run cclint as a Model Context Protocol stdio
  server. Any MCP client (Claude Desktop, Claude Code, Cursor, etc.)
  can now call cclint without a global install. Exposes four tools:
  - `lint_file` — lint a CLAUDE.md / skill / subagent / hook on disk
  - `lint_string` — lint inline content (great for "before save" checks)
  - `list_rules` — enumerate every available rule
  - `explain_rule` — return rationale, examples, and config options
    Bin entry `cclint-mcp` is also published; either form works in MCP
    client configs.
- **`cclint why <file>`** — Explain a violation in plain language using
  the rule's rationale and good examples. Add `--ai` plus an
  `ANTHROPIC_API_KEY` env var to get a context-aware fix suggestion
  generated against the offending line. Filterable by `--rule` and
  `--line`.

### Tested

- 7 MCP server tests (tool registration, lint_file, lint_string,
  list_rules, explain_rule positive + negative paths)
- 3 `cclint why` integration tests

### Test Coverage

- 535 → 545 tests (+10)

## [0.12.0] - 2026-05-09

### 🎯 Quality + Correctness Release

This release closes the actionable items from a multi-discipline product /
GTM / UX / AI / quality review. Focused on fixing silent correctness drift,
removing trust-killing inconsistencies, and putting the test suite on a
mutation-tested footing.

### Fixed

- **Model registry pinned to Claude 4.X family** in `subagent-structure`
  rule. `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5` now
  recognized; `claude-3-*` family flagged as deprecated (INFO). MCP tool
  prefix `mcp__*` accepted. Unknown tools/models downgraded from WARNING
  to INFO so the linter no longer rejects valid current configs.
- **Version drift across `package.json`, CLI `--version`, README, and
  CHANGELOG.** Single source pinned at 0.12.0; CI gate prevents regression.
- **README hero replaced** outcome-led: "Catch CLAUDE.md drift before
  Claude misbehaves" instead of internal-vanity "11/10 alignment".
- **`cclint explain` and README rule list now match.** Skill / subagent /
  hook rules added to `RULE_METADATA`; `code-blocks` README section added.
  CI gate prevents future doc/code drift.

### Added

- **`cclint lint --plain`** — text-only severity tokens (`[ERROR]`,
  `[WARN]`, `[INFO]`) for screen readers, CI logs, and non-TTY output.
  Auto-detected via `CI=true`, `NO_EMOJI=1`, `NO_COLOR=1`, or non-TTY
  stdout.
- **`cclint lint --summary`** — grouped output by rule with occurrence
  counts and severity ordering. Useful for noisy monorepos.
- **Default output collapses repeated rules.** A rule firing four or more
  times shows the first occurrence plus an "and N more" hint and a
  pointer to `--summary`.
- **Fixable count footer.** When violations are auto-fixable, output now
  ends with `→ N of M issues are auto-fixable. Run with --fix.`
- **GitHub Action attaches violations to PR diffs** via `core.error` /
  `core.warning` / `core.notice` annotation properties (file, startLine,
  startColumn, title). Reviewers see violations inline in the diff.

### Tested

- **Stryker mutation testing introduced.** Domain primitives at 93.59%
  mutation score; rule layer at 54.74%; combined 56.96%. Run with
  `npm run test:mutation`.
- **PluginSandbox adversarial suite.** 14 negative-path tests cover
  timeout enforcement, throw containment, output validation, input
  immutability, and module allowlist. 4 documented sandbox limitations
  (sync infinite loop, runtime require, process.exit, post-hoc memory)
  pinned for the future worker-thread migration.
- **Every rule registered in `RULE_METADATA` now has a unit test file.**
  Added test files for `command-safety`, `import-resolution`,
  `import-syntax`, `file-location`, `content-organization`,
  `content-appropriateness`, and `monorepo-hierarchy`.

### Test Coverage

- 371 → 527 tests (+156)
- 6 files at 100% mutation score: Severity, RulesEngine, Violation,
  Location, FileSizeRule, ContextFile (97%)

## [0.11.0] - 2026-03-21

### 🎯 Claude Code Extended Features Release

This release achieves **11/10 Anthropic alignment** by adding validation for Claude Code's extended features beyond CLAUDE.md.

### Added

#### Skill Structure Rule (`skill-structure`)

Validates `.claude/skills/*.md` files:

- Frontmatter presence and validity
- Kebab-case name format
- Description length (10-200 characters)
- Content structure after frontmatter

#### Subagent Structure Rule (`subagent-structure`)

Validates `.claude/agents/*.md` files:

- Frontmatter with name and description
- Valid tool names (Read, Edit, Bash, Glob, etc.)
- Valid model identifiers (claude-3-5-sonnet, opus, haiku)
- Prompt content presence and minimum length

#### Hook Configuration Rule (`hook-configuration`)

Validates `.claude/settings.json` files:

- Valid JSON syntax
- Hook structure (matcher and command fields)
- Dangerous command detection
- Command safety warnings

### ✅ Test Coverage

- **371 tests** (up from 322)
- Unit tests for all three new rules
- Integration tests with fixture files

## [0.7.0] - 2025-01-17

### 🚀 Developer Experience Release

This release focuses on enhancing the developer experience with new commands and features that streamline CLAUDE.md development workflows.

### Added

#### Watch Mode

- 👁️ **Watch Command**: Real-time file monitoring with auto-linting
  - `cclint watch <file>` for single file monitoring
  - `cclint watch` with glob patterns for multiple files
  - Debounced lint runs to prevent excessive re-runs
  - Clear terminal output on each change
  - Graceful shutdown with Ctrl+C

#### Configuration Scaffolding

- 🛠️ **Init Command**: Generate configuration files with `cclint init`
  - Creates `.cclintrc.json` with sensible defaults
  - `--force` flag to overwrite existing configs
  - Detects project context for optimal defaults
  - All rules enabled by default with documentation links

#### Pre-commit Hook Integration

- 🪝 **Hook Commands**: Seamless Git hook management
  - `cclint install-hook` - Detects and integrates with Husky, Lefthook, pre-commit, or raw Git hooks
  - `cclint uninstall-hook` - Cleanly removes hook integration
  - Auto-detects hook manager in use
  - Creates appropriate hook configuration for each manager

#### Interactive Fix Mode

- 🔧 **Interactive Fixing**: Step-by-step fix application with `--interactive` / `-i` flag
  - Review each fix before applying (y/n/a/q)
  - Apply all remaining fixes with 'a'
  - Quit without further changes with 'q'
  - Shows fix preview with context

#### Rule Documentation

- 📚 **Explain Command**: Detailed rule documentation with `cclint explain [rule-id]`
  - Lists all available rules when no ID provided
  - Shows comprehensive rule details including:
    - Description and rationale
    - Good and bad examples with explanations
    - Configuration options
    - Related rules
  - `--json` flag for programmatic access

#### Diff-Aware Linting

- 📝 **Diff Mode**: Lint only changed lines with `--diff` flag
  - Compares against HEAD by default
  - `--diff-ref <ref>` to compare against specific branch/commit
  - Shows violation count for changed lines only
  - Perfect for CI in PR review workflows

### Technical

- Added 6 new infrastructure components:
  - `Watcher` - File system monitoring with chokidar
  - `Scaffolder` - Configuration file generation
  - `HookManager` - Git hook detection and management
  - `InteractiveFixer` - Terminal-based fix workflow
  - `RuleMetadata` - Comprehensive rule documentation registry
  - `GitDiffProvider` - Git diff parsing and line change detection
- All 322 tests passing
- Full TypeScript strict mode compliance
- Zero breaking changes - fully backward compatible

### Quality Metrics

- ✅ **Test Coverage**: 322 passing tests (up from 235)
- ✅ **New Commands**: 4 new CLI commands
- ✅ **New Flags**: 3 new lint command flags
- ✅ **TypeScript Strict Mode**: Full compliance
- ✅ **Production Ready**: All CI checks passing

## [0.6.0] - 2025-01-05

### 🎯 Perfect 10/10 Anthropic Alignment Achieved

This release achieves **10/10 alignment** with Anthropic's official CLAUDE.md best practices by implementing comprehensive validation for all documented guidelines.

### Added

#### Phase 1: Critical Import & Content Validation

- 🔍 **ImportResolutionRule**: Complete import resolution and circular dependency detection
  - Validates that `@path/to/file` imports point to existing files
  - Detects circular import chains (A imports B imports A)
  - Validates recursive import depth doesn't exceed 5 hops
  - Resolves relative, absolute, and home directory paths correctly
  - Provides clear error messages with import chain visualization

- 📋 **ContentAppropriatenessRule**: Ensures content belongs in CLAUDE.md
  - Detects overly generic instructions ("follow best practices" → specific guidance)
  - Warns when file size exceeds recommendations (~5KB limit)
  - Identifies content better suited for README or separate docs
  - Validates section sizes for optimal consumption
  - Checks for actionable vs passive instructions

#### Phase 2: Monorepo & Command Safety

- 🏗️ **MonorepoHierarchyRule**: Multi-CLAUDE.md validation for monorepos
  - Detects and validates parent/child CLAUDE.md relationships
  - Warns about conflicting instructions across hierarchy
  - Suggests consolidating duplicate content with imports
  - Provides monorepo organization best practices

- 🛡️ **CommandSafetyRule**: Bash command safety validation
  - Detects dangerous commands (`rm -rf /`, `curl | bash`, fork bombs)
  - Validates error handling in bash scripts (`set -e`, `|| exit 1`)
  - Checks variable quoting in destructive commands
  - Warns about unsafe `sudo` usage without context
  - Suggests safer alternatives with examples

### Enhanced

- ⚡ **ContentOrganizationRule**: Enhanced emphasis validation
  - Detects emphasis overuse (>20% of lines) that reduces effectiveness
  - Warns about consecutive emphasis markers losing impact
  - Validates spacing of critical instruction markers
  - Ensures emphasis is reserved for truly important items

### Technical

- Updated all CLI commands and GitHub Action to use new rules
- Enhanced RuleRegistry to recognize new built-in rules
- All new rules enabled by default (can be disabled in config)
- Zero breaking changes - fully backward compatible
- All 235 tests passing with new validation rules

### Documentation

- Updated README with 10/10 alignment achievement
- Comprehensive rule documentation for new validators
- Configuration examples for all new rules
- Migration guide from 0.5.0 to 0.6.0

### Quality Metrics

- ✅ **Anthropic Alignment**: 10/10 (up from 9.5/10)
- ✅ **Test Coverage**: 235 passing tests
- ✅ **TypeScript Strict Mode**: Full compliance
- ✅ **Zero Linting Issues**: Clean codebase
- ✅ **Production Ready**: All CI checks passing

## [0.5.0] - 2025-01-04

### Added

- ✨ **ImportSyntaxRule**: Validates Anthropic's new `@path/to/file` import syntax
  - Detects imports outside code blocks/spans (per Anthropic specification)
  - Validates path formats (relative, absolute, home directory `~/`)
  - Warns about duplicate imports
  - Checks for max depth violations (5 hops limit)
  - Provides helpful error messages for common mistakes (Windows paths, spaces, package names)

- 📝 **ContentOrganizationRule**: Content quality validation aligned with Anthropic best practices
  - Heading hierarchy validation (h1 → h2 → h3, no skipping levels)
  - Bullet point usage suggestions for better organization
  - Vague language detection ("properly" → "use 2-space indentation")
  - Emphasis suggestions (IMPORTANT, YOU MUST for critical instructions)
  - Specificity validation (ensures format instructions have measurements/tools)

- 📍 **FileLocationRule**: File placement and naming validation
  - CLAUDE.local.md deprecation warnings → import syntax migration guide
  - Validates only CLAUDE.md/CLAUDE.local.md files (skips test fixtures)
  - Location recommendations (user vs project memory hierarchy)
  - Git awareness (.gitignore suggestions for personal content)

### Changed

- **ContentRule**: Deprecated in favor of ContentOrganizationRule
  - Technology-agnostic approach (removed hardcoded npm/TypeScript checks)
  - Focus on content structure over specific technologies
  - Clear migration path documented
  - Maintained for backward compatibility

### Enhanced

- **Anthropic Alignment**: Achieved 9.5/10 alignment with official CLAUDE.md guidance (up from 8.5/10)
- **Backward Compatibility**: Support both 'content' and 'content-organization' config keys
- **Default Rules**: New rules enabled by default (can be disabled in config)
- **Documentation**: Added ADR 006 documenting alignment decisions

### Removed

- **size-limit**: Removed bundle size analysis tool (not suitable for Node.js CLI applications)
  - Bundle analysis is designed for browser applications, not Node.js tools
  - Project quality is ensured through TypeScript compilation, tests, and linting instead

### Technical

- Enhanced RuleRegistry to recognize new built-in rules
- Updated all CLI commands and GitHub Action to use new rules
- Proper TypeScript strict mode compliance with bracket notation for index signatures
- All 235 tests passing with new validation rules
- Replaced `||` with `??` (nullish coalescing) throughout codebase for safer fallbacks

## [0.3.1] - 2025-01-21

### Fixed

- Updated README.md with correct v0.3.0 GitHub Action version reference
- Updated test count from 193 to 221 tests in documentation
- Ensured all documentation reflects the latest features and capabilities

### Documentation

- GitHub Action example now shows `@v0.3.0` for proper version pinning
- Test suite statistics updated to reflect current count (221 tests)
- All features properly documented including Custom Rules API

## [0.3.0] - 2025-01-21

### Added

- 🔌 **Custom Rules API**: Extensible plugin system for creating custom validation rules
  - Abstract `CustomRule` base class for implementing custom validation logic
  - `RuleRegistry` for centralized rule management and discovery
  - `PluginLoader` for dynamic loading of custom rule plugins
  - Plugin validation and error handling with comprehensive error messages
  - Configuration system for enabling/disabling custom rules
  - Category-based rule organization and filtering
  - Plugin metadata and statistics tracking

- 📚 **Plugin Development Kit**: Complete framework for building custom rules
  - Well-defined plugin interface with `Plugin` and `PluginModule` types
  - Example plugin demonstrating best practices (`no-swearing-plugin`)
  - Auto-fix capability support for custom rules
  - Rule options validation and configuration
  - Plugin lifecycle management (load/unload/reload)

- 🛠️ **Enhanced Auto-fix System**: Extended auto-fix to support custom rules
  - Integration of custom rule fixes with built-in fix system
  - Priority-based fix application to avoid conflicts
  - Support for multiple fixes per violation from custom rules
  - Enhanced list marker standardization fixes
  - Improved code block language detection and fixing

### Enhanced

- **CLI Integration**: Seamless integration of custom rules into existing lint command
  - Plugin loading from configuration files
  - Custom rule status reporting and diagnostics
  - Error handling for plugin loading failures
  - Performance metrics for plugin operations

- **Documentation**: Comprehensive guides and examples
  - Custom rule development tutorial
  - Plugin architecture documentation
  - Example configurations and usage patterns
  - API reference for custom rule development

### Technical

- Added 4 new core classes: `CustomRule`, `RuleRegistry`, `PluginLoader`, `PluginModule`
- Enhanced `AutoFixer` with custom rule integration
- Updated CLI command with plugin system support
- Added comprehensive test coverage for all new features (60+ new tests)
- Maintained full backward compatibility with existing configurations

## [0.2.0] - 2025-01-21

### Added

- 🔧 **Configuration File Support**: Load settings from `.cclintrc.json` or `package.json`
  - Customizable rule settings and severity levels
  - Project-specific rule configurations
  - Support for extending configurations
  - Ignore patterns for excluding files
- 🛠️ **Auto-fix Functionality**: Automatically fix common formatting issues with `--fix` flag
  - Fix missing spaces after headers
  - Remove trailing whitespace
  - Remove excessive empty lines
  - Intelligent fix application with detailed reporting

- 🪝 **Git Hooks Integration**: Pre-commit validation support
  - Install hooks with `cclint install --hooks`
  - Automatic CLAUDE.md validation before commits
  - Prevent commits with linting errors
  - Easy integration with existing git workflows

- 🤖 **GitHub Action Support**: CI/CD integration for automated linting
  - Ready-to-use GitHub Action via `action.yml`
  - Configurable inputs for files, format, and error handling
  - Detailed output with error and warning counts
  - Example workflows provided

### Changed

- Updated package name from `cc-linter` to `cclint` for consistency
- Enhanced CLI command structure with new `install` command
- Improved error messages and output formatting

### Fixed

- GitHub Actions workflow using correct action versions
- Package-lock.json generation for CI builds

### Developer Experience

- Added comprehensive test coverage for all new features
- Maintained 100% backward compatibility
- Enhanced documentation with configuration examples
- Added example files for quick setup

## [0.1.2] - 2025-01-21

### Fixed

- Initial npm publication setup

## [0.1.1] - 2025-01-21

### Fixed

- GitHub Actions release workflow

## [0.1.0] - 2025-01-21

### Added

- Initial release of CC Linter
- Core linting engine with four built-in rules:
  - **File Size Rule**: Validates file size limits
  - **Structure Rule**: Ensures required sections are present
  - **Content Rule**: Checks for essential content patterns
  - **Format Rule**: Validates Markdown syntax and formatting
- Command-line interface with text and JSON output formats
- TypeScript implementation with clean architecture
- Comprehensive test suite with 91+ tests
- Basic documentation and examples

[0.7.0]: https://github.com/felixgeelhaar/cclint/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/felixgeelhaar/cclint/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/felixgeelhaar/cclint/compare/v0.3.1...v0.5.0
[0.3.1]: https://github.com/felixgeelhaar/cclint/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/felixgeelhaar/cclint/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/felixgeelhaar/cclint/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/felixgeelhaar/cclint/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/felixgeelhaar/cclint/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/felixgeelhaar/cclint/releases/tag/v0.1.0
