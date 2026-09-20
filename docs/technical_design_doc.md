Technical Design: cclint (CC Linter)
Status: Living summary (see ADRs for decisions)
Author: Project maintainers
Related Document: README.md, docs/ROADMAP.md
Last revised: September 2026

1. Overview & Goals
   cclint validates and optimizes Claude Code project instruction files
   (CLAUDE.md, AGENTS.md, .claude/rules, skills, agents, hooks, MCP/plugin
   configs). Goals:
   Modularity: Core engine decoupled from delivery mechanisms (CLI, MCP, LSP, Action).
   Testability: Full TDD support with fast unit/integration tests.
   Developer Experience: Near-instant feedback via tsx + Vitest locally.
   Correctness: Strict tsc type checking and audit gates in CI.

2. Architecture & Domain-Driven Design
   Hexagonal architecture: a Core Linting Engine holds domain logic; adapters
   connect CLI (`cclint`), MCP (`cclint-mcp`), LSP (`cclint-lsp`), and the
   GitHub Action. All entry points build rules from the single `createRules(config)`
   factory (`src/rules/registry/`).

   2.1 Architecture Diagram
   +-------------------------------------------------------------------------+
   | User / Editor / CI                                                      |
   +-------------------------------------------------------------------------+
          |              |              |              |
          v              v              v              v
   +-----------+  +-----------+  +-----------+  +----------------+
   | CLI       |  | MCP       |  | LSP       |  | GitHub Action  |
   | (cclint)  |  | cclint-mcp|  | cclint-lsp|  |                |
   +-----------+  +-----------+  +-----------+  +----------------+
          \              |              |              /
           \             |              |             /
            v            v              v            v
   +-------------------------------------------------------------------------+
   | Core Linting Engine (npm package)                                       |
   |  RulesEngine + createRules(RULE_DESCRIPTORS) + individual Rules         |
   |  FileDiscovery / FileReader / ConfigLoader (infrastructure adapters)    |
   +-------------------------------------------------------------------------+

   A first-party VS Code extension client is not yet published; any LSP client
   works today via `cclint-lsp --stdio` (ADR 008).

2.2 Domain Model (Ubiquitous Language)
ContextFile: In-memory representation of a file being linted.
Rule: Self-contained service that inspects a ContextFile and returns Violations.
Violation: Entity representing a broken rule with Location and Severity.
Location: Value object defining position of a Violation.
Severity: Value object (Error, Warning, Info).
LintingResult: Root aggregate containing all Violations for a file.

3. Technology Stack
Language: TypeScript (ESM)
Runtime: Node.js (>=18)
Development: tsx
Production type checking: tsc
Testing: Vitest (ADR 001 — not Jest)
CLI: commander.js
Packaging: npm

4. Development Workflow & Testing Strategy (TDD)
4.1 Speed in Dev, Correctness in CI
Local: tsx + Vitest for near-instant feedback.
CI: npm ci → lint → test → typecheck → build → self-lint → npm audit.

4.2 Test-Driven Development with Vitest
Unit tests (~80%): each Rule has dedicated tests.
Integration: RulesEngine + multi-file discovery.
Drift gates: rule-registry-drift, version-sync, presets parity.

Example scripts (see package.json):
  "test": "vitest",
  "test:watch": "vitest --watch",
  "typecheck": "tsc --noEmit"

TDD loop: write failing test → npm test → implement → refactor.

5. Further reading
- docs/adr/ — Architecture Decision Records
- docs/ROADMAP.md — shipped themes and remaining platform work
- docs/configuration.md — config presets, ignore (path-fragment), plugins
