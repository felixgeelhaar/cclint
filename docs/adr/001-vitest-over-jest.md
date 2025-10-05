# ADR 001 - Use Vitest Instead of Jest

**Status**: Accepted

**Date**: 2024-07-18

**Authors**: Felix Geelhaar

## Context

The CC Linter project requires a robust testing framework for unit, integration, and end-to-end tests. The choice of testing framework impacts developer experience, test execution speed, and TypeScript integration quality.

Key requirements:

- Fast test execution for TDD workflow
- Native ESM support (project uses ES modules)
- Excellent TypeScript support
- Compatible with modern Node.js (v18+)
- Active maintenance and community

## Decision

We will use **Vitest** as our primary testing framework instead of Jest.

Vitest provides:

- **Native ESM support**: Works seamlessly with our ES module architecture
- **Ultra-fast execution**: Uses esbuild for near-instant TypeScript compilation
- **Jest-compatible API**: Easy migration path and familiar syntax
- **Built-in TypeScript support**: No additional configuration needed
- **Watch mode**: Instant feedback during development

Configuration (`vitest.config.ts`):

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

## Alternatives Considered

### Jest

- **Pros**: Industry standard, massive ecosystem, extensive documentation
- **Cons**:
  - Slower execution (requires babel/ts-jest transformation)
  - ESM support still experimental and problematic
  - Requires additional configuration for TypeScript
- **Why rejected**: ESM support issues and slower performance don't align with our modern TypeScript architecture

### AVA

- **Pros**: Fast, minimal, built-in TypeScript support
- **Cons**:
  - Smaller ecosystem
  - Different API (not Jest-compatible)
  - Less tooling integration
- **Why rejected**: Jest-compatible API is valuable for team familiarity

### Node.js Test Runner

- **Pros**: Native to Node.js, zero dependencies
- **Cons**:
  - Limited features (no coverage, snapshots)
  - Immature ecosystem
  - Less IDE integration
- **Why rejected**: Too minimal for comprehensive testing needs

## Consequences

### Positive Consequences

- **Instant test feedback**: esbuild transformation is 10-20x faster than Jest
- **TDD-friendly**: Fast watch mode enables true test-driven development
- **Zero ESM issues**: Native ESM support eliminates module resolution problems
- **Simple configuration**: Works out-of-the-box with TypeScript ESM projects
- **Modern tooling**: Aligns with Vite ecosystem and modern best practices

### Negative Consequences

- **Smaller community**: Fewer Stack Overflow answers and community plugins than Jest
- **Newer framework**: Less battle-tested in large-scale production environments
- **Limited enterprise adoption**: Some organizations mandate Jest for consistency

### Neutral Consequences

- **Jest-compatible API**: Test syntax is identical, making migration low-risk
- **Learning curve**: Minimal for developers familiar with Jest

## Follow-up Actions

- [x] Configure Vitest with Node.js environment
- [x] Set up coverage reporting with v8 provider
- [x] Add watch mode scripts for development
- [x] Document testing practices in CONTRIBUTING.md

## References

- [Vitest Documentation](https://vitest.dev/)
- [Technical Design Document](../technical_design_doc.md)
- [Why Vitest](https://vitest.dev/guide/why.html)
- Project requirement: ESM-only architecture (ADR-002)
