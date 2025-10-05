# ADR 003 - Hexagonal Architecture Pattern

**Status**: Accepted

**Date**: 2024-07-18

**Authors**: Felix Geelhaar

## Context

The CC Linter needs to support multiple delivery mechanisms (CLI, VS Code extension, GitHub Action, potential web API) while maintaining a consistent core linting engine. The architecture must:

- Separate business logic from delivery mechanisms
- Enable testing without external dependencies
- Support multiple adapters (CLI, IDE, CI/CD)
- Maintain clear separation of concerns

## Decision

We will implement **Hexagonal Architecture** (Ports and Adapters pattern) for the CC Linter.

Architecture layers:

```
┌─────────────────────────────────────────────────────┐
│  Adapters (External Layer)                          │
│  - CLI (commander.js)                               │
│  - GitHub Action (@actions/core)                    │
│  - VS Code Extension (future)                       │
└─────────────────────────────────────────────────────┘
                        │
                        ↓ (depends on)
┌─────────────────────────────────────────────────────┐
│  Core Domain (Pure Business Logic)                  │
│  - ContextFile                                      │
│  - Rule (interface)                                 │
│  - Violation                                        │
│  - Location, Severity                               │
│  - RulesEngine                                      │
│  - LintingResult                                    │
└─────────────────────────────────────────────────────┘
                        ↑ (provides interfaces)
                        │
┌─────────────────────────────────────────────────────┐
│  Infrastructure (Technical Layer)                    │
│  - FileReader                                       │
│  - ConfigLoader                                     │
│  - PluginLoader                                     │
│  - RuleRegistry                                     │
└─────────────────────────────────────────────────────┘
```

**Directory structure:**

```
src/
├── domain/          # Core business logic (no external dependencies)
│   ├── ContextFile.ts
│   ├── Rule.ts
│   ├── RulesEngine.ts
│   └── ...
├── rules/           # Concrete rule implementations
│   ├── FileSizeRule.ts
│   ├── StructureRule.ts
│   └── ...
├── infrastructure/  # Technical concerns
│   ├── ConfigLoader.ts
│   ├── FileReader.ts
│   └── ...
├── cli/            # CLI adapter
│   ├── index.ts
│   └── commands/
└── action/         # GitHub Action adapter
    └── index.ts
```

## Alternatives Considered

### Layered Architecture

- **Pros**: Simple, well-understood, common pattern
- **Cons**:
  - Coupling between layers
  - Hard to swap delivery mechanisms
  - Business logic can leak into UI/API layers
- **Why rejected**: Doesn't support multiple adapters cleanly

### Microservices Architecture

- **Pros**: Independent deployment, scalability
- **Cons**:
  - Massive overkill for a linting tool
  - Network overhead, complexity
  - Operational burden
- **Why rejected**: Too complex for a single-purpose CLI tool

### Monolithic with Shared Core

- **Pros**: Simple, all code in one place
- **Cons**:
  - Poor separation of concerns
  - Difficult to test in isolation
  - Adapter logic mixed with business logic
- **Why rejected**: Hinders testability and maintainability

## Consequences

### Positive Consequences

- **Testability**: Core domain can be tested without I/O dependencies
- **Flexibility**: Easy to add new adapters (VS Code, web API, etc.)
- **Maintainability**: Clear boundaries reduce coupling
- **Reusability**: Core engine is adapter-agnostic
- **Team clarity**: Developers understand where code belongs
- **Dependency inversion**: Business logic doesn't depend on infrastructure

### Negative Consequences

- **Initial complexity**: More upfront design needed
- **More files**: Clear separation means more directories/files
- **Learning curve**: Team needs to understand hexagonal principles
- **Indirection**: Extra layers between adapter and implementation

### Neutral Consequences

- **File count**: More files but clearer organization
- **Import paths**: Longer import paths but more explicit dependencies

## Follow-up Actions

- [x] Organize codebase into domain/rules/infrastructure/adapters
- [x] Ensure domain layer has zero external dependencies
- [x] Create interfaces for infrastructure ports
- [x] Document architecture in technical design doc
- [ ] Add architecture tests to enforce layer boundaries

## References

- [Hexagonal Architecture (Alistair Cockburn)](https://alistair.cockburn.us/hexagonal-architecture/)
- [Ports and Adapters Pattern](https://herbertograca.com/2017/09/14/ports-adapters-architecture/)
- [Technical Design Document](../technical_design_doc.md)
- Related: Clean Architecture by Robert C. Martin
