# {{projectName}}

{{projectDescription}}

## Project Overview

This is a TypeScript project using {{packageManager}} for package management.

## Development Commands

```bash
# Install dependencies
{{installCommand}}

# Run in development mode
{{devCommand}}

# Run tests
{{testCommand}}

# Type check
{{typecheckCommand}}

# Build for production
{{buildCommand}}

# Lint code
{{lintCommand}}
```

## Architecture

### Directory Structure

```
src/
├── index.ts          # Main entry point
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── ...
```

### Key Technologies

- **Runtime**: Node.js
- **Language**: TypeScript
- **Package Manager**: {{packageManager}}
- **Test Framework**: {{testFramework}}

## Code Style

- Use TypeScript strict mode
- Follow ESLint configuration
- Use Prettier for formatting
- Prefer `const` over `let`
- Use explicit return types on exported functions

## Testing

Run tests with:

```bash
{{testCommand}}
```

Test files should be placed in `tests/` or alongside source files with `.test.ts` extension.
