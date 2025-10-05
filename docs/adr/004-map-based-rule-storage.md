# ADR 004 - Map-Based Rule Storage in RulesEngine

**Status**: Accepted

**Date**: 2024-07-18

**Authors**: Felix Geelhaar

## Context

The `RulesEngine` needs to store and manage multiple linting rules. The storage mechanism must:

- Prevent duplicate rule IDs
- Provide O(1) rule lookup by ID
- Maintain iteration order for consistent results
- Support efficient rule validation

Common approaches include arrays, objects, or Maps. The choice impacts performance, type safety, and API design.

## Decision

We will use **ES6 Map** for storing rules in the `RulesEngine`, keyed by rule ID.

Implementation (`src/domain/RulesEngine.ts`):

```typescript
export class RulesEngine {
  private readonly _rules: Map<string, Rule> = new Map();

  constructor(rules: Rule[]) {
    for (const rule of rules) {
      if (this._rules.has(rule.id)) {
        throw new Error(`Duplicate rule ID: ${rule.id}`);
      }
      this._rules.set(rule.id, rule);
    }
  }

  public getRuleById(ruleId: string): Rule | undefined {
    return this._rules.get(ruleId);
  }

  public hasRule(ruleId: string): boolean {
    return this._rules.has(ruleId);
  }
}
```

## Alternatives Considered

### Array Storage

```typescript
private readonly _rules: Rule[] = [];
```

- **Pros**:
  - Simple, familiar data structure
  - Direct iteration with `for...of`
  - JSON serializable
- **Cons**:
  - O(n) lookup by ID (requires `.find()`)
  - No built-in duplicate prevention
  - Manual ID validation needed
- **Why rejected**: Poor performance for rule lookups

### Object Storage

```typescript
private readonly _rules: Record<string, Rule> = {};
```

- **Pros**:
  - O(1) lookup by ID
  - Familiar object syntax
  - JSON serializable
- **Cons**:
  - Prototype pollution risk
  - No built-in iteration order guarantee (pre-ES2015)
  - TypeScript index signature issues
  - Can't distinguish missing vs undefined
- **Why rejected**: Less type-safe, potential security issues

### WeakMap Storage

```typescript
private readonly _rules: WeakMap<object, Rule> = new WeakMap();
```

- **Pros**:
  - Garbage collection friendly
  - No memory leaks
- **Cons**:
  - Can't use strings as keys (must be objects)
  - Not iterable
  - No `.size` property
- **Why rejected**: Can't use rule IDs (strings) as keys

## Consequences

### Positive Consequences

- **O(1) lookups**: `getRuleById()` is constant time
- **Duplicate prevention**: Constructor validates unique rule IDs
- **Type safety**: Map<string, Rule> provides clear types
- **Iteration order**: Guaranteed insertion order (ES2015+)
- **Memory safety**: No prototype pollution
- **Clear API**: `.has()`, `.get()`, `.set()` are self-documenting
- **Size tracking**: Built-in `.size` property

### Negative Consequences

- **JSON serialization**: Maps aren't directly JSON serializable
  - Mitigation: Provide `rules` getter that returns array
- **Slightly verbose**: More characters than object literals
- **Less familiar**: Some developers less familiar with Map API

### Neutral Consequences

- **Import not needed**: Map is a built-in ES6 feature
- **Browser compatibility**: Not an issue (Node.js target)

## Follow-up Actions

- [x] Implement Map-based storage in RulesEngine
- [x] Add duplicate ID validation in constructor
- [x] Provide array getter for serialization
- [x] Add unit tests for duplicate detection
- [x] Document in code with TypeScript types

## References

- [MDN - Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
- [src/domain/RulesEngine.ts](../../src/domain/RulesEngine.ts)
- Performance: [JavaScript Map vs Object](https://www.zhenghao.io/posts/object-vs-map)
- Related: TypeScript strict mode (tsconfig noUncheckedIndexedAccess)
