Technical Design: Claude.md Linter
Status: Revised Draft
Author: Gemini (Technical Lead)
Related Document: PRD: Claude.md Linter
Date: July 19, 2025

1. Overview & Goals
   This document outlines the technical architecture for the Claude.md Linter. The primary goal is to create a robust, testable, and extensible system that helps developers validate and optimize their CLAUDE.md context files.
   The design prioritizes:
   Modularity: A decoupled core engine from its delivery mechanisms (CLI, IDE).
   Testability: A structure that fully supports Test-Driven Development (TDD).
   Developer Experience: A fast and fluid development workflow with near-instant feedback.
   Correctness: Guaranteed type safety in all production builds.
2. Architecture & Domain-Driven Design
   The architecture remains a modular, hexagonal design. A Core Linting Engine contains all domain logic, independent of its invocation. Adapters connect this core to the outside world.
   2.1 Architecture Diagram
   +-------------------------------------------------------------------------+
   | User |
   +-------------------------------------------------------------------------+
   | |
   v v
   +------------------------+ +---------------------------------+
   | CLI Adapter | | VS Code Extension (Adapter) |
   | (claude-linter cmd) | | (Uses Language Server Protocol) |
   +------------------------+ +---------------------------------+
   | |
   | Invokes Core API |
   v v
   +-------------------------------------------------------------------------+
   | |
   | Core Linting Engine (npm package) |
   | |
   | +-------------------------------------------------------------------+ |
   | | Ubiquitous Language: Rule, Violation, Severity, Location | |
   | +-------------------------------------------------------------------+ |
   | |
   | +-----------------+ +-----------------+ +---------------------+ |
   | | Rules Engine |--->| Individual Rules|--->| File System I/O | |
   | | (Aggregates | | (Services that | | (Reads CLAUDE.md, | |
   | | Violations) | | implement Rule | | .gitignore) | |
   | | | | interface) | | | |
   | +-----------------+ +-----------------+ +---------------------+ |
   | |
   +-------------------------------------------------------------------------+

2.2 Domain Model (Ubiquitous Language)
(This section remains unchanged as it is technology-agnostic)
ContextFile: An in-memory representation of a file being linted.
Rule: A self-contained domain service that inspects a ContextFile and returns Violations.
Violation: An entity representing a single broken rule.
Location: A value object defining the position of a Violation.
Severity: A value object (Error, Warning, Info).
LintingResult: The root aggregate containing all Violations for a file. 3. Technology Stack
The project will be built on the Node.js platform using the following key technologies, chosen to optimize for both developer experience and production robustness:
Language: TypeScript
Runtime: Node.js
Development Runner & Transpiler: tsx (for fast, on-the-fly execution of TS code during development and testing)
Production Type Checker: tsc (the official TypeScript Compiler, used for rigorous type checking in CI)
Testing Framework: Jest
CLI Framework: commander.js or yargs
Packaging: npm 4. Development Workflow & Testing Strategy (TDD)
We will adopt a "Best of Both Worlds" strategy that leverages the strengths of different tools at different stages of the development lifecycle. This is central to our goal of a fast and safe development process.
4.1 The Core Principle: Speed in Dev, Correctness in CI
During Development: We prioritize speed. Developers need immediate feedback. Therefore, all local scripts, including tests, will be executed via tsx. tsx uses the high-performance esbuild compiler to run TypeScript code almost instantly.
During Continuous Integration (CI): We prioritize correctness. Before any code is merged or deployed, we will run the official TypeScript compiler (tsc) to perform a comprehensive and strict type-check of the entire project. This guarantees that we don't trade type safety for development speed.
4.2 Test-Driven Development with Jest and tsx
Our test pyramid remains the same (Unit, Integration, E2E), but its execution will be significantly faster.
Unit Tests (~80%): Each Rule will have dedicated tests.
Configuration: Jest will be configured to use an esbuild-based transformer. This bypasses the slower ts-jest and allows tests to run at near-native speed.
Example package.json scripts:
"scripts": {
"test": "jest",
"test:watch": "jest --watch",
"typecheck": "tsc --noEmit"
}

The TDD Loop:
Write a failing test in a \*.test.ts file.
Run npm test. The test will fail almost instantly.
Write the minimal code to make the test pass.
Run npm test again for immediate confirmation.
Refactor and repeat. 5. Deployment & CI/CD
Our CI/CD pipeline (e.g., GitHub Actions) will be configured to enforce our dual-tool strategy. A typical Pull Request workflow will include the following mandatory jobs:
Install Dependencies: npm ci
Lint & Format: npm run lint
Run Tests (Speed-focused): npm test
This job runs Jest using the fast esbuild transformer. It ensures all logic is working as expected.
Check Types (Correctness-focused): npm run typecheck
This job runs tsc --noEmit. It performs the strict, full-project type validation that esbuild skips. It is the final gatekeeper for code quality.
Only if all jobs pass can the code be merged. This ensures that every commit is both functionally correct and type-safe. Packages will be published to npm and the VS Code Marketplace upon creating a new Git tag from the main branch.
