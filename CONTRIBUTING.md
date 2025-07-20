# Contributing to CC Linter 🤝

Thank you for your interest in contributing to CC Linter! We're excited to work with the community to make this tool even better.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Coding Standards](#coding-standards)
- [Architecture Guidelines](#architecture-guidelines)

## 📜 Code of Conduct

This project adheres to the Contributor Covenant [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Git

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/cc-linter.git
   cd cc-linter
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/cc-linter/cc-linter.git
   ```

## 🛠️ Development Setup

```bash
# Install dependencies
npm install

# Run tests to ensure everything works
npm test

# Build the project
npm run build

# Test the CLI
npm run dev -- lint CLAUDE.md
```

### Available Scripts

```bash
npm test              # Run test suite with Vitest
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run typecheck     # Type check with TypeScript
npm run lint          # Lint source code
npm run lint:fix      # Auto-fix linting issues
npm run build         # Build for production
npm run dev           # Run development version
```

## 🔄 Making Changes

### Branching Strategy

1. Create a new branch from `main`:
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feature/your-feature-name
   ```

2. Use descriptive branch names:
   - `feature/add-yaml-support`
   - `fix/header-parsing-bug`
   - `docs/update-contributing-guide`

### Development Workflow

1. **Write tests first** (TDD approach):
   ```bash
   # Create test file
   touch tests/unit/rules/YourNewRule.test.ts
   
   # Write failing tests
   npm run test:watch
   ```

2. **Implement your changes**:
   - Follow existing code patterns
   - Maintain TypeScript strict mode compliance
   - Ensure proper error handling

3. **Verify your changes**:
   ```bash
   npm run typecheck  # Type safety
   npm run lint       # Code style
   npm test           # All tests pass
   npm run build      # Builds successfully
   ```

## 🧪 Testing

### Testing Philosophy

CC Linter follows **Test-Driven Development (TDD)**:

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test CLI and component interactions
- **E2E Tests**: Test complete user workflows

### Writing Tests

```typescript
// Example unit test
import { describe, it, expect } from 'vitest';
import { YourRule } from '../../../src/rules/YourRule.js';

describe('YourRule', () => {
  describe('lint', () => {
    it('should return no violations for valid input', () => {
      const rule = new YourRule();
      const file = new ContextFile('/test.md', '# Valid Content');
      
      const violations = rule.lint(file);
      
      expect(violations).toHaveLength(0);
    });
  });
});
```

### Test Coverage

- Maintain **>90%** test coverage
- All new features must include tests
- Bug fixes should include regression tests

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/index.html
```

## 📤 Pull Request Process

### Before Submitting

1. **Update your branch**:
   ```bash
   git checkout main
   git pull upstream main
   git checkout your-branch
   git rebase main
   ```

2. **Run the full test suite**:
   ```bash
   npm run typecheck && npm run lint && npm test && npm run build
   ```

3. **Test manually**:
   ```bash
   npm run dev -- lint tests/fixtures/valid-claude.md
   npm run dev -- lint tests/fixtures/invalid-claude.md
   ```

### Pull Request Template

When creating a PR, include:

- **Description**: What does this change do?
- **Motivation**: Why is this change needed?
- **Testing**: How was this tested?
- **Breaking Changes**: Any breaking changes?
- **Checklist**: Completed items from the template

### Review Process

1. Automated checks must pass (CI/CD)
2. At least one maintainer review required
3. Address review feedback promptly
4. Squash commits before merging (if requested)

## 🐛 Issue Reporting

### Before Reporting

1. Search existing issues for duplicates
2. Check if the issue exists in the latest version
3. Try to reproduce with minimal example

### Issue Types

- **🐛 Bug Report**: Something isn't working
- **✨ Feature Request**: New functionality
- **📚 Documentation**: Improvements to docs
- **🔧 Enhancement**: Improvements to existing features

### Issue Template

```markdown
## Description
Brief description of the issue

## Steps to Reproduce
1. Step one
2. Step two
3. Expected vs actual behavior

## Environment
- CC Linter version: x.x.x
- Node.js version: x.x.x
- Operating System: 

## Additional Context
Any other relevant information
```

## 📏 Coding Standards

### TypeScript Guidelines

```typescript
// ✅ Good
export class FileSizeRule implements Rule {
  public readonly id = 'file-size';
  
  private readonly maxSize: number;
  
  constructor(maxSize: number = 10000) {
    if (maxSize <= 0) {
      throw new Error('Max size must be positive');
    }
    this.maxSize = maxSize;
  }
}

// ❌ Avoid
export class FileSizeRule {
  id = 'file-size'; // Missing access modifier
  maxSize; // Missing type annotation
}
```

### Code Style

- **Naming**: Use descriptive names (`getUserById` not `getUser`)
- **Functions**: Keep functions small and focused
- **Classes**: Follow single responsibility principle
- **Imports**: Use absolute imports with `.js` extension
- **Comments**: Write self-documenting code, minimal comments

### File Organization

```
src/
├── domain/          # Core business logic
├── rules/           # Linting rule implementations
├── infrastructure/  # External adapters (file system, etc.)
└── cli/            # Command-line interface
    ├── commands/   # CLI command implementations
    └── formatters/ # Output formatting
```

## 🏗️ Architecture Guidelines

### Domain-Driven Design

Follow the existing architecture patterns:

```typescript
// Domain entities
export class ContextFile {
  // Core business logic only
}

// Rules implement the Rule interface
export class CustomRule implements Rule {
  public readonly id: string;
  public readonly description: string;
  
  public lint(file: ContextFile): Violation[] {
    // Rule-specific validation logic
  }
}

// Adapters handle external concerns
export class FileReader {
  // File system operations
}
```

### Adding New Rules

1. **Create the rule class**:
   ```typescript
   // src/rules/YourRule.ts
   export class YourRule implements Rule {
     public readonly id = 'your-rule';
     public readonly description = 'Description of what this rule checks';
     
     public lint(file: ContextFile): Violation[] {
       // Implementation
     }
   }
   ```

2. **Add comprehensive tests**:
   ```typescript
   // tests/unit/rules/YourRule.test.ts
   describe('YourRule', () => {
     // Test cases
   });
   ```

3. **Register the rule**:
   ```typescript
   // src/cli/commands/lint.ts
   const rules = [
     new FileSizeRule(maxSize),
     new StructureRule(),
     new ContentRule(),
     new FormatRule(),
     new YourRule() // Add your rule
   ];
   ```

### Error Handling

```typescript
// ✅ Good: Specific error messages
if (maxSize <= 0) {
  throw new Error('Max size must be positive');
}

// ✅ Good: Handle expected errors
try {
  const content = await readFile(filePath, 'utf-8');
} catch (error: unknown) {
  if (error instanceof Error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
  throw new Error(`Failed to read file ${filePath}: Unknown error`);
}
```

## 🎉 Recognition

Contributors will be recognized in:

- **README.md**: Contributors section
- **CHANGELOG.md**: Release notes
- **GitHub**: Contributor graphs and stats

## 📞 Getting Help

- **GitHub Discussions**: For questions and discussions
- **GitHub Issues**: For bug reports and feature requests
- **Email**: For private/security concerns

## 📝 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to CC Linter! 🚀