# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the CC Linter project.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences.

## ADR Format

Each ADR follows this structure:

- **Title**: Short noun phrase
- **Status**: Proposed, Accepted, Deprecated, Superseded
- **Context**: What is the issue that we're seeing that is motivating this decision?
- **Decision**: What is the change that we're proposing and/or doing?
- **Consequences**: What becomes easier or more difficult to do because of this change?

## Index

| ADR                                      | Title                                          | Status   |
| ---------------------------------------- | ---------------------------------------------- | -------- |
| [001](001-vitest-over-jest.md)           | Use Vitest instead of Jest                     | Accepted |
| [002](002-esm-only-architecture.md)      | ESM-Only Module System                         | Accepted |
| [003](003-hexagonal-architecture.md)     | Hexagonal Architecture Pattern                 | Accepted |
| [004](004-map-based-rule-storage.md)     | Map-Based Rule Storage                         | Accepted |
| [005](005-plugin-security-sandbox.md)    | Plugin Security Sandbox                        | Accepted |
| [006](006-anthropic-alignment-v0.5.0.md) | Anthropic Official Guidance Alignment (v0.5.0) | Accepted |

## Creating a New ADR

1. Copy the template from `000-template.md`
2. Number it sequentially (e.g., `006-your-decision.md`)
3. Fill in the sections
4. Update this index
5. Submit for review
