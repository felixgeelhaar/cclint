# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the CC Linter project - a TypeScript/Node.js tool designed to validate and optimize CLAUDE.md context files. The project follows a hexagonal architecture with a Core Linting Engine that is independent from its delivery mechanisms (CLI, IDE extensions).

## Development Commands

Since this is a new project without implemented build scripts yet, the following commands are planned based on the technical design:

```bash
# Development (uses tsx for fast execution)
npm test                # Run tests with Jest
npm run test:watch      # Run tests in watch mode
npm run dev            # Development mode (planned)

# Production checks (uses tsc for strict type checking)
npm run typecheck      # Type check with TypeScript compiler
npm run lint           # Lint code (planned)
npm run build          # Build for production (planned)

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
- **Testing**: Jest with esbuild transformer
- **CLI Framework**: commander.js or yargs (planned)
- **Packaging**: npm

## Development Workflow

The project follows a **"Speed in Dev, Correctness in CI"** philosophy:

### Local Development (Speed-focused)
- All local scripts use `tsx` for near-instant TypeScript execution
- Tests run via Jest with esbuild transformer for fast feedback
- TDD loop: write test → run `npm test` → implement → refactor

### CI/CD (Correctness-focused)
Required CI jobs:
1. `npm ci` - Install dependencies
2. `npm run lint` - Lint and format
3. `npm test` - Run tests (fast esbuild)
4. `npm run typecheck` - Strict type checking with tsc

### Test Strategy
- **Unit Tests** (~80%): Each Rule has dedicated tests
- **Integration Tests**: Test Rules Engine with multiple rules
- **E2E Tests**: Test complete linting workflows

## File Structure

Currently the project only contains:
- `docs/technical_design_doc.md` - Comprehensive technical design document
- This will expand to include `src/`, `tests/`, and configuration files

## Key Development Principles

1. **Modularity**: Core engine is decoupled from delivery mechanisms
2. **Testability**: Full support for Test-Driven Development
3. **Type Safety**: Guaranteed type safety in production builds
4. **Fast Feedback**: Near-instant test execution during development
5. **Domain-Driven**: Clear ubiquitous language and bounded contexts