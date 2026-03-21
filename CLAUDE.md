# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the CC Linter project - a TypeScript/Node.js tool designed to validate and optimize CLAUDE.md context files. The project follows a hexagonal architecture with a Core Linting Engine that is independent from its delivery mechanisms (CLI, IDE extensions).

## Development Commands

```bash
# Development (uses tsx for fast execution)
npm test                # Run tests with Vitest
npm run test:watch      # Run tests in watch mode

# Production checks (uses tsc for strict type checking)
npm run typecheck      # Type check with TypeScript compiler
npm run lint           # Lint code
npm run build          # Build for production

# Package management
npm ci                 # Install dependencies (CI)
npm install            # Install dependencies
```

## Architecture

The project uses a **Domain-Driven Design** approach with hexagonal architecture:

### Core Domain Model

- **ContextFile**: In-memory representation of a file being linted
- **Rule**: Self-contained service that inspects a ContextFile and returns Violations
- **Violation**: Entity representing a broken rule with Location and Severity
- **Location**: Value object defining position of a Violation
- **Severity**: Value object (Error, Warning, Info)
- **LintingResult**: Root aggregate containing all Violations for a file

### Architecture Layers

```
CLI Adapter ──┐
              ├──► Core Linting Engine (npm package)
VS Code Ext ──┘     ├── Rules Engine (aggregates violations)
                    ├── Individual Rules (implement Rule interface)
                    └── File System I/O (reads CLAUDE.md, .gitignore)
```

## Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **Development**: tsx (fast esbuild-based execution)
- **Production Type Checking**: tsc (strict TypeScript compiler)
- **Testing**: Vitest for fast unit and integration tests
- **CLI Framework**: commander.js
- **Linting**: ESLint + Prettier
- **Packaging**: npm

## Development Workflow

The project follows a **"Speed in Dev, Correctness in CI"** philosophy:

### Local Development (Speed-focused)

- All local scripts use `tsx` for near-instant TypeScript execution
- Tests run via Vitest with esbuild transformer for fast feedback
- TDD loop: write test → run `npm test` → implement → refactor

### CI/CD (Correctness-focused)

Required CI jobs:

1. `npm ci` - Install dependencies
2. `npm run lint` - Lint and format
3. `npm test` - Run tests (Vitest)
4. `npm run typecheck` - Strict type checking with tsc
5. `npm run build` - Build for production
6. `npm audit` - Security vulnerability check

### Test Strategy

- **Unit Tests** (~80%): Each Rule has dedicated tests
- **Integration Tests**: Test Rules Engine with multiple rules
- **E2E Tests**: Test complete linting workflows

## File Structure

The project contains:

- `src/` - TypeScript source code
  - `domain/` - Core domain model (Rule, Violation, ContextFile, etc.)
  - `rules/` - Individual linting rules
  - `infrastructure/` - Infrastructure adapters (CLI, file I/O)
  - `cli/` - CLI commands
  - `action/` - GitHub Action implementation
- `tests/` - Vitest test files
- `docs/` - Documentation and ADRs

## Key Development Principles

1. **Modularity**: Core engine is decoupled from delivery mechanisms
2. **Testability**: Full support for Test-Driven Development
3. **Type Safety**: Guaranteed type safety in production builds
4. **Fast Feedback**: Near-instant test execution during development
5. **Domain-Driven**: Clear ubiquitous language and bounded contexts
