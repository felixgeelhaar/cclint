# ADR 005 - Plugin Security Sandbox

**Status**: Accepted

**Date**: 2024-07-21

**Authors**: Felix Geelhaar

## Context

The CC Linter supports custom rule plugins loaded dynamically via `import()`. This extensibility creates security risks:

- Malicious code execution (arbitrary code from npm)
- File system access (read/write sensitive files)
- Network requests (data exfiltration)
- Process manipulation (exit, spawn child processes)
- Denial of service (infinite loops, memory exhaustion)

We need a security strategy that balances extensibility with safety.

## Decision

Implement a **multi-layered security approach** combining:

1. **Static Code Analysis** - Scan plugin code for dangerous patterns
2. **Path Validation** - Whitelist allowed file extensions and validate paths
3. **Trust Tiers** - Differentiate between official, community, and local plugins
4. **Future Sandbox** - Prepared infrastructure for Worker Thread isolation

Current implementation (`src/infrastructure/security/`):

### PluginSandbox

```typescript
export class PluginSandbox {
  private config: PluginSecurityConfig = {
    timeout: 5000, // 5 second max execution
    maxMemory: 128, // 128 MB limit
    allowNetwork: false,
    allowFileSystem: false,
    allowedModules: ['path', 'url', 'util'],
  };

  validateViolation(violation: unknown): boolean {
    // Ensure plugins return valid Violation objects
  }
}
```

### PathValidator

```typescript
export class PathValidator {
  constructor(allowedExtensions: string[]) {
    this.allowedExtensions = ['.js', '.mjs', '.cjs', '.ts'];
  }

  validatePath(path: string): string {
    // Prevent directory traversal
    // Whitelist allowed extensions
    // Resolve to absolute paths
  }
}
```

### PluginLoader Trust Tiers

```typescript
const trustedPlugins = new Set([
  '@cclint/core-rules', // Official plugins
  '@cclint/typescript-rules',
  '@felixgeelhaar/cclint-*', // Author's namespace
]);
```

### Dangerous Pattern Detection

```typescript
const dangerousPatterns = [
  /eval\s*\(/,
  /Function\s*\(/,
  /require\s*\(\s*['"`]child_process/,
  /require\s*\(\s*['"`]fs/,
  /process\s*\.\s*exit/,
];
```

## Alternatives Considered

### VM2 / Isolated VM

- **Pros**: True code isolation, proven security
- **Cons**:
  - VM2 is deprecated and unmaintained
  - Heavy dependencies
  - Performance overhead
  - Complex setup
- **Why rejected**: Dependency is deprecated, too heavy for our use case

### Worker Threads (Future)

- **Pros**: True process isolation, built-in to Node.js
- **Cons**:
  - Complex message passing
  - Serialization overhead
  - Harder debugging
  - More complexity
- **Why deferred**: Good future option, but start simpler

### No Sandbox (Trust Users)

- **Pros**: Zero overhead, simple
- **Cons**:
  - Dangerous for untrusted plugins
  - No protection against mistakes
  - Security vulnerabilities
- **Why rejected**: Unacceptable risk for extensible system

### Deno-style Permissions

- **Pros**: Explicit permission model, clear to users
- **Cons**:
  - Requires runtime support
  - Complex permission CLI
  - Not available in Node.js
- **Why rejected**: Not feasible in Node.js environment

## Consequences

### Positive Consequences

- **Defense in depth**: Multiple security layers
- **Trust model**: Official plugins bypass heavy checks
- **User awareness**: Warnings for untrusted plugins
- **Path safety**: Directory traversal prevention
- **Pattern detection**: Catches obvious malicious code
- **Future ready**: Infrastructure for Worker Thread migration
- **Validation**: Ensures plugins return correct data structures

### Negative Consequences

- **Not foolproof**: Determined attacker can bypass static analysis
- **Performance cost**: Code scanning adds overhead
- **False positives**: Legitimate plugins may trigger warnings
- **Complexity**: Multi-layer approach requires maintenance
- **Limited isolation**: No true sandboxing without Worker Threads

### Neutral Consequences

- **User experience**: Warnings educate but may concern users
- **Trust required**: Users must vet third-party plugins themselves

## Follow-up Actions

- [x] Implement PluginSandbox with security config
- [x] Create PathValidator for safe path handling
- [x] Add dangerous pattern detection to PluginLoader
- [x] Implement trust tier system
- [ ] Document security model in README
- [ ] Add opt-in Worker Thread sandbox (v2)
- [ ] Create plugin security guidelines for authors
- [ ] Consider plugin signature verification

## References

- [src/infrastructure/security/PluginSandbox.ts](../../src/infrastructure/security/PluginSandbox.ts)
- [src/infrastructure/security/PathValidator.ts](../../src/infrastructure/security/PathValidator.ts)
- [src/infrastructure/PluginLoader.ts](../../src/infrastructure/PluginLoader.ts)
- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)
- [OWASP: Code Injection](https://owasp.org/www-community/attacks/Code_Injection)
- [Securing Node.js](https://nodejs.org/en/docs/guides/security/)
