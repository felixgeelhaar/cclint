# ADR 005 - Plugin Security: Explicit Trust Gate

**Status**: Superseded / Not implemented — the "PluginSandbox" described in the
original version of this ADR was never built. Superseded by an explicit,
out-of-band **trust gate** (this change).

**Date**: 2024-07-21 (original) · Revised 2026-07-11

**Authors**: Felix Geelhaar

## Context

cclint supports custom rule plugins loaded dynamically via `import()`. A plugin
is ordinary JavaScript/TypeScript: when imported it runs with the **full
privileges of the cclint process** — file system, network, child processes, the
lot. Plugins are declared in project configuration (`.cclintrc.json` or
`package.json#cclint`), and `ConfigLoader` walks **up** the directory tree to
find that config.

The combination is dangerous: linting a checked-out repository would, before
this change, auto-import whatever plugins that repository's own config named.
That is remote code execution triggered simply by running `cclint` inside an
untrusted tree — no flag, no prompt, no confirmation.

## What the original ADR claimed (and why it was wrong)

The first version of this ADR described a `PluginSandbox` class at
`src/infrastructure/security/PluginSandbox.ts` enforcing a 5s timeout, a 128 MB
memory cap, and `allowNetwork: false` / `allowFileSystem: false`. It marked
those items as implemented (`[x]`).

**None of that existed.** There is no `PluginSandbox.ts` in the tree and never
was. Plugins ran — and still run — in-process with no isolation. Documenting a
guarantee we did not provide is worse than documenting none, because it invites
users to trust plugins they should vet. This revision removes that claim.

## Decision

Ship an honest, enforceable control instead of an imaginary sandbox: an
**explicit trust gate** that the linted repository cannot set.

1. **Off by default.** Plugins declared in project config are **not** imported.
   `PluginLoader.loadPluginsFromConfig()` returns them in a `skipped` list and
   the CLI prints a clear warning naming the skipped plugins.
2. **Out-of-band opt-in.** Plugins load only when the operator passes
   `--allow-plugins` to `cclint lint`, or sets the environment variable
   `CCLINT_ALLOW_PLUGINS=1`. Both live outside the repository under test, so a
   malicious `.cclintrc.json` / `package.json#cclint` cannot enable itself.
3. **Defense in depth (unchanged, retained).** When plugins *are* enabled the
   pre-existing lighter checks still apply:
   - **Path validation** (`PathValidator`) — extension allow-list, directory
     traversal rejection, and symlink-aware base-directory containment.
   - **Trust tiers** — official `@cclint/*` and `@felixgeelhaar/cclint-*`
     namespaces are treated as trusted for the softer warnings.
   - **Dangerous-pattern warnings** — plugin `lint()` source is scanned for
     `eval`, `Function`, `child_process`, `fs`, `process.exit`, etc. These are
     **advisory `console.warn`s only** and run *after* import; they do not, and
     are not claimed to, prevent execution.

### No sandbox in this change — deliberately

We did **not** build a vm/Worker-thread sandbox here. A real sandbox is a large,
easy-to-get-subtly-wrong undertaking, and a half-built one is exactly the trap
the original ADR fell into. The trust gate is the fix: it removes the
zero-interaction RCE with a control we can actually enforce and test. A true
isolation layer remains possible future work (see below), but it is not claimed
as present.

## Alternatives Considered

### Real sandbox now (Worker threads / isolated-vm)

- **Pros**: true isolation, would allow safely running untrusted plugins.
- **Cons**: significant complexity (message passing, serialization, module
  resolution across the boundary), and high risk of an incomplete
  implementation that *looks* safe but is not — the failure mode this ADR
  exists to correct.
- **Why deferred**: out of scope for a security fix whose goal is to close an
  active RCE quickly and honestly.

### VM2 / `vm` module

- **Rejected**: VM2 is deprecated/unmaintained with a history of sandbox
  escapes; the built-in `vm` module is explicitly *not* a security boundary.

### Keep loading plugins by default, warn only (status quo ante)

- **Rejected**: `console.warn` after `import()` is useless — the code has
  already executed. This is the vulnerability, not a mitigation.

## Consequences

### Positive

- The zero-interaction, config-driven RCE is closed: cloning and linting a
  hostile repo no longer runs its plugins.
- The security posture is now **accurately documented** — no phantom sandbox.
- The gate is small, enforceable, and unit-tested.

### Negative / Neutral

- Users who legitimately rely on project-local plugins must pass
  `--allow-plugins` (or set `CCLINT_ALLOW_PLUGINS=1`). This is an intentional,
  one-time friction that makes the trust decision explicit.
- Enabled plugins still run in-process with full privileges. This is
  **clearly stated**, not hidden behind a false isolation claim. Trust plugins
  as you would any npm dependency.

## Follow-up Actions

- [x] Remove the false `PluginSandbox` implementation claim from this ADR.
- [x] Add an explicit `--allow-plugins` / `CCLINT_ALLOW_PLUGINS` trust gate.
- [x] Skip config-declared plugins by default and warn with remediation steps.
- [x] Symlink-aware base-directory containment in `PathValidator`.
- [ ] Optional: opt-in Worker-thread isolation for running untrusted plugins.
- [ ] Document the plugin trust model in the README / plugin author guide.

## References

- [src/infrastructure/PluginLoader.ts](../../src/infrastructure/PluginLoader.ts)
  — trust gate and advisory checks
- [src/cli/commands/lintEnhanced.ts](../../src/cli/commands/lintEnhanced.ts)
  — `--allow-plugins` flag and skip warning
- [src/infrastructure/security/PathValidator.ts](../../src/infrastructure/security/PathValidator.ts)
  — path + symlink containment
- [OWASP: Code Injection](https://owasp.org/www-community/attacks/Code_Injection)
- [Node.js `vm` — "not a security mechanism"](https://nodejs.org/api/vm.html)
