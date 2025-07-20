# CC Linter 🔍

[![CI](https://github.com/felixgeelhaar/cclint/workflows/CI/badge.svg)](https://github.com/felixgeelhaar/cclint/actions)
[![npm version](https://badge.fury.io/js/cclint.svg)](https://badge.fury.io/js/cclint)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A fast, extensible linter for validating and optimizing CLAUDE.md context files. Built with TypeScript and designed for developers who want to ensure their Claude AI context files follow best practices.

## ✨ Features

- **🚀 Fast & Modern**: Built with TypeScript and Vitest for lightning-fast execution
- **📋 Comprehensive Rules**: File size, structure, content, and format validation
- **🎯 Extensible**: Plugin architecture for custom rules
- **📊 Multiple Output Formats**: Human-readable text and machine-parseable JSON
- **⚡ Developer-Friendly**: Instant feedback with detailed error locations
- **🔧 Configurable**: Customizable rules and options

## 📦 Installation

### Global Installation
```bash
npm install -g cclint
```

### Local Installation
```bash
npm install --save-dev cclint
```

### Using npx (No Installation Required)
```bash
npx cclint lint your-claude.md
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

### Content Rule (`content`)
Checks for essential content patterns that improve context effectiveness.

- **Required Patterns**:
  - npm commands
  - TypeScript usage
  - Testing information
  - Build process
- **Severity**: Warning
- **Purpose**: Ensures comprehensive project documentation

### Format Rule (`format`)
Validates Markdown syntax and formatting best practices.

- **Checks**:
  - Header spacing (`# Header` not `#Header`)
  - Trailing whitespace
  - Consecutive empty lines (max 2)
  - Code block formatting
  - File ending with newline
- **Severity**: Mixed (errors for syntax, warnings for style)

## ⚙️ Configuration

### Command Line Options

```bash
cclint lint [options] <file>

Options:
  -f, --format <format>   Output format (text, json) (default: "text")
  --max-size <size>       Maximum file size in characters (default: "10000")
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

- ✅ **91 tests** with comprehensive coverage
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

## 🔮 Roadmap

- [ ] **VS Code Extension** - Real-time linting in your editor
- [ ] **Configuration Files** - `.cclintrc.json` for project-specific rules
- [ ] **Custom Rules API** - Plugin system for custom validation logic
- [ ] **Auto-fix Suggestions** - Automatic fixes for common issues
- [ ] **Git Hooks Integration** - Pre-commit validation
- [ ] **GitHub Action** - Easy CI/CD integration

---

<div align="center">

**Made with ❤️ by Felix Geelhaar for the Claude AI developer community**

[⭐ Star us on GitHub](https://github.com/felixgeelhaar/cclint) • [📦 View on npm](https://www.npmjs.com/package/cclint) • [🐛 Report Bug](https://github.com/felixgeelhaar/cclint/issues)

</div>