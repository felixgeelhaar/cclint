# ADR 002 - ESM-Only Module System

**Status**: Accepted

**Date**: 2024-07-18

**Authors**: Felix Geelhaar

## Context

Node.js supports two module systems: CommonJS (CJS) and ECMAScript Modules (ESM). The CC Linter project needs to choose a module strategy that will:

- Support modern JavaScript standards
- Work with TypeScript compilation
- Enable future-proof architecture
- Minimize bundling complexity

Node.js v18+ has stable ESM support, and the TypeScript ecosystem has matured around ESM patterns.

## Decision

We will use **ESM exclusively** for the CC Linter project. No CommonJS compatibility layer will be provided.

Implementation details:

- `package.json` specifies `"type": "module"`
- All imports use `.js` extensions (TypeScript's `verbatimModuleSyntax`)
- `tsconfig.json` targets `"module": "ESNext"`
- File extensions: `.ts` (source), `.js` (compiled)

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## Alternatives Considered

### Dual Package (ESM + CJS)

- **Pros**: Maximum compatibility with legacy Node.js projects
- **Cons**:
  - Complex build process (dual compilation)
  - Duplicate code in published package
  - "Dual package hazard" footgun
  - Maintenance burden for two module systems
- **Why rejected**: Node.js 18+ ESM is stable; complexity not worth legacy support

### CommonJS Only

- **Pros**: Simpler in legacy environments, broader compatibility
- **Cons**:
  - Against ECMAScript standard
  - Limited tree-shaking
  - Async import limitations
  - Not future-proof
- **Why rejected**: ESM is the future; CJS is legacy

### Bundled CJS with ESM Source

- **Pros**: Distributes CJS for compatibility while developing in ESM
- **Cons**:
  - Build complexity
  - Bundle size concerns
  - Debugging challenges (source maps)
- **Why rejected**: Our target users (modern Node.js projects) support ESM natively

## Consequences

### Positive Consequences

- **Standards-aligned**: Follows ECMAScript module specification
- **Tree-shaking**: Enables better dead code elimination in bundlers
- **Top-level await**: Can use modern async patterns
- **Import.meta**: Access to module metadata (URL, dirname equivalents)
- **Simpler builds**: Single compilation target
- **Future-proof**: ESM is the JavaScript standard moving forward
- **Better TypeScript**: `verbatimModuleSyntax` ensures import/export correctness

### Negative Consequences

- **Node.js version constraint**: Requires Node.js 18+ (engine requirement)
- **Legacy incompatibility**: Cannot be used in CommonJS-only projects
- **Import specifiers**: Must use `.js` extensions (TypeScript quirk)
- **Migration friction**: Users migrating from CommonJS may need adjustments

### Neutral Consequences

- **Package ecosystem**: Most modern packages support ESM
- **Tooling**: Modern tools (Vitest, esbuild, Vite) have excellent ESM support

## Follow-up Actions

- [x] Configure `package.json` with `"type": "module"`
- [x] Set `tsconfig.json` to `"module": "ESNext"`
- [x] Enable `verbatimModuleSyntax` in TypeScript
- [x] Document ESM requirements in README.md
- [x] Add Node.js version check in package.json engines

## References

- [Node.js ESM Documentation](https://nodejs.org/api/esm.html)
- [TypeScript ESM Guide](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [Package.json type field](https://nodejs.org/api/packages.html#type)
- Related: ADR-001 (Vitest has native ESM support)
